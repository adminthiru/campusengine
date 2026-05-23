const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., "Mid Term Exam"
  academicYear: { type: String, required: true },
  examDate: { type: Date },
  type: { type: String },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  schedule: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    date: Date,
    startTime: String,
    endTime: String,
    room: String,
    invigilator: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    maxMarks: Number,
    passingMarks: Number
  }],
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
  isResultPublished: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Exam Results
const examResultSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String },
  marks: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    theoryMarks: { type: Number },
    practicalMarks: { type: Number },
    totalMarks: { type: Number },
    maxMarks: { type: Number },
    passingMarks: { type: Number },
    grade: String,
    remarks: String,
    isAbsent: { type: Boolean, default: false },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answerPaper: {
      url: String,
      fileName: String,
      uploadedAt: Date,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  }],
  totalMarksObtained: { type: Number },
  totalMaxMarks: { type: Number },
  percentage: { type: Number },
  grade: { type: String },
  rank: { type: Number },
  attendance: { type: Number },
  teacherRemarks: { type: String },
  isPublished: { type: Boolean, default: false }
}, { timestamps: true });

examResultSchema.index({ school: 1, exam: 1, student: 1 }, { unique: true });

const Exam = mongoose.model('Exam', examSchema);
const ExamResult = mongoose.model('ExamResult', examResultSchema);

module.exports = { Exam, ExamResult };
