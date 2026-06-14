function validateClass(req, res, next) {
  const { label, year } = req.body;

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: '"label" is required and must be a non-empty string' });
  }

  if (!year || typeof year !== 'string' || year.trim().length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: '"year" is required and must be a non-empty string' });
  }

  req.body.label = label.trim();
  req.body.year = year.trim();
  next();
}

function validateStudent(req, res, next) {
  const { firstName, lastName, email, classId } = req.body;

  if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: '"firstName" is required' });
  }

  if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: '"lastName" is required' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Bad Request', message: '"email" must be a valid email address' });
  }

  if (classId !== null && classId !== undefined && classId !== '' && isNaN(parseInt(classId, 10))) {
    return res.status(400).json({ error: 'Bad Request', message: '"classId" must be a valid integer or null' });
  }

  req.body.firstName = firstName.trim();
  req.body.lastName = lastName.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.classId = (classId === null || classId === undefined || classId === '') ? null : parseInt(classId, 10);
  next();
}

function validateId(req, res, next) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'ID must be a positive integer' });
  }
  req.params.id = id;
  next();
}

module.exports = { validateClass, validateStudent, validateId };
