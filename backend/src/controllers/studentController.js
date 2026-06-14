const studentService = require('../services/studentService');
const csvService = require('../services/csvService');

async function getAll(req, res, next) {
  try {
    const { class_id, year, q } = req.query;
    const students = await studentService.getStudents({ classId: class_id, year, q });
    res.json(students);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const student = await studentService.getStudentById(Number(req.params.id));
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const student = await studentService.createStudent(req.body);
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const student = await studentService.updateStudent(Number(req.params.id), req.body);
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await studentService.deleteStudent(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function uploadPhoto(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bad Request', message: 'No photo file provided' });
    }
    const student = await studentService.uploadPhoto(Number(req.params.id), req.file);
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function importCsv(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bad Request', message: 'No CSV file provided' });
    }
    const result = await csvService.importStudents(req.file.buffer);
    res.status(207).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getOne, create, update, remove, uploadPhoto, importCsv };
