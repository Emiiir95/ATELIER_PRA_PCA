const classService = require('../services/classService');

async function getAll(req, res, next) {
  try {
    const { year } = req.query;
    const classes = await classService.getAllClasses({ year });
    res.json(classes);
  } catch (err) {
    next(err);
  }
}

async function listPromos(_req, res, next) {
  try {
    const promos = await classService.getPromos();
    res.json(promos);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const cls = await classService.getClassById(Number(req.params.id));
    res.json(cls);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const cls = await classService.createClass(req.body);
    res.status(201).json(cls);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const cls = await classService.updateClass(Number(req.params.id), req.body);
    res.json(cls);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await classService.deleteClass(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, listPromos, getOne, create, update, remove };
