const trombiService = require('../services/trombiService');

async function generate(req, res, next) {
  try {
    const { class_id, format, return: returnMode } = req.query;

    if (!class_id || isNaN(parseInt(class_id, 10))) {
      return res.status(400).json({ error: 'Bad Request', message: '"class_id" must be a valid integer' });
    }

    if (!format || !['html', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Bad Request', message: '"format" must be "html" or "pdf"' });
    }

    const { filePath, exportPath, cls } = await trombiService.generateTrombi(
      parseInt(class_id, 10),
      format,
      req.user?.id ?? null
    );

    const filename = `trombinoscope_${cls.label}_${cls.year}.${format}`;

    if (returnMode === 'url') {
      return res.json({
        url: exportPath,
        format,
        filename,
        class: { id: cls.id, label: cls.label, year: cls.year },
      });
    }

    const contentType = format === 'pdf' ? 'application/pdf' : 'text/html';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

module.exports = { generate };
