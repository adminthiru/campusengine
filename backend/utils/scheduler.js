const SmsCampaign = require('../models/SmsCampaign');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const Parent = require('../models/Parent');
const { sendBulkSMS } = require('./sms');

const buildRecipients = async (schoolId, targetType, targetFilter = {}) => {
  let recipients = [];

  if (targetType === 'all') {
    // Everyone — students + parents + staff
    const [students, parents, emps] = await Promise.all([
      Student.find({ school: schoolId, status: 'active' }).select('name phone'),
      Parent.find({ school: schoolId }).select('name phone'),
      Employee.find({ school: schoolId, status: 'active' }).select('name phone'),
    ]);
    for (const s of students) if (s.phone) recipients.push({ phone: s.phone, name: s.name, studentId: s._id });
    for (const p of parents)  if (p.phone) recipients.push({ phone: p.phone, name: p.name, parentId: p._id });
    for (const e of emps)     if (e.phone) recipients.push({ phone: e.phone, name: e.name, employeeId: e._id });

  } else if (targetType === 'all_students') {
    const students = await Student.find({ school: schoolId, status: 'active' }).select('name phone');
    for (const s of students) if (s.phone) recipients.push({ phone: s.phone, name: s.name, studentId: s._id });

  } else if (targetType === 'all_parents') {
    const parents = await Parent.find({ school: schoolId }).select('name phone');
    for (const p of parents) if (p.phone) recipients.push({ phone: p.phone, name: p.name, parentId: p._id });

  } else if (targetType === 'all_teachers') {
    const emps = await Employee.find({ school: schoolId, status: 'active', department: 'Teaching' }).select('name phone');
    for (const e of emps) if (e.phone) recipients.push({ phone: e.phone, name: e.name, employeeId: e._id });

  } else if (targetType === 'all_staff') {
    const emps = await Employee.find({ school: schoolId, status: 'active' }).select('name phone');
    for (const e of emps) if (e.phone) recipients.push({ phone: e.phone, name: e.name, employeeId: e._id });

  } else if (targetType === 'class') {
    // All sections of a class name (e.g. all of "Class 10" — 10A, 10B, 10C)
    const Class = require('../models/Class');
    const classIds = (await Class.find({ school: schoolId, name: targetFilter.className }).select('_id')).map(c => c._id);
    const students = await Student.find({ school: schoolId, currentClass: { $in: classIds }, status: 'active' }).select('name phone');
    for (const s of students) if (s.phone) recipients.push({ phone: s.phone, name: s.name, studentId: s._id });

  } else if (targetType === 'class_section') {
    // Specific class + section (single class record by _id)
    const students = await Student.find({ school: schoolId, currentClass: targetFilter.classId, status: 'active' }).select('name phone');
    for (const s of students) if (s.phone) recipients.push({ phone: s.phone, name: s.name, studentId: s._id });

  } else if (targetType === 'specific_students') {
    const ids = targetFilter.studentIds || [];
    const students = await Student.find({ school: schoolId, _id: { $in: ids } }).select('name phone');
    for (const s of students) if (s.phone) recipients.push({ phone: s.phone, name: s.name, studentId: s._id });

  } else if (targetType === 'specific_parents') {
    const ids = targetFilter.parentIds || [];
    const parents = await Parent.find({ school: schoolId, _id: { $in: ids } }).select('name phone');
    for (const p of parents) if (p.phone) recipients.push({ phone: p.phone, name: p.name, parentId: p._id });

  } else if (targetType === 'specific_teachers') {
    const ids = targetFilter.employeeIds || [];
    const emps = await Employee.find({ school: schoolId, _id: { $in: ids } }).select('name phone');
    for (const e of emps) if (e.phone) recipients.push({ phone: e.phone, name: e.name, employeeId: e._id });

  } else if (targetType === 'specific_staff') {
    const ids = targetFilter.employeeIds || [];
    const emps = await Employee.find({ school: schoolId, _id: { $in: ids } }).select('name phone');
    for (const e of emps) if (e.phone) recipients.push({ phone: e.phone, name: e.name, employeeId: e._id });
  }

  // Deduplicate by phone
  const seen = new Set();
  return recipients.filter(r => { if (seen.has(r.phone)) return false; seen.add(r.phone); return true; });
};

const runCampaign = async (campaign) => {
  try {
    // Only mark as running if not already in that state (scheduler may have done it already)
    if (campaign.status !== 'running') {
      await SmsCampaign.findByIdAndUpdate(campaign._id, {
        status: 'running', startedAt: new Date(),
        $push: { statusHistory: { status: 'running', at: new Date() } }
      });
    }
    const recipients = await buildRecipients(campaign.school, campaign.targetType, campaign.targetFilter || {});
    const channels = campaign.channel === 'both' ? ['sms', 'whatsapp'] : [campaign.channel || 'sms'];
    const allResults = await Promise.all(
      channels.map(ch => sendBulkSMS(campaign.school, recipients, campaign.message, campaign.type || 'general', campaign._id, ch))
    );
    const sent = allResults.reduce((s, r) => s + r.sent, 0);
    const failed = allResults.reduce((s, r) => s + r.failed, 0);
    const finalStatus = sent === 0 ? 'failed' : 'completed';
    await SmsCampaign.findByIdAndUpdate(campaign._id, {
      status: finalStatus, sentCount: sent, failedCount: failed,
      totalCount: recipients.length * channels.length, completedAt: new Date(),
      $push: { statusHistory: { status: finalStatus, at: new Date(), note: `${sent} sent, ${failed} failed` } }
    });
  } catch (err) {
    await SmsCampaign.findByIdAndUpdate(campaign._id, {
      status: 'failed', completedAt: new Date(),
      $push: { statusHistory: { status: 'failed', at: new Date(), note: err.message } }
    });
    console.error('Campaign run error:', err.message);
  }
};

const startScheduler = () => {
  setInterval(async () => {
    try {
      // Atomically claim each due campaign by flipping it to 'running' in a single
      // findOneAndUpdate. This prevents double-firing when multiple processes (or
      // two scheduler ticks) see the same 'scheduled' document.
      let campaign;
      while (true) {
        campaign = await SmsCampaign.findOneAndUpdate(
          { status: 'scheduled', scheduledAt: { $lte: new Date() } },
          { status: 'running', startedAt: new Date(), $push: { statusHistory: { status: 'running', at: new Date(), note: 'Started by scheduler' } } },
          { new: true }
        );
        if (!campaign) break;
        runCampaign(campaign); // fire-and-forget (runCampaign has its own error handling)
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, 60 * 1000);
  console.log('SMS scheduler started');
};

module.exports = { startScheduler, runCampaign, buildRecipients };
