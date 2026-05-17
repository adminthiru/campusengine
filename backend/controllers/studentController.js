const Student = require('../models/Student');
const Parent = require('../models/Parent');
const User = require('../models/User');
const Class = require('../models/Class');
const School = require('../models/School');
const { sendEmail, invitationEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');
const { generateAdmissionLetter } = require('../utils/pdf');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_ADMISSION_LETTER = `Dear Parent/Guardian,

We are pleased to inform you that {{student_name}} has been successfully admitted to {{school_name}}.

Admission Details:
- Admission Number: {{admission_number}}
- Class: {{class}} - Section {{section}}
- Academic Year: {{academic_year}}
- Date of Admission: {{admission_date}}

Please ensure that all required documents are submitted within 7 days.

We look forward to nurturing your child's growth and development.

Yours sincerely,
Principal
{{school_name}}
Date: {{date}}`;

const createStudent = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const school = await School.findById(schoolId);

    const count = await Student.countDocuments({ school: schoolId });
    const admissionNumber = `ADM${school.code}${new Date().getFullYear()}${String(count + 1).padStart(4, '0')}`;

    // Create/link guardians
    const guardianIds = [];
    const guardiansInput = Array.isArray(req.body.guardians) ? req.body.guardians : [];
    if (guardiansInput.length > 0) {
      for (const g of guardiansInput) {
        let parent = await Parent.findOne({ phone: g.phone, school: schoolId });
        if (!parent) {
          parent = await Parent.create({ ...g, school: schoolId });
          // Create parent user
          const tempPass = `Parent@${uuidv4().slice(0, 6)}`;
          if (g.email) {
            const parentUser = await User.create({
              school: schoolId, name: g.name, email: g.email,
              phone: g.phone, password: tempPass, role: 'parent', parentId: parent._id
            });
            parent.user = parentUser._id;
            await parent.save();
            const portalUrl = `${process.env.CLIENT_URL}?school=${school.code}`;
            await sendEmail(invitationEmail(g.name, g.email, tempPass, portalUrl, 'parent'));
            if (g.phone) {
              await sendSMS(schoolId, g.phone, 'invitation',
                [g.name, portalUrl, g.email, tempPass], school.language, { parent: parent._id }
              );
            }
          }
        }
        guardianIds.push(parent._id);
      }
    }

    const classInfo = req.body.currentClass ? await Class.findById(req.body.currentClass) : null;

    const student = await Student.create({
      ...req.body,
      school: schoolId,
      admissionNumber,
      guardians: guardianIds,
      primaryGuardian: guardianIds[0],
      academicYear: school.academicYear?.current
    });

    // Update parent with student reference
    for (const gId of guardianIds) {
      await Parent.findByIdAndUpdate(gId, { $addToSet: { students: student._id } });
    }

    // Create student user account
    const tempPassword = `Stud@${uuidv4().slice(0, 6)}`;
    if (req.body.email) {
      const stuUser = await User.create({
        school: schoolId, name: req.body.name, email: req.body.email,
        phone: req.body.phone, password: tempPassword, role: 'student', studentId: student._id
      });
      student.user = stuUser._id;
      await student.save();
      const portalUrl = `${process.env.CLIENT_URL}?school=${school.code}`;
      await sendEmail(invitationEmail(req.body.name, req.body.email, tempPassword, portalUrl, 'student'));
    }

    const populated = await Student.findById(student._id)
      .populate('currentClass', 'name section')
      .populate('guardians', 'name relation phone');

    res.status(201).json({ success: true, student: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const { classId, status, search, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (classId) query.currentClass = classId;
    if (status) query.status = status;
    if (search) query.$or = [
      { name: new RegExp(search, 'i') },
      { admissionNumber: new RegExp(search, 'i') },
      { rollNumber: new RegExp(search, 'i') }
    ];

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .populate('currentClass', 'name section')
      .populate('guardians', 'name relation phone')
      .sort({ admissionNumber: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, students, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, school: req.user.school })
      .populate('currentClass', 'name section fees')
      .populate('guardians')
      .populate('primaryGuardian');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const updateData = { ...req.body };

    // Resolve guardian objects → Parent ObjectIds (same logic as createStudent)
    const guardiansInput = Array.isArray(req.body.guardians) ? req.body.guardians : [];
    if (guardiansInput.length > 0) {
      const guardianIds = [];
      for (const g of guardiansInput) {
        if (typeof g === 'string' || g?._id) {
          // Already an ObjectId or populated object — keep as-is
          guardianIds.push(g._id || g);
        } else if (g.phone) {
          let parent = await Parent.findOne({ phone: g.phone, school: schoolId });
          if (!parent) {
            parent = await Parent.create({ ...g, school: schoolId });
          } else {
            await Parent.findByIdAndUpdate(parent._id, { name: g.name, relation: g.relation, alternatePhone: g.alternatePhone });
          }
          guardianIds.push(parent._id);
        }
      }
      updateData.guardians = guardianIds;
      if (guardianIds.length > 0) updateData.primaryGuardian = guardianIds[0];
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: schoolId }, updateData, { new: true }
    ).populate('currentClass', 'name section').populate('guardians', 'name relation phone');
    if (!student) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!student) return res.status(404).json({ success: false, message: 'Not found' });
    // Remove this student from all parent records
    if (student.guardians?.length) {
      await Parent.updateMany({ _id: { $in: student.guardians } }, { $pull: { students: student._id } });
    }
    // Delete associated user account
    if (student.user) {
      await User.findByIdAndDelete(student.user);
    }
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Promote students
const promoteStudents = async (req, res) => {
  try {
    const { studentIds, toClassId, academicYear } = req.body;
    const toClass = await Class.findById(toClassId);
    if (!toClass) return res.status(404).json({ success: false, message: 'Target class not found' });

    const results = [];
    for (const studentId of studentIds) {
      const student = await Student.findOne({ _id: studentId, school: req.user.school });
      if (!student) continue;

      student.promotionHistory.push({
        fromClass: student.currentClass,
        toClass: toClassId,
        academicYear: academicYear || toClass.academicYear,
        promotedAt: new Date(),
        promotedBy: req.user._id
      });
      student.previousClass = student.currentClass;
      student.currentClass = toClassId;
      student.academicYear = academicYear;
      await student.save();
      results.push(student._id);
    }

    res.json({ success: true, message: `${results.length} students promoted`, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admission letter PDF
const getAdmissionLetterPDF = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, school: req.user.school })
      .populate('currentClass', 'name section');
    if (!student) return res.status(404).json({ success: false, message: 'Not found' });
    const school = await School.findById(req.user.school);
    const template = req.body.template || DEFAULT_ADMISSION_LETTER;
    const data = {
      ...student.toObject(),
      className: student.currentClass?.name,
      section: student.currentClass?.section
    };
    const pdf = await generateAdmissionLetter(data, school.toObject(), template);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Admission_${student.admissionNumber}.pdf`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ID Card data
const getIDCardData = async (req, res) => {
  try {
    const { ids } = req.body;
    const students = await Student.find({ _id: { $in: ids }, school: req.user.school })
      .populate('currentClass', 'name section')
      .populate('primaryGuardian', 'name phone');
    const school = await School.findById(req.user.school);
    res.json({ success: true, students, school });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createStudent, getStudents, getStudent, updateStudent, deleteStudent,
  promoteStudents, getAdmissionLetterPDF, getIDCardData
};
