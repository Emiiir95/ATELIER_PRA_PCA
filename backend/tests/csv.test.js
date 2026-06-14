require('./setup');

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

describe('CSV Import API', () => {
  beforeEach(() => jest.clearAllMocks());

  const validCsv = Buffer.from(
    'first_name,last_name,email,class_label,year\n' +
    'Alice,Dupont,alice@test.com,BTS SIO,2024\n' +
    'Bob,Martin,bob@test.com,BTS SIO,2024\n'
  );

  const invalidCsv = Buffer.from(
    'first_name,last_name,email,class_label,year\n' +
    ',Dupont,not-an-email,BTS SIO,2024\n'
  );

  // ─── Happy path ──────────────────────────────────────────────────────────────

  it('imports valid CSV successfully (happy path)', async () => {
    const mockClass = { id: 1, label: 'BTS SIO', year: '2024' };
    prisma.class.findFirst.mockResolvedValue(mockClass);
    prisma.student.upsert.mockResolvedValue({});

    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', validCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(207);
    expect(res.body).toMatchObject({ created: 2, errors: 0 });
    expect(res.body.details).toHaveLength(2);
  });

  it('auto-creates class when it does not exist in CSV import', async () => {
    prisma.class.findFirst.mockResolvedValue(null);
    prisma.class.create.mockResolvedValue({ id: 2, label: 'BTS SIO', year: '2024' });
    prisma.student.upsert.mockResolvedValue({});

    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', validCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(207);
    expect(prisma.class.create).toHaveBeenCalled();
    expect(res.body.created).toBe(2);
  });

  // ─── Error cases ─────────────────────────────────────────────────────────────

  it('handles rows with validation errors (missing first_name + bad email)', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', invalidCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(207);
    expect(res.body.errors).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('details');
  });

  it('handles mixed CSV: some valid rows, some invalid rows', async () => {
    const mixedCsv = Buffer.from(
      'first_name,last_name,email,class_label,year\n' +
      'Alice,Dupont,alice@test.com,BTS SIO,2024\n' +
      ',Martin,not-an-email,BTS SIO,2024\n'
    );

    prisma.class.findFirst.mockResolvedValue({ id: 1, label: 'BTS SIO', year: '2024' });
    prisma.student.upsert.mockResolvedValue({});

    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', mixedCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(207);
    expect(res.body.created).toBe(1);
    expect(res.body.errors).toBe(1);
    expect(res.body.details).toHaveLength(2);
  });

  it('handles CSV with semicolon delimiter', async () => {
    const semicolonCsv = Buffer.from(
      'first_name;last_name;email;class_label;year\n' +
      'Alice;Dupont;alice@test.com;BTS SIO;2024\n'
    );

    prisma.class.findFirst.mockResolvedValue({ id: 1, label: 'BTS SIO', year: '2024' });
    prisma.student.upsert.mockResolvedValue({});

    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', semicolonCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(207);
    expect(res.body.created).toBe(1);
    expect(res.body.errors).toBe(0);
  });

  it('reports errors when CSV has wrong/missing column headers', async () => {
    const badHeadersCsv = Buffer.from(
      'name,surname,mail\n' +
      'Alice,Dupont,alice@test.com\n'
    );

    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', badHeadersCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(207);
    expect(res.body.errors).toBeGreaterThan(0);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(400);
  });

  it('returns 400 when uploaded file is not a CSV', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.adminAuth)
      .attach('file', Buffer.from('not a csv'), { filename: 'data.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when teacher tries to import CSV', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', global.teacherAuth)
      .attach('file', validCsv, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(403);
  });
});
