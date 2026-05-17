const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  relation: { type: String, enum: ['father', 'mother', 'guardian', 'other'], required: true },
  email: { type: String },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  occupation: { type: String },
  income: { type: Number },
  aadharNumber: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  photo: { type: String },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  language: { type: String, enum: ['en', 'ta'], default: 'en' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Parent', parentSchema);
