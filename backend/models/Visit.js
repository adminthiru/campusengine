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

  // A built-in purpose slug (admission_enquiry, …) OR a school-defined custom
  // category string. Not an enum so custom categories are allowed.
  purpose: { type: String, default: 'other' },
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

  // Current pending follow-up (cleared once completed; can be set again later).
  followUpRequired: { type: Boolean, default: false },
  followUpDate: { type: Date },

  // Chronological log of everything that happened on this visit: check-in,
  // check-out, follow-up scheduled, follow-up completed, repeat check-in, notes.
  activities: [{
    type: { type: String, enum: ['check_in', 'check_out', 'follow_up_set', 'follow_up_completed', 'note'], required: true },
    note: { type: String },                    // reason / outcome text
    followUpDate: { type: Date },              // for follow_up_set events
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  }],

  outcome: { type: String },                   // result / what happened
  remarks: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

visitSchema.index({ school: 1, checkInTime: -1 });
visitSchema.index({ school: 1, phone: 1 });

module.exports = mongoose.model('Visit', visitSchema);
