const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  school:      { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  homework:    { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status:      { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  submittedAt: { type: Date },
  note:        { type: String },
  attachments: [{
    url:        { type: String },
    name:       { type: String },
    fileType:   { type: String }, // 'image' or 'pdf'
    uploadedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

submissionSchema.index({ homework: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('HomeworkSubmission', submissionSchema);
