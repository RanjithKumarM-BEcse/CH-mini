const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: { type: String, default: 'default' },
  name: { type: String, required: true },
  driveFolderId: { type: String },
  status: { type: String, enum: ['Synced', 'Syncing', 'Pending', 'Error'], default: 'Synced' },
  verifiedCount: { type: Number, default: 0 },
  suspiciousCount: { type: Number, default: 0 },
  lastSync: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Folder', folderSchema);
