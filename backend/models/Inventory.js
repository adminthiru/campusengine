const mongoose = require('mongoose');

// School asset / inventory item. Tracks individually-managed assets (computers,
// lab equipment, furniture, projectors, etc.) through their lifecycle, including
// a full repair history with optional links to repairman visits (Visits module).
const repairSchema = new mongoose.Schema({
  issue: { type: String },
  quantity: { type: Number, default: 1 },   // how many units of the item are under this repair
  reportedDate: { type: Date, default: Date.now },
  expectedDate: { type: Date },   // expected date the item comes back from repair
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  technicianName: { type: String },
  technicianPhone: { type: String },
  technicianDesignation: { type: String },
  linkedVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }, // repairman's gate visit
  cost: { type: Number },
  resolutionNotes: { type: String },
  completedDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const inventoryItemSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  itemCode: { type: String, required: true }, // auto "INV0001"
  name: { type: String, required: true },
  // asset = individually-tracked unit (qty 1, lifecycle/status/repair per item);
  // consumable = stock item that carries a quantity (markers, chalk, paper…).
  type: { type: String, enum: ['asset', 'consumable'], default: 'asset' },
  category: { type: String },   // configurable per school
  location: { type: String },   // configurable per school (Computer Lab, Science Lab...)
  serialNumber: { type: String },
  assetTag: { type: String },
  quantity: { type: Number, default: 1 },
  purchaseDate: { type: Date },
  purchasePrice: { type: Number },
  vendor: { type: String },
  warrantyExpiry: { type: Date },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // staff responsible
  status: {
    type: String,
    enum: ['in_use', 'in_storage', 'in_repair', 'damaged', 'disposed', 'lost', 'purchase_requested'],
    default: 'in_use'
  },
  remarks: { type: String },
  repairs: [repairSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

inventoryItemSchema.index({ school: 1, createdAt: -1 });
inventoryItemSchema.index({ school: 1, itemCode: 1 }, { unique: true });
inventoryItemSchema.index({ school: 1, status: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
