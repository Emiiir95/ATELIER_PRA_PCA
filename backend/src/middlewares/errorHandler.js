const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({ error: 'Bad Request', message: err.message });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not Found', message: 'Resource not found' });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Conflict', message: 'A record with this value already exists' });
  }

  if (err.code === 'P2003') {
    return res.status(409).json({ error: 'Conflict', message: 'Cannot delete: related records exist' });
  }

  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Payload Too Large', message: 'File size exceeds the allowed limit' });
  }

  const status = err.statusCode || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message;
  return res.status(status).json({ error: message });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFound };
