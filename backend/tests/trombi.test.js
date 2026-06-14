require('./setup');

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { getExportDir } = require('../src/utils/fileHelper');

const mockClass = {
  id: 1,
  label: 'BTS SIO',
  year: '2024',
  createdAt: new Date(),
  students: [
    { id: 1, firstName: 'Alice', lastName: 'Dupont', email: 'alice@test.com', photoUrl: null, classId: 1 },
    { id: 2, firstName: 'Bob', lastName: 'Martin', email: 'bob@test.com', photoUrl: null, classId: 1 },
  ],
};

function snapshotExportDir() {
  const dir = getExportDir();
  return fs.existsSync(dir) ? new Set(fs.readdirSync(dir)) : new Set();
}

function cleanNewExportFiles(before) {
  const dir = getExportDir();
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    if (!before.has(f)) fs.unlinkSync(path.join(dir, f));
  });
}

describe('Trombi Generation API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when format is invalid', async () => {
    const res = await request(app)
      .get('/api/trombi?class_id=1&format=docx')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(400);
  });

  it('returns 400 when class_id is missing', async () => {
    const res = await request(app)
      .get('/api/trombi?format=html')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(400);
  });

  it('returns 400 when format is missing', async () => {
    const res = await request(app)
      .get('/api/trombi?class_id=1')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(400);
  });

  it('returns 404 when class does not exist', async () => {
    prisma.class.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/trombi?class_id=999&format=html')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(404);
  });

  // ─── HTML generation ─────────────────────────────────────────────────────────

  it('generates HTML trombinoscope (status 200)', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/trombi?class_id=1&format=html')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);

    cleanNewExportFiles(before);
  });

  it('HTML export contains class label and student names', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/trombi?class_id=1&format=html')
      .set('Authorization', global.teacherAuth);

    expect(res.status).toBe(200);
    expect(res.text).toContain('BTS SIO');
    expect(res.text).toContain('Alice');
    expect(res.text).toContain('Dupont');
    expect(res.text).toContain('Bob');
    expect(res.text).toContain('Martin');

    cleanNewExportFiles(before);
  });

  it('HTML export contains RGPD footer text', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/trombi?class_id=1&format=html')
      .set('Authorization', global.teacherAuth);

    expect(res.status).toBe(200);
    expect(res.text).toContain('footer');

    cleanNewExportFiles(before);
  });

  it('HTML export records the export in the database', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    await request(app)
      .get('/api/trombi?class_id=1&format=html')
      .set('Authorization', global.adminAuth);

    expect(prisma.export.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ format: 'html', classId: 1 }) })
    );

    cleanNewExportFiles(before);
  });

  // ─── PDF generation ──────────────────────────────────────────────────────────

  it('generates PDF trombinoscope (status 200)', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/trombi?class_id=1&format=pdf')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);

    cleanNewExportFiles(before);
  });

  it('PDF file is non-empty on disk (fichier non vide)', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/trombi?class_id=1&format=pdf')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(200);

    const exportDir = getExportDir();
    const after = fs.readdirSync(exportDir);
    const newPdfs = after.filter((f) => !before.has(f) && f.endsWith('.pdf'));
    expect(newPdfs).toHaveLength(1);

    const pdfPath = path.join(exportDir, newPdfs[0]);
    const stat = fs.statSync(pdfPath);
    expect(stat.size).toBeGreaterThan(0);

    const header = Buffer.alloc(4);
    const fd = fs.openSync(pdfPath, 'r');
    fs.readSync(fd, header, 0, 4, 0);
    fs.closeSync(fd);
    expect(header.toString('ascii')).toBe('%PDF');

    cleanNewExportFiles(before);
  });

  it('PDF export records the export in the database', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    await request(app)
      .get('/api/trombi?class_id=1&format=pdf')
      .set('Authorization', global.adminAuth);

    expect(prisma.export.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ format: 'pdf', classId: 1 }) })
    );

    cleanNewExportFiles(before);
  });

  it('teacher can also generate trombi', async () => {
    const before = snapshotExportDir();
    prisma.class.findUnique.mockResolvedValue(mockClass);
    prisma.export.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/trombi?class_id=1&format=html')
      .set('Authorization', global.teacherAuth);

    expect(res.status).toBe(200);
    cleanNewExportFiles(before);
  });
});
