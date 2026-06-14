const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { validateClass, validateId } = require('../middlewares/validate');
const { authenticate, requireAdmin, requireTeacherOrAdmin } = require('../middlewares/auth');

router.get('/', authenticate, requireTeacherOrAdmin, classController.getAll);
router.get('/:id', authenticate, requireTeacherOrAdmin, validateId, classController.getOne);
router.post('/', authenticate, requireAdmin, validateClass, classController.create);
router.put('/:id', authenticate, requireAdmin, validateId, validateClass, classController.update);
router.delete('/:id', authenticate, requireAdmin, validateId, classController.remove);

module.exports = router;
