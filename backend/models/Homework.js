const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema({
  school:       { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  class:        { type: mongoose.Schema.Types.ObjectId, ref: 'Class',  required: true },
  subject:      { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  title:        { type: String, required: true },
  description:  { type: String },
  assignedDate: { type: Date, default: Date.now },
  dueDate:      { type: Date, required: true },
  assignedTo:   { type: String, enum: ['all', 'selected'], default: 'all' },
  students:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status:       { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  notifiedAt:   { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Homework', homeworkSchema);
