require('./setup');

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

describe('Classes API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/classes ────────────────────────────────────────────────────────

  describe('GET /api/classes', () => {
    it('returns list of classes', async () => {
      const mockClasses = [
        { id: 1, label: 'BTS SIO', year: '2024', createdAt: new Date(), _count: { students: 5 } },
      ];
      prisma.class.findMany.mockResolvedValue(mockClasses);

      const res = await request(app).get('/api/classes').set('Authorization', global.adminAuth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    });

    it('returns empty array when no classes exist', async () => {
      prisma.class.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/classes').set('Authorization', global.teacherAuth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /api/classes/:id ────────────────────────────────────────────────────

  describe('GET /api/classes/:id', () => {
    it('returns a single class with its students', async () => {
      const mockClass = {
        id: 1,
        label: 'BTS SIO',
        year: '2024',
        createdAt: new Date(),
        students: [{ id: 1, firstName: 'Alice', lastName: 'Dupont' }],
      };
      prisma.class.findUnique.mockResolvedValue(mockClass);

      const res = await request(app).get('/api/classes/1').set('Authorization', global.adminAuth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, label: 'BTS SIO' });
    });

    it('returns 404 when class does not exist', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/classes/999').set('Authorization', global.adminAuth);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── POST /api/classes ───────────────────────────────────────────────────────

  describe('POST /api/classes', () => {
    it('creates a class with valid data', async () => {
      const newClass = { id: 1, label: 'BTS SIO', year: '2024', createdAt: new Date() };
      prisma.class.create.mockResolvedValue(newClass);

      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', global.adminAuth)
        .send({ label: 'BTS SIO', year: '2024' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ label: 'BTS SIO', year: '2024' });
    });

    it('returns 400 when label is missing', async () => {
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', global.adminAuth)
        .send({ year: '2024' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when year is missing', async () => {
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', global.adminAuth)
        .send({ label: 'BTS SIO' });

      expect(res.status).toBe(400);
    });

    it('returns 409 when label+year already exists', async () => {
      const p2002Error = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';
      prisma.class.create.mockRejectedValue(p2002Error);

      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', global.adminAuth)
        .send({ label: 'BTS SIO', year: '2024' });

      expect(res.status).toBe(409);
    });

    it('returns 403 when teacher tries to create a class', async () => {
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', global.teacherAuth)
        .send({ label: 'BTS SIO', year: '2024' });

      expect(res.status).toBe(403);
    });
  });

  // ─── PUT /api/classes/:id ────────────────────────────────────────────────────

  describe('PUT /api/classes/:id', () => {
    it('updates a class', async () => {
      const existing = { id: 1, label: 'BTS SIO', year: '2024', createdAt: new Date(), students: [] };
      const updated = { ...existing, label: 'BTS SIO SLAM' };
      prisma.class.findUnique.mockResolvedValue(existing);
      prisma.class.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/classes/1')
        .set('Authorization', global.adminAuth)
        .send({ label: 'BTS SIO SLAM', year: '2024' });

      expect(res.status).toBe(200);
      expect(res.body.label).toBe('BTS SIO SLAM');
    });

    it('returns 404 when class does not exist', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/classes/999')
        .set('Authorization', global.adminAuth)
        .send({ label: 'X', year: '2024' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when label is missing on update', async () => {
      const res = await request(app)
        .put('/api/classes/1')
        .set('Authorization', global.adminAuth)
        .send({ year: '2024' });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/classes/:id ─────────────────────────────────────────────────

  describe('DELETE /api/classes/:id', () => {
    it('deletes a class with no students', async () => {
      const existing = { id: 1, label: 'BTS SIO', year: '2024', createdAt: new Date(), students: [] };
      prisma.class.findUnique.mockResolvedValue(existing);
      prisma.class.delete.mockResolvedValue(existing);

      const res = await request(app).delete('/api/classes/1').set('Authorization', global.adminAuth);

      expect(res.status).toBe(204);
    });

    it('returns 404 when class does not exist', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/classes/999').set('Authorization', global.adminAuth);

      expect(res.status).toBe(404);
    });

    it('returns 409 when class has students (FK constraint)', async () => {
      const classWithStudents = {
        id: 1,
        label: 'BTS SIO',
        year: '2024',
        students: [{ id: 1, firstName: 'Alice' }],
      };
      prisma.class.findUnique.mockResolvedValue(classWithStudents);

      const p2003Error = new Error('Foreign key constraint failed');
      p2003Error.code = 'P2003';
      prisma.class.delete.mockRejectedValue(p2003Error);

      const res = await request(app).delete('/api/classes/1').set('Authorization', global.adminAuth);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });
  });
});
