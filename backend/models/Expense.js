const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['furniture', 'electronics', 'maintenance', 'stationery', 'transport', 'utilities', 'salary', 'events', 'other'],
    required: true
  },
  vendor: { type: String },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'online'] },
  billNumber: { type: String },
  billDocument: { type: String },
  description: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  academicYear: { type: String }
}, { timestamps: true });

const transportSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  vehicleType: { type: String, enum: ['bus', 'van', 'car', 'auto', 'bike', 'other'], default: 'bus' },
  routeName: { type: String, required: true },
  routeNumber: { type: String },
  vehicleNumber: { type: String },
  driverName: { type: String },
  driverPhone: { type: String },
  conductorName: { type: String },
  conductorPhone: { type: String },
  routeDescription: { type: String },
  capacity: { type: Number },
  stops: [{
    name: String,
    time: String,
    fee: Number,
    latitude: Number,
    longitude: Number
  }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Expense = mongoose.model('Expense', expenseSchema);
const Transport = mongoose.model('Transport', transportSchema);

module.exports = { Expense, Transport };
