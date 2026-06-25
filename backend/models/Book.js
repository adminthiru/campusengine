const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  school:          { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  title:           { type: String, required: true, trim: true },
  author:          { type: String, required: true, trim: true },
  isbn:            { type: String, trim: true },
  category:        { type: String, trim: true },
  publisher:       { type: String, trim: true },
  year:            { type: Number },
  price:           { type: Number },               // unit price of the book (₹)
  totalCopies:     { type: Number, default: 1 },
  availableCopies: { type: Number, default: 1 },
  location:        { type: String, trim: true },   // shelf / rack
  description:     { type: String, trim: true },
  status:          { type: String, enum: ['available', 'unavailable'], default: 'available' },
}, { timestamps: true });

bookSchema.index({ school: 1, isbn: 1 });
bookSchema.index({ school: 1, title: 1 });

module.exports = mongoose.model('Book', bookSchema);
