require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB (Vercel caches connections globally to prevent connection spikes)
let isConnected;
const connectDB = async () => {
  if (isConnected) return;
  
  if (!process.env.MONGO_URI) {
    console.error('CRITICAL: MONGO_URI is completely missing from Vercel Environment Variables!');
  } else {
    console.log('Attempting to connect to MongoDB with URI starting with:', process.env.MONGO_URI.substring(0, 15) + '...');
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    isConnected = db.connections[0].readyState;
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};

// Middleware to ensure DB connection on every API hit MUST BE BEFORE ROUTES
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

const authRoutes = require('../routes/auth');

// Basic Routes
app.get('/', (req, res) => {
  res.send('CertifyHub Backend is running! Access the API at /api');
});

app.get('/api', (req, res) => {
  res.send('CertifyHub Backend API is running on Vercel Serverless');
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Vercel Cron Job Endpoint (Replaces node-cron)
app.get('/api/cron', async (req, res) => {
  console.log('[Cron] Polling Google Drive for new certificates...');
  // Logic to fetch from Google Drive and send to OpenAI goes here
  
  res.status(200).send('Cron job executed successfully');
});

// Export the Express API for Vercel (Do not call app.listen)
module.exports = app;
