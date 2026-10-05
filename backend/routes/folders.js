const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const Certificate = require('../models/Certificate');

// GET all folders
router.get('/', async (req, res) => {
  try {
    const folders = await Folder.find().sort({ createdAt: -1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch folders', details: err.message });
  }
});

// POST connect a new folder
router.post('/', async (req, res) => {
  try {
    const { name, driveFolderId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = new Folder({
      name,
      driveFolderId: driveFolderId || ('DRV-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
      status: 'Synced',
      verifiedCount: 0,
      suspiciousCount: 0,
      lastSync: new Date()
    });

    await folder.save();
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect folder', details: err.message });
  }
});

// DELETE disconnect folder
router.delete('/:id', async (req, res) => {
  try {
    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete folder', details: err.message });
  }
});

module.exports = router;
