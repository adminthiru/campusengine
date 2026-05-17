const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },
  code: { type: String },
  type: { type: String, enum: ['theory', 'practical', 'both'], default: 'theory' },
  maxMarks: { type: Number, default: 100 },
  passingMarks: { type: Number, default: 35 },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  color: { type: String, default: '#4F46E5' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

subjectSchema.pre('save', function() {
  if (this.code === '' || this.code === null) this.code = undefined;
});

subjectSchema.index(
  { school: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);

module.exports = mongoose.model('Subject', subjectSchema);
