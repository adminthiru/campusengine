const mongoose = require('mongoose');

// School-defined custom purpose categories for the Visits module. These extend
// the built-in purpose list shown in the filter and the add/edit dropdowns.
const visitPurposeSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, default: '#64748b' },
  bg: { type: String, default: '#f1f5f9' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

visitPurposeSchema.index({ school: 1, label: 1 }, { unique: true });

module.exports = mongoose.model('VisitPurpose', visitPurposeSchema);
