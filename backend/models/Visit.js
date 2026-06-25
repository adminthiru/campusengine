const mongoose = require('mongoose');

// Front-desk visitor / enquiry log. Tracks everyone who walks in — admission
// enquiries, uniform/book vendors, parent meetings, complaints, etc. — so the
// admin can capture contact details, reason, who handled it, and follow-ups.
const visitSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },

  visitorName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  numberOfVisitors: { type: Number, default: 1 },

  purpose: {
    type: String,
    enum: [
      'admission_enquiry', 'fee_enquiry', 'fee_payment', 'uniform',
      'books_stationery', 'vendor_supplier', 'parent_meeting',
      'staff_meeting', 'complaint', 'document_collection', 'repair', 'other'
    ],
    default: 'other'
  },
  purposeDetail: { type: String },             // free-text reason / notes

  relatedStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, // if it concerns an existing student
  attendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },    // staff who handled the visit

  status: {
    type: String,
    enum: ['waiting', 'in_progress', 'completed', 'cancelled'],
    default: 'waiting'
  },
  checkInTime: { type: Date, default: Date.now },
  checkOutTime: { type: Date },

  followUpRequired: { type: Boolean, default: false },
  followUpDate: { type: Date },
  followUpCompleted: { type: Boolean, default: false },
  followUpCompletedAt: { type: Date },
  followUpOutcome: { type: String },           // what happened on the follow-up

  outcome: { type: String },                   // result / what happened
  remarks: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

visitSchema.index({ school: 1, checkInTime: -1 });
visitSchema.index({ school: 1, phone: 1 });

module.exports = mongoose.model('Visit', visitSchema);
