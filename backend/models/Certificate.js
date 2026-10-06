const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  userId: { type: String, default: 'default' },
  fileName: { type: String, required: true },
  driveFileId: { type: String, default: () => 'DRV-' + Math.random().toString(36).substring(2, 9).toUpperCase() },
  driveLink: { type: String },
  folderId: { type: String, default: 'General' },
  folderName: { type: String, default: 'General' },
  
  // Student & Course
  studentName: { type: String, required: true },
  courseName: { type: String, required: true },
  platform: { type: String, default: 'Infosys Springboard' },

  // Core Verification Result (QR / Webpage Name Matching)
  extracted_name_on_cert: { type: String },
  extracted_name_on_website: { type: String },
  verification_url: { type: String },
  is_match: { type: Boolean, default: false },
  
  status: { type: String, enum: ['Verified', 'Suspicious', 'Pending'], default: 'Verified' },
  aiMatchConfidence: { type: String, default: '95%' },
  reason: { type: String },
  
  uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Certificate', certificateSchema);
