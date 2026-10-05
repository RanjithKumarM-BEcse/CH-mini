const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const Folder = require('../models/Folder');

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
    const { q, status } = req.query;
    let query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (q) {
      query.$or = [
        { studentName: { $regex: q, $options: 'i' } },
        { courseName: { $regex: q, $options: 'i' } },
        { fileName: { $regex: q, $options: 'i' } }
      ];
    }

    const certificates = await Certificate.find(query).sort({ uploadDate: -1 });
    res.json(certificates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch certificates', details: err.message });
  }
});

// POST create / scan new certificate
router.post('/', async (req, res) => {
  try {
    const { studentName, courseName, fileName, folderId, folderName, status, reason, aiMatchConfidence } = req.body;
    
    if (!studentName || !courseName) {
      return res.status(400).json({ error: 'Student Name and Course Name are required' });
    }

    const cert = new Certificate({
      studentName,
      courseName,
      fileName: fileName || `${studentName.replace(/\s+/g, '_')}_Cert.pdf`,
      folderId: folderId || 'General',
      folderName: folderName || 'Connected Drive',
      status: status || 'Verified',
      aiMatchConfidence: aiMatchConfidence || (status === 'Suspicious' ? '45%' : '98%'),
      reason: reason || (status === 'Suspicious' ? 'Student name discrepancy detected against verification link.' : 'Verified by AI matching registry.'),
      uploadDate: new Date()
    });

    await cert.save();

    // Update folder counts if folder exists
    if (folderName) {
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
