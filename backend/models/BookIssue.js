const mongoose = require('mongoose');

const renewalRequestSchema = new mongoose.Schema({
  requestedAt: { type: Date, default: Date.now },
  newDueDate:  { type: Date },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  note:        { type: String },
});

const bookIssueSchema = new mongoose.Schema({
  school:       { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  book:         { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  borrowerType: { type: String, enum: ['student', 'employee'], required: true },
  student:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  issueDate:    { type: Date, default: Date.now },
  dueDate:      { type: Date, required: true },
  returnDate:   { type: Date },
  status:       { type: String, enum: ['issued', 'returned', 'overdue', 'lost', 'damaged'], default: 'issued' },
  fine:         { type: Number, default: 0 },
  finePaid:     { type: Boolean, default: false },
  renewalRequests: [renewalRequestSchema],
  issuedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  returnedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:       { type: String },
}, { timestamps: true });

bookIssueSchema.index({ school: 1, book: 1, status: 1 });
bookIssueSchema.index({ school: 1, student: 1 });
bookIssueSchema.index({ school: 1, employee: 1 });

module.exports = mongoose.model('BookIssue', bookIssueSchema);
