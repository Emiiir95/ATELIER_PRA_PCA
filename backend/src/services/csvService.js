const { parse } = require('csv-parse/sync');
const prisma = require('../config/prisma');
const { findOrCreateClass } = require('./classService');

async function importStudents(buffer) {
  const raw = buffer.toString('utf-8');
  const delimiter = raw.indexOf(';') !== -1 ? ';' : ',';

  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    bom: true,
  });

  let created = 0;
  let errors = 0;
  const details = [];

  for (const record of records) {
    const { first_name, last_name, email, class_label, year, photo_url } = record;

    // Validate required fields
    if (!first_name || !last_name || !email || !class_label || !year) {
      errors++;
      details.push({
        row: record,
        error: 'Missing required fields: first_name, last_name, email, class_label, year',
      });
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors++;
      details.push({ row: record, error: `Invalid email: ${email}` });
      continue;
    }

    try {
      const cls = await findOrCreateClass(class_label.trim(), year.trim());

      const photoUrl = photo_url?.trim() || null;

      await prisma.student.upsert({
        where: { email: email.trim().toLowerCase() },
        update: {
          firstName: first_name.trim(),
          lastName: last_name.trim(),
          classId: cls.id,
          ...(photoUrl ? { photoUrl } : {}),
        },
        create: {
          firstName: first_name.trim(),
          lastName: last_name.trim(),
          email: email.trim().toLowerCase(),
          classId: cls.id,
          photoUrl,
        },
      });

      created++;
      details.push({ row: record, status: 'created' });
    } catch (err) {
      errors++;
      details.push({ row: record, error: err.message });
    }
  }

  return { created, errors, details };
}

module.exports = { importStudents };
