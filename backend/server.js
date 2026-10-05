require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('CertifyHub Backend API is running');
});

// Import Routes (Placeholders)
// const certificateRoutes = require('./routes/certificateRoutes');
// app.use('/api/certificates', certificateRoutes);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/certifyhub')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Simulated Background Task: Poll Google Drive every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log('[Background Task] Polling Google Drive for new certificates...');
  // Logic to fetch from Google Drive and send to OpenAI goes here
});
