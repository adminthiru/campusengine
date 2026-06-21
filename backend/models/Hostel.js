const mongoose = require('mongoose');

// A hostel block (e.g. "Boys Hostel — A Block"). Capacity is derived from its
// rooms, so it is not stored here.
const hostelSchema = new mongoose.Schema({
  school:        { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name:          { type: String, required: true, trim: true },
  type:          { type: String, enum: ['boys', 'girls', 'mixed'], required: true },
  block:         { type: String, trim: true },        // building / block
  totalFloors:   { type: Number, default: 1 },
  contactNumber: { type: String, trim: true },
  status:        { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

hostelSchema.index({ school: 1, name: 1 });

module.exports = mongoose.model('Hostel', hostelSchema);
