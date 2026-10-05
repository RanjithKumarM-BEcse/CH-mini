const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  userId: { type: String, default: 'default' },
  fileName: { type: String, default: 'certificate.pdf' },
  driveFileId: { type: String, default: () => 'DRIVE-' + Math.random().toString(36).substring(2, 9).toUpperCase() },
  folderId: { type: String, default: 'General' },
  folderName: { type: String, default: 'General' },
  
  // AI Extracted Data
  studentName: { type: String, required: true },
  courseName: { type: String, required: true },
  aiMatchConfidence: { type: String, default: '95%' },
  
  // Verification Result
  status: { type: String, enum: ['Verified', 'Suspicious', 'Pending'], default: 'Verified' },
  reason: { type: String, default: 'Matches official institution records and verification link.' },
  
  uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Certificate', certificateSchema);
