const express = require('express');
const router = express.Router();
const trombiController = require('../controllers/trombiController');
const { authenticate, requireTeacherOrAdmin } = require('../middlewares/auth');

router.get('/', authenticate, requireTeacherOrAdmin, trombiController.generate);

module.exports = router;
