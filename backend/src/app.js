require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');
const trombiRoutes = require('./routes/trombiRoutes');
const promoRoutes = require('./routes/promoRoutes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/exports', express.static(path.join(__dirname, '../exports')));

// Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);

// Spec alias: GET /api/me
const { authenticate } = require('./middlewares/auth');
const authController = require('./controllers/authController');
app.get('/api/me', authenticate, authController.me);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/trombi', trombiRoutes);
app.use('/api/promos', promoRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
