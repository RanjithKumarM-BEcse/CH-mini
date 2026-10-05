const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  driveFileId: { type: String, required: true },
  folderId: { type: String, required: true },
  
  // AI Extracted Data
  studentName: { type: String },
  courseName: { type: String },
  aiMatchConfidence: { type: String },
  
  // Verification Result
  status: { type: String, enum: ['Verified', 'Suspicious', 'Pending'], default: 'Pending' },
  reason: { type: String }, // Explanation from AI if suspicious
  
  uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Certificate', certificateSchema);
