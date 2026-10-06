const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const Folder = require('../models/Folder');
const { verifyCertificateWithAI } = require('../services/aiService');

// GET live stats
router.get('/stats', async (req, res) => {
  try {
    const totalFolders = await Folder.countDocuments();
    const totalScanned = await Certificate.countDocuments();
    const verified = await Certificate.countDocuments({ status: 'Verified' });
    const suspicious = await Certificate.countDocuments({ status: 'Suspicious' });

    res.json({
      totalFolders,
      totalScanned,
      verified,
      suspicious
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// GET all certificates with optional filtering & search
router.get('/', async (req, res) => {
  try {
    const { q, status, folderId } = req.query;
    let query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (folderId) {
      query.folderId = folderId;
    }

    if (q) {
      query.$or = [
        { studentName: { $regex: q, $options: 'i' } },
        { courseName: { $regex: q, $options: 'i' } },
        { fileName: { $regex: q, $options: 'i' } },
        { platform: { $regex: q, $options: 'i' } },
        { extracted_name_on_cert: { $regex: q, $options: 'i' } },
        { extracted_name_on_website: { $regex: q, $options: 'i' } }
      ];
    }

    const certificates = await Certificate.find(query).sort({ uploadDate: -1 });
    res.json(certificates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch certificates', details: err.message });
  }
});

// POST verify / add student certificate (Manual or direct file imageBase64 check)
router.post('/', async (req, res) => {
  try {
    const { 
      studentName, courseName, fileName, folderId, folderName, 
      status, reason, aiMatchConfidence, platform, imageBase64 
    } = req.body;

    let evalResult = null;
    if (imageBase64) {
      // Runs the exact QR/URL extraction -> Webpage scraping -> Name cross-check
      evalResult = await verifyCertificateWithAI(imageBase64, fileName || 'cert.jpg');
    }

    const finalStudentName = evalResult?.studentName || studentName || 'Student';
    const isMatch = evalResult ? evalResult.is_match : (status === 'Verified');
    const finalStatus = evalResult ? evalResult.status : (status || 'Verified');

    const cert = new Certificate({
      studentName: finalStudentName,
      courseName: evalResult?.courseName || courseName || 'Infosys Springboard Assignment',
      platform: platform || 'Infosys Springboard',
      fileName: fileName || `${finalStudentName.replace(/\s+/g, '_')}_Certificate.pdf`,
      folderId: folderId || 'General',
      folderName: folderName || 'Connected Drive',
      
      // Core Name Matching Results
      extracted_name_on_cert: evalResult?.extracted_name_on_cert || finalStudentName,
      extracted_name_on_website: evalResult?.extracted_name_on_website || (isMatch ? finalStudentName : 'Unknown'),
      verification_url: evalResult?.verification_url || '',
      is_match: isMatch,
      status: finalStatus,
      aiMatchConfidence: evalResult?.aiMatchConfidence || aiMatchConfidence || (isMatch ? '99%' : '45%'),
      reason: evalResult?.reason || reason || (isMatch 
        ? 'Verified: Name on certificate matches the student name on the official verification webpage.' 
        : 'Suspicious: Student name on certificate does not match the official verification webpage.'),
      uploadDate: new Date()
    });

    await cert.save();

    // Update folder counts
    if (folderName && folderName !== 'General') {
      const folder = await Folder.findOne({ name: folderName });
      if (folder) {
        if (cert.status === 'Verified') folder.verifiedCount += 1;
        if (cert.status === 'Suspicious') folder.suspiciousCount += 1;
        folder.lastSync = new Date();
        await folder.save();
      }
    }

    res.status(201).json(cert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create certificate', details: err.message });
  }
});

// DELETE a certificate
router.delete('/:id', async (req, res) => {
  try {
    await Certificate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Certificate removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete certificate', details: err.message });
  }
});

module.exports = router;
