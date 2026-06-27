const mongoose = require('mongoose');

// Persistent file storage in the database. Used for files that must survive
// server restarts/redeploys — Render's filesystem is ephemeral, so anything
// written to /uploads at runtime is lost. Answer-paper PDFs live here.
const uploadSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  originalName: { type: String },
  contentType: { type: String },
  size: { type: Number },
  data: { type: Buffer, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);
