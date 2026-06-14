const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { validateStudent, validateId } = require('../middlewares/validate');
const { uploadPhoto, uploadCsv } = require('../middlewares/upload');
const { authenticate, requireAdmin, requireTeacherOrAdmin } = require('../middlewares/auth');

// Import CSV — must come before /:id routes
router.post('/import', authenticate, requireAdmin, uploadCsv, studentController.importCsv);

router.get('/', authenticate, requireTeacherOrAdmin, studentController.getAll);
router.get('/:id', authenticate, requireTeacherOrAdmin, validateId, studentController.getOne);
router.post('/', authenticate, requireAdmin, validateStudent, studentController.create);
router.put('/:id', authenticate, requireAdmin, validateId, validateStudent, studentController.update);
router.delete('/:id', authenticate, requireAdmin, validateId, studentController.remove);

// Photo upload — admin only
router.post('/:id/photo', authenticate, requireAdmin, validateId, uploadPhoto, studentController.uploadPhoto);

module.exports = router;
