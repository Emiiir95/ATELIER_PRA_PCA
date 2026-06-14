const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const studentController = require('../controllers/studentController');
const { authenticate, requireTeacherOrAdmin } = require('../middlewares/auth');

router.get('/', authenticate, requireTeacherOrAdmin, classController.listPromos);

router.get('/:year/classes', authenticate, requireTeacherOrAdmin, (req, res, next) => {
  req.query.year = req.params.year;
  return classController.getAll(req, res, next);
});

router.get('/:year/students', authenticate, requireTeacherOrAdmin, (req, res, next) => {
  req.query.year = req.params.year;
  return studentController.getAll(req, res, next);
});

module.exports = router;
