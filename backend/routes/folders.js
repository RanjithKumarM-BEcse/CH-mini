const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const Certificate = require('../models/Certificate');
const { scanDriveFolder, extractFolderId } = require('../services/driveService');

// GET all folders
router.get('/', async (req, res) => {
  try {
    const folders = await Folder.find().sort({ createdAt: -1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch folders', details: err.message });
  }
});

// POST connect a new Google Drive folder
router.post('/', async (req, res) => {
  try {
    const { name, driveFolderId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const cleanFolderId = extractFolderId(driveFolderId);

    const folder = new Folder({
      name,
      driveFolderId: cleanFolderId || driveFolderId || ('DRV-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
      status: 'Synced',
      verifiedCount: 0,
      suspiciousCount: 0,
      lastSync: new Date()
    });

    await folder.save();

    // Trigger immediate background scan if valid drive link is supplied
    if (cleanFolderId) {
      scanDriveFolder(folder).catch(err => console.warn('Background scan warning:', err.message));
    }

    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect folder', details: err.message });
  }
});

// POST trigger scan on an existing folder
router.post('/:id/scan', async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const result = await scanDriveFolder(folder);
    res.json({ message: 'Scan completed successfully', result });
  } catch (err) {
    res.status(500).json({ error: 'Folder scan failed', details: err.message });
  }
});

// DELETE disconnect folder
router.delete('/:id', async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (folder) {
      // Clean up linked certificates if desired
      await Certificate.deleteMany({ folderId: folder._id.toString() });
      await Folder.findByIdAndDelete(req.params.id);
    }
    res.json({ message: 'Folder disconnected and cleaned up successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete folder', details: err.message });
  }
});

module.exports = router;
