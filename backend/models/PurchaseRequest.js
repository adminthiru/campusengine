const mongoose = require('mongoose');

// A procurement request: a list of items the school needs to buy. Created as
// 'pending'; once purchased the admin enters actual prices and marks it
// 'received', which auto-creates the inventory units and books an expense.
const prItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  location: { type: String },
  quantity: { type: Number, default: 1 },
  estimatedPrice: { type: Number },
  actualPrice: { type: Number },
}, { _id: true });

const purchaseRequestSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  requestNumber: { type: String, required: true },   // auto "PR0001"
  title: { type: String },
  status: { type: String, enum: ['pending', 'ordered', 'received', 'cancelled'], default: 'pending' },
  type: { type: String, enum: ['asset', 'consumable'], default: 'asset' }, // what's being procured
  category: { type: String },   // shared across the request's items
  location: { type: String },
  vendor: { type: String },
  expectedDate: { type: Date },
  notes: { type: String },
  items: [prItemSchema],
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedAt: { type: Date },
  // What the receive created — used to cleanly reverse an accidental receive
  createdItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  expenseRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
  // When this request replaces a damaged asset: on receive, that asset is
  // revived to 'in_use' instead of creating a new unit.
  replacesItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
}, { timestamps: true });

purchaseRequestSchema.index({ school: 1, createdAt: -1 });
purchaseRequestSchema.index({ school: 1, requestNumber: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseRequest', purchaseRequestSchema);
