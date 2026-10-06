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
    const { q, status } = req.query;
    let query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (q) {
      query.$or = [
        { studentName: { $regex: q, $options: 'i' } },
        { courseName: { $regex: q, $options: 'i' } },
        { fileName: { $regex: q, $options: 'i' } },
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

// POST load sample test batch for demo
router.post('/demo', async (req, res) => {
  try {
    const demoItems = [
      {
        studentName: 'Ranjith Kumar M',
        courseName: 'Infosys Springboard - Python Foundation',
        fileName: 'Ranjith_Kumar_Infosys_Cert.pdf',
        extracted_name_on_cert: 'Ranjith Kumar M',
        extracted_name_on_website: 'Ranjith Kumar M',
        verification_url: 'https://verify.springboard.infosys.com/cert/SPB-849201',
        is_match: true,
        status: 'Verified',
        reason: 'Genuine: Name on certificate matches the student name on the official Infosys Springboard verification registry.'
      },
      {
        studentName: 'Praveen S',
        courseName: 'Infosys Springboard - Cloud & DevOps',
        fileName: 'Praveen_Cloud_Assignment.jpg',
        extracted_name_on_cert: 'Praveen S',
        extracted_name_on_website: 'Karthik S',
        verification_url: 'https://verify.springboard.infosys.com/cert/SPB-310948',
        is_match: false,
        status: 'Suspicious',
        reason: 'Fake / Mismatch: Certificate displays student name "Praveen S", but the official verification link belongs to "Karthik S". Name was edited.'
      },
      {
        studentName: 'Ananya Sharma',
        courseName: 'Infosys Springboard - Artificial Intelligence Primer',
        fileName: 'Ananya_AI_Certificate.png',
        extracted_name_on_cert: 'Ananya Sharma',
        extracted_name_on_website: 'Ananya Sharma',
        verification_url: 'https://verify.springboard.infosys.com/cert/SPB-592014',
        is_match: true,
        status: 'Verified',
        reason: 'Genuine: Student name matches the official verification registry.'
      }
    ];

    const created = await Certificate.insertMany(demoItems);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load demo data', details: err.message });
  }
});

// POST Batch Scan (Direct file base64 uploads)
router.post('/scan-batch', async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one certificate file to scan' });
    }

    const results = [];

    for (const item of files) {
      try {
        const evalResult = await verifyCertificateWithAI(item.base64, item.name || 'certificate.jpg');

        const cert = new Certificate({
          studentName: evalResult.studentName || evalResult.extracted_name_on_cert || item.name.replace(/\.[^/.]+$/, ''),
          courseName: evalResult.courseName || 'Infosys Springboard Assignment',
          platform: 'Infosys Springboard',
          fileName: item.name || 'certificate.jpg',
          extracted_name_on_cert: evalResult.extracted_name_on_cert,
          extracted_name_on_website: evalResult.extracted_name_on_website,
          verification_url: evalResult.verification_url || '',
          is_match: Boolean(evalResult.is_match),
          status: evalResult.status || (evalResult.is_match ? 'Verified' : 'Suspicious'),
          aiMatchConfidence: evalResult.aiMatchConfidence || '95%',
          reason: evalResult.reason,
          uploadDate: new Date()
        });

        await cert.save();
        results.push(cert);
      } catch (fileErr) {
        console.error('Error scanning file:', item.name, fileErr.message);
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Batch scan failed', details: err.message });
  }
});

// POST single certificate
router.post('/', async (req, res) => {
  try {
    const { 
      studentName, courseName, fileName, 
      status, reason, aiMatchConfidence, imageBase64 
    } = req.body;

    let evalResult = null;
    if (imageBase64) {
      evalResult = await verifyCertificateWithAI(imageBase64, fileName || 'cert.jpg');
    }

    const finalStudentName = evalResult?.studentName || studentName || 'Student';
    const isMatch = evalResult ? evalResult.is_match : (status === 'Verified');
    const finalStatus = evalResult ? evalResult.status : (status || 'Verified');

    const cert = new Certificate({
      studentName: finalStudentName,
      courseName: evalResult?.courseName || courseName || 'Infosys Springboard Assignment',
      platform: 'Infosys Springboard',
      fileName: fileName || `${finalStudentName.replace(/\s+/g, '_')}_Certificate.pdf`,
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
    res.status(201).json(cert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create certificate', details: err.message });
  }
});

// DELETE all certificates (Reset batch)
router.delete('/clear-all', async (req, res) => {
  try {
    await Certificate.deleteMany({});
    res.json({ message: 'All certificate records cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear certificates' });
  }
});

// DELETE single certificate
router.delete('/:id', async (req, res) => {
  try {
    await Certificate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Certificate removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete certificate', details: err.message });
  }
});

module.exports = router;
