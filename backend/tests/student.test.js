require('./setup');

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { getUploadDir } = require('../src/utils/fileHelper');

const mockStudent = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Dupont',
  email: 'alice@example.com',
  photoUrl: null,
  classId: 1,
  createdAt: new Date(),
  class: { id: 1, label: 'BTS SIO', year: '2024' },
};

describe('Students API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/students ───────────────────────────────────────────────────────

  describe('GET /api/students', () => {
    it('returns list of students', async () => {
      prisma.student.findMany.mockResolvedValue([mockStudent]);

      const res = await request(app).get('/api/students').set('Authorization', global.adminAuth);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('filters by class_id', async () => {
      prisma.student.findMany.mockResolvedValue([mockStudent]);

      const res = await request(app).get('/api/students?class_id=1').set('Authorization', global.teacherAuth);

      expect(res.status).toBe(200);
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ classId: 1 }) })
      );
    });

    it('filters by search query (name/email)', async () => {
      prisma.student.findMany.mockResolvedValue([mockStudent]);

      const res = await request(app).get('/api/students?q=alice').set('Authorization', global.teacherAuth);

      expect(res.status).toBe(200);
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        })
      );
    });

    it('returns empty array when no students match', async () => {
      prisma.student.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/students?q=zzznomatch').set('Authorization', global.teacherAuth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /api/students/:id ───────────────────────────────────────────────────

  describe('GET /api/students/:id', () => {
    it('returns a single student', async () => {
      prisma.student.findUnique.mockResolvedValue(mockStudent);

      const res = await request(app).get('/api/students/1').set('Authorization', global.adminAuth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, email: 'alice@example.com' });
    });

    it('returns 404 when student does not exist', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/students/999').set('Authorization', global.adminAuth);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── POST /api/students ──────────────────────────────────────────────────────

  describe('POST /api/students', () => {
    it('creates a student with valid data', async () => {
      prisma.student.create.mockResolvedValue(mockStudent);

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Alice', lastName: 'Dupont', email: 'alice@example.com', classId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('alice@example.com');
    });

    it('returns 400 with invalid email', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Alice', lastName: 'Dupont', email: 'not-an-email', classId: 1 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when firstName is missing', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', global.adminAuth)
        .send({ lastName: 'Dupont', email: 'alice@example.com', classId: 1 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when lastName is missing', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Alice', email: 'alice@example.com', classId: 1 });

      expect(res.status).toBe(400);
    });

    it('returns 409 when email already exists', async () => {
      const p2002Error = new Error('Unique constraint failed on email');
      p2002Error.code = 'P2002';
      prisma.student.create.mockRejectedValue(p2002Error);

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Alice', lastName: 'Dupont', email: 'alice@example.com', classId: 1 });

      expect(res.status).toBe(409);
    });

    it('returns 403 when teacher tries to create a student', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', global.teacherAuth)
        .send({ firstName: 'Alice', lastName: 'Dupont', email: 'alice@example.com', classId: 1 });

      expect(res.status).toBe(403);
    });
  });

  // ─── PUT /api/students/:id ───────────────────────────────────────────────────

  describe('PUT /api/students/:id', () => {
    it('updates a student', async () => {
      prisma.student.findUnique.mockResolvedValue(mockStudent);
      prisma.student.update.mockResolvedValue({ ...mockStudent, firstName: 'Bob' });

      const res = await request(app)
        .put('/api/students/1')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Bob', lastName: 'Dupont', email: 'alice@example.com', classId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Bob');
    });

    it('returns 404 when student does not exist', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/students/999')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Bob', lastName: 'Dupont', email: 'bob@example.com', classId: 1 });

      expect(res.status).toBe(404);
    });

    it('returns 400 when email is invalid on update', async () => {
      const res = await request(app)
        .put('/api/students/1')
        .set('Authorization', global.adminAuth)
        .send({ firstName: 'Alice', lastName: 'Dupont', email: 'bad-email', classId: 1 });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/students/:id ────────────────────────────────────────────────

  describe('DELETE /api/students/:id', () => {
    it('deletes a student without photo', async () => {
      prisma.student.findUnique.mockResolvedValue(mockStudent);
      prisma.student.delete.mockResolvedValue(mockStudent);

      const res = await request(app).delete('/api/students/1').set('Authorization', global.adminAuth);

      expect(res.status).toBe(204);
    });

    it('returns 404 when student does not exist', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/students/999').set('Authorization', global.adminAuth);

      expect(res.status).toBe(404);
    });

    it('deletes the photo file from disk when student has a photo', async () => {
      const uploadDir = getUploadDir();
      const fakeThumb = path.join(uploadDir, 'thumb_test_to_delete.jpg');
      fs.writeFileSync(fakeThumb, 'fake photo content');

      const studentWithPhoto = { ...mockStudent, photoUrl: '/uploads/thumb_test_to_delete.jpg' };
      prisma.student.findUnique.mockResolvedValue(studentWithPhoto);
      prisma.student.delete.mockResolvedValue(studentWithPhoto);

      const res = await request(app).delete('/api/students/1').set('Authorization', global.adminAuth);

      expect(res.status).toBe(204);
      expect(fs.existsSync(fakeThumb)).toBe(false);
    });
  });
});
