const School = require('../models/School');
const SmsLog = require('../models/SmsLog');
const SmsTemplate = require('../models/SmsTemplate');
const SmsCampaign = require('../models/SmsCampaign');
const { sendCustomSMS, sendBulkSMS, sendOTP, verifyOTP, updateDeliveryStatus } = require('../utils/sms');
const { buildRecipients, runCampaign } = require('../utils/scheduler');

// ── Settings ──────────────────────────────────────────────────────────────────
const getSettings = async (req, res) => {
  try {
    if (!req.user.school) return res.status(400).json({ success: false, message: 'School not associated with user' });
    // lean() returns the raw MongoDB document — avoids Mongoose's in-memory schema
    // silently dropping fields (e.g. smsEnabled/whatsappEnabled) that were stored in
    // MongoDB but aren't recognised by the current in-memory schema version.
    const school = await School.findById(req.user.school).lean();
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.json({ success: true, smsConfig: school.smsConfig || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateSettings = async (req, res) => {
  try {
    if (!req.user.school) return res.status(400).json({ success: false, message: 'School not associated with user' });
    const body = { ...req.body };

    // Keep legacy `enabled` in sync so scheduler & other backend code still works
    body.enabled = !!(body.smsEnabled || body.whatsappEnabled);

    // Build a flat $set map using dot-notation so we never accidentally wipe
    // sibling fields (e.g. saving notifications must not reset twilioSid, etc.)
    const setMap = {};
    for (const [key, val] of Object.entries(body)) {
      setMap[`smsConfig.${key}`] = val;
    }

    // strict: false — lets MongoDB write any field regardless of whether the
    // in-memory Mongoose schema has been refreshed after a schema change (e.g.
    // smsEnabled / whatsappEnabled added mid-session without server restart).
    await School.findByIdAndUpdate(
      req.user.school,
      { $set: setMap },
      { runValidators: false, strict: false }
    );

    // Re-read with lean() so we return the raw MongoDB values — Mongoose's
    // in-memory schema toJSON() would silently omit fields it doesn't "know"
    // about, causing the frontend to always see them as false/undefined.
    const updated = await School.findById(req.user.school).lean();
    res.json({ success: true, smsConfig: updated.smsConfig || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const testSms = async (req, res) => {
  try {
    if (!req.user.school) return res.status(400).json({ success: false, message: 'School not associated with user' });
    const { phone, channel = 'sms' } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });
    const msg = channel === 'whatsapp'
      ? 'Test WhatsApp message from School Management System. Configuration is working correctly!'
      : 'Test SMS from School Management System. Configuration is working correctly!';
    const result = await sendCustomSMS(req.user.school, phone, msg, 'general', {}, null, channel);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Templates ─────────────────────────────────────────────────────────────────
const getTemplates = async (req, res) => {
  try {
    const templates = await SmsTemplate.find({ school: req.user.school, isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createTemplate = async (req, res) => {
  try {
    const template = await SmsTemplate.create({ ...req.body, school: req.user.school, createdBy: req.user._id });
    res.status(201).json({ success: true, template });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateTemplate = async (req, res) => {
  try {
    const template = await SmsTemplate.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, req.body, { new: true });
    if (!template) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, template });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteTemplate = async (req, res) => {
  try {
    await SmsTemplate.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { isActive: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Send ──────────────────────────────────────────────────────────────────────
const sendBulk = async (req, res) => {
  try {
    const { message, type, channel = 'sms', targetType, targetFilter, scheduledAt, language } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });
    if (!targetType) return res.status(400).json({ success: false, message: 'Target is required' });

    const autoName = `${targetType.replace(/_/g, ' ')} — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    const campaign = await SmsCampaign.create({
      school: req.user.school, name: autoName, message, language: language || 'en',
      type: type || 'general', channel, targetType, targetFilter: targetFilter || {},
      status: scheduledAt ? 'scheduled' : 'running',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      startedAt: scheduledAt ? null : new Date(),
      statusHistory: [{ status: scheduledAt ? 'scheduled' : 'running', at: new Date() }],
      createdBy: req.user._id
    });

    if (scheduledAt) {
      return res.status(201).json({ success: true, campaign, message: `Scheduled for ${new Date(scheduledAt).toLocaleString()}` });
    }

    res.status(201).json({ success: true, campaign, message: 'Sending...' });
    runCampaign(campaign); // async, runs after response
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Batches (completed bulk sends) ───────────────────────────────────────────
const getBatches = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school, status: { $in: ['running','completed','failed','cancelled'] } };
    const total = await SmsCampaign.countDocuments(query);
    const batches = await SmsCampaign.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, batches, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getBatchLogs = async (req, res) => {
  try {
    const logs = await SmsLog.find({ campaign: req.params.id, school: req.user.school }).sort({ status: 1, createdAt: -1 }).limit(1000);
    res.json({ success: true, logs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Scheduled sends ───────────────────────────────────────────────────────────
const getScheduled = async (req, res) => {
  try {
    const campaigns = await SmsCampaign.find({ school: req.user.school, status: 'scheduled' }).sort({ scheduledAt: 1 });
    res.json({ success: true, campaigns });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const cancelScheduled = async (req, res) => {
  try {
    const campaign = await SmsCampaign.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school, status: 'scheduled' },
      { status: 'cancelled', $push: { statusHistory: { status: 'cancelled', at: new Date(), note: 'Cancelled by user' } } },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Scheduled send not found' });
    res.json({ success: true, campaign });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Logs ──────────────────────────────────────────────────────────────────────
const getLogs = async (req, res) => {
  try {
    const { type, status, channel, search, page = 1, limit = 50 } = req.query;
    const query = { school: req.user.school };
    if (type) query.type = type;
    if (status) query.status = status;
    if (channel) query.channel = channel;
    if (search) query.$or = [{ to: new RegExp(search, 'i') }, { recipientName: new RegExp(search, 'i') }, { message: new RegExp(search, 'i') }];
    const total = await SmsLog.countDocuments(query);
    const logs = await SmsLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getStats = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const [total, sent, failed, delivered] = await Promise.all([
      SmsLog.countDocuments({ school: schoolId }),
      SmsLog.countDocuments({ school: schoolId, status: 'sent' }),
      SmsLog.countDocuments({ school: schoolId, status: 'failed' }),
      SmsLog.countDocuments({ school: schoolId, deliveryStatus: 'delivered' })
    ]);
    res.json({ success: true, stats: { total, sent, failed, delivered, pending: total - sent - failed } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const retryMessage = async (req, res) => {
  try {
    const log = await SmsLog.findOne({ _id: req.params.id, school: req.user.school });
    if (!log) return res.status(404).json({ success: false, message: 'Not found' });
    if (log.retryCount >= 3) return res.status(400).json({ success: false, message: 'Max retries reached' });
    const result = await sendCustomSMS(req.user.school, log.to, log.message, log.type, {}, null, log.channel || 'sms');
    if (!result.success) return res.status(400).json(result);
    await SmsLog.findByIdAndUpdate(log._id, { retryCount: log.retryCount + 1 });
    res.json({ success: true, message: 'Retried successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── OTP ───────────────────────────────────────────────────────────────────────
const sendOTPCtrl = async (req, res) => {
  try {
    const { phone } = req.body;
    const result = await sendOTP(req.user?.school || req.body.schoolId, phone);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const verifyOTPCtrl = async (req, res) => {
  const { phone, otp } = req.body;
  res.json(verifyOTP(phone, otp));
};

// ── Twilio Webhook ────────────────────────────────────────────────────────────
const twilioWebhook = async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;
    if (MessageSid && MessageStatus) await updateDeliveryStatus(MessageSid, MessageStatus);
    res.status(200).send('');
  } catch (err) { res.status(200).send(''); }
};

module.exports = {
  getSettings, updateSettings, testSms,
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  sendBulk, getBatches, getBatchLogs, getScheduled, cancelScheduled,
  getLogs, getStats, retryMessage,
  sendOTPCtrl, verifyOTPCtrl, twilioWebhook
};
