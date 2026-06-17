const { Exam, ExamResult } = require('../models/Exam');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const School = require('../models/School');
const { generateResultCard, generateHallTicket } = require('../utils/pdf');
const { sendSMS } = require('../utils/sms');
const { notifyParentUsers, notifyStudentUsers } = require('../utils/notify');
const { academicYearForDate } = require('../utils/academicYear');

// Get single exam by ID
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, school: req.user.school })
      .populate('classes', 'name section')
      .populate('schedule.class', 'name section')
      .populate('schedule.subject', 'name code maxMarks')
      .populate('schedule.invigilator', 'name');
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Upload answer paper — stored per subject inside marks[]
const uploadAnswerPaper = async (req, res) => {
  try {
    const { examId, studentId, classId, subjectId } = req.body;
    const schoolId = req.user.school;

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    if (!subjectId) return res.status(400).json({ success: false, message: 'subjectId required' });

    let result = await ExamResult.findOne({ school: schoolId, exam: examId, student: studentId });
    if (!result) {
      const exam = await Exam.findById(examId);
      result = await ExamResult.create({
        school: schoolId, exam: examId, student: studentId, class: classId,
        academicYear: exam?.academicYear, marks: []
      });
    }

    const paperData = {
      url: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    };

    const markEntry = result.marks.find(m => m.subject?.toString() === subjectId);
    if (markEntry) {
      markEntry.answerPaper = paperData;
    } else {
      result.marks.push({ subject: subjectId, answerPaper: paperData });
    }
    await result.save();

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create exam
const createExam = async (req, res) => {
  try {
    let { academicYear } = req.body;
    if (!academicYear) {
      const school = await School.findById(req.user.school);
      const sm = school?.academicYear?.startMonth || 6;
      const em = school?.academicYear?.endMonth || 3;
      // Anchor to the exam date when available, else today.
      academicYear = academicYearForDate(req.body.examDate || new Date(), sm, em);
    }
    const exam = await Exam.create({ ...req.body, academicYear, school: req.user.school, createdBy: req.user._id });
    // Notify parents of students in the exam's classes
    if (exam.classes?.length) {
      const classStudents = await Student.find({ currentClass: { $in: exam.classes }, school: req.user.school, status: 'active' }).select('_id');
      const dateLabel = exam.examDate ? new Date(exam.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD';
      const examSchedMsg = `${exam.name} has been scheduled${exam.examDate ? ` on ${dateLabel}` : ''}. Please prepare accordingly.`;
      const studentIdList = classStudents.map(s => s._id);
      notifyParentUsers(req.user.school, studentIdList, 'notifyOnExamScheduled', `Exam Scheduled: ${exam.name}`, examSchedMsg.replace('accordingly', 'your child'), 'info');
      notifyStudentUsers(req.user.school, studentIdList, 'notifyOnExamScheduled', `Exam Scheduled: ${exam.name}`, examSchedMsg, 'info');
    }
    res.status(201).json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get exams
const getExams = async (req, res) => {
  try {
    const { academicYear, classId, status } = req.query;
    const query = { school: req.user.school };
    if (academicYear) query.academicYear = academicYear;
    if (classId) query.classes = classId;
    if (status) query.status = status;

    const exams = await Exam.find(query)
      .populate('classes', 'name section')
      .populate('schedule.class', 'name section')
      .populate('schedule.subject', 'name')
      .populate('schedule.invigilator', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, exams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update exam
const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school }, req.body, { returnDocument: 'after' }
    );
    // Cascade unpublish to all results when reverting
    if (req.body.isResultPublished === false) {
      await ExamResult.updateMany(
        { exam: req.params.id, school: req.user.school },
        { isPublished: false }
      );
    }
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete exam
const deleteExam = async (req, res) => {
  try {
    await Exam.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    await ExamResult.deleteMany({ exam: req.params.id, school: req.user.school });
    res.json({ success: true, message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Enter/update marks
const enterMarks = async (req, res) => {
  try {
    const { examId, classId, subjectId, marksData } = req.body;
    const schoolId = req.user.school;

    for (const entry of marksData) {
      const { studentId, theoryMarks, practicalMarks, isAbsent, remarks } = entry;
      let result = await ExamResult.findOne({ school: schoolId, exam: examId, student: studentId });

      if (!result) {
        result = await ExamResult.create({
          school: schoolId, exam: examId, student: studentId, class: classId,
          academicYear: req.body.academicYear, marks: []
        });
      }

      const exam = await Exam.findById(examId);
      const scheduleEntry = exam.schedule.find(s =>
        s.class?.toString() === classId && s.subject?.toString() === subjectId
      );

      const maxMarks = scheduleEntry?.maxMarks || 100;
      const passingMarks = scheduleEntry?.passingMarks || 35;
      const totalMarks = isAbsent ? 0 : (theoryMarks || 0) + (practicalMarks || 0);

      const school = await School.findById(schoolId);
      const gradeConfig = school.gradeConfig;
      let grade = '';
      if (!isAbsent && gradeConfig.grades?.length > 0) {
        const percent = (totalMarks / maxMarks) * 100;
        const gradeObj = gradeConfig.grades.find(g => percent >= g.minScore && percent <= g.maxScore);
        grade = gradeObj?.label || '';
      }

      // Update or add subject marks
      const existingMark = result.marks.find(m => m.subject?.toString() === subjectId);
      if (existingMark) {
        Object.assign(existingMark, { theoryMarks, practicalMarks, totalMarks, maxMarks, passingMarks, grade, isAbsent, remarks, enteredBy: req.user._id });
      } else {
        result.marks.push({ subject: subjectId, theoryMarks, practicalMarks, totalMarks, maxMarks, passingMarks, grade, isAbsent, remarks, enteredBy: req.user._id });
      }

      // Recalculate totals
      result.totalMarksObtained = result.marks.reduce((s, m) => s + (m.totalMarks || 0), 0);
      result.totalMaxMarks = result.marks.reduce((s, m) => s + (m.maxMarks || 0), 0);
      result.percentage = result.totalMaxMarks ? Math.round((result.totalMarksObtained / result.totalMaxMarks) * 100 * 10) / 10 : 0;

      // Overall grade
      if (gradeConfig.grades?.length > 0) {
        const overallGrade = gradeConfig.grades.find(g => result.percentage >= g.minScore && result.percentage <= g.maxScore);
        result.grade = overallGrade?.label || '';
      }

      await result.save();
    }

    // Calculate ranks
    const allResults = await ExamResult.find({ school: schoolId, exam: examId, class: classId })
      .sort({ percentage: -1 });
    for (let i = 0; i < allResults.length; i++) {
      allResults[i].rank = i + 1;
      await allResults[i].save();
    }

    res.json({ success: true, message: 'Marks saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Publish results
const publishResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOneAndUpdate(
      { _id: examId, school: req.user.school },
      { isResultPublished: true, status: 'completed' }, { returnDocument: 'after' }
    );
    await ExamResult.updateMany({ exam: examId, school: req.user.school }, { isPublished: true });

    // Send SMS notifications
    const results = await ExamResult.find({ exam: examId, school: req.user.school })
      .populate({ path: 'student', populate: 'guardians' });
    const school = await School.findById(req.user.school);

    for (const result of results.slice(0, 100)) {
      if (result.student?.guardians) {
        for (const g of result.student.guardians) {
          if (g.phone) {
            await sendSMS(req.user.school, g.phone, 'result_published',
              [result.student.name, exam.name, result.percentage],
              g.language || school.language, { student: result.student._id, parent: g._id }
            );
            break;
          }
        }
      }
    }

    // In-app notifications
    const studentIds = results.map(r => r.student?._id).filter(Boolean);
    if (studentIds.length) {
      notifyParentUsers(req.user.school, studentIds, 'notifyOnExamResults', `Exam Results Published: ${exam.name}`, `Results for ${exam.name} are published. Log in to view your child's performance.`, 'success');
      notifyStudentUsers(req.user.school, studentIds, 'notifyOnExamResults', `Exam Results Published: ${exam.name}`, `Results for ${exam.name} are published. Log in to view your marks.`, 'success');
    }

    res.json({ success: true, message: 'Results published' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get results
const getResults = async (req, res) => {
  try {
    const { examId, classId, studentId } = req.query;
    const query = { school: req.user.school };
    if (examId) query.exam = examId;
    if (classId) query.class = classId;
    if (studentId) query.student = studentId;

    const results = await ExamResult.find(query)
      .populate('student', 'name admissionNumber rollNumber photo')
      .populate('class', 'name section')
      .populate('exam', 'name type')
      .populate('marks.subject', 'name code');
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Result card PDF
const getResultCardPDF = async (req, res) => {
  try {
    const result = await ExamResult.findOne({ _id: req.params.id, school: req.user.school })
      .populate('student')
      .populate({ path: 'student', populate: 'currentClass' })
      .populate('exam')
      .populate('marks.subject', 'name');
    if (!result) return res.status(404).json({ success: false, message: 'Not found' });

    const school = await School.findById(req.user.school);
    const marksData = result.marks.map(m => ({
      ...m.toObject(),
      subjectName: m.subject?.name
    }));

    const data = {
      totalMarksObtained: result.totalMarksObtained,
      totalMaxMarks: result.totalMaxMarks,
      percentage: result.percentage,
      grade: result.grade,
      rank: result.rank,
      attendance: result.attendance,
      teacherRemarks: result.teacherRemarks,
      marks: marksData,
      className: result.student?.currentClass?.name,
      section: result.student?.currentClass?.section,
      academicYear: result.academicYear
    };

    const pdf = await generateResultCard(data, result.student.toObject(), school.toObject(), result.exam.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Result_${result.student.admissionNumber}.pdf`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Blank award list (for offline entry)
const getAwardList = async (req, res) => {
  try {
    const { examId, classId, subjectId } = req.query;
    const students = await Student.find({ school: req.user.school, currentClass: classId, status: 'active' })
      .sort({ rollNumber: 1 }).select('name admissionNumber rollNumber');
    const subject = await Subject.findById(subjectId).select('name maxMarks');
    const exam = await Exam.findById(examId).select('name');
    const cls = await Class.findById(classId).select('name section');

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => {
      const pdf = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=AwardList_${cls.name}${cls.section}.pdf`);
      res.send(pdf);
    });

    const school = await School.findById(req.user.school);
    doc.fontSize(16).font('Helvetica-Bold').text(school.name, { align: 'center' });
    doc.fontSize(12).text(`${exam?.name} - ${cls.name} ${cls.section}`, { align: 'center' });
    doc.fontSize(10).text(`Subject: ${subject?.name} | Max Marks: ${subject?.maxMarks || 100}`, { align: 'center' });
    doc.moveDown();

    const headers = ['#', 'Adm No', 'Name', 'Theory', 'Practical', 'Total', 'Grade', 'Sign'];
    const widths = [30, 70, 150, 60, 70, 60, 50, 60];
    let x = 50;
    doc.fillColor('#1e3a5f').rect(50, doc.y, 495, 20).fill();
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => { doc.text(h, x, doc.y - 15, { width: widths[i] }); x += widths[i]; });
    doc.moveDown(0.5);

    students.forEach((s, idx) => {
      const y = doc.y;
      if (idx % 2 === 0) doc.fillColor('#f5f5f5').rect(50, y - 3, 495, 20).fill();
      doc.fillColor('#333').font('Helvetica').fontSize(9);
      x = 50;
      [idx + 1, s.admissionNumber, s.name, '', '', '', '', ''].forEach((v, i) => {
        doc.text(String(v), x, y, { width: widths[i] });
        x += widths[i];
      });
      doc.moveTo(50, y + 17).lineTo(545, y + 17).stroke('#ddd');
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Hall ticket PDF
const getHallTicket = async (req, res) => {
  try {
    const { examId, studentId } = req.params;
    const exam = await Exam.findOne({ _id: examId, school: req.user.school })
      .populate('schedule.subject', 'name')
      .populate('schedule.class', 'name section');
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    const student = await Student.findOne({ _id: studentId, school: req.user.school })
      .populate('currentClass', 'name section');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const school = await School.findById(req.user.school);

    // Build schedule rows for this student's class
    const classId = student.currentClass?._id?.toString();
    const scheduleRows = exam.schedule
      .filter(s => (s.class?._id || s.class)?.toString() === classId)
      .map(s => ({
        subjectName: s.subject?.name || 'Unknown',
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room
      }))
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const studentData = {
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      className: student.currentClass?.name,
      section: student.currentClass?.section
    };

    const pdf = await generateHallTicket(studentData, exam.toObject(), scheduleRows, school.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=HallTicket_${student.admissionNumber}.pdf`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getExamById, createExam, getExams, updateExam, deleteExam, enterMarks, publishResults, getResults, getResultCardPDF, getAwardList, uploadAnswerPaper, getHallTicket };
