require('./setup');

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { getUploadDir } = require('../src/utils/fileHelper');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_IMAGE_PATH = path.join(FIXTURES_DIR, 'test_photo.jpg');

const mockStudent = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Dupont',
  email: 'alice@example.com',
  photoUrl: null,
  classId: 1,
  class: { id: 1, label: 'BTS SIO', year: '2024' },
};

describe('Photo Upload (Integration)', () => {
  let filesBeforeTest = [];

  beforeAll(async () => {
    if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toFile(TEST_IMAGE_PATH);
  });

  afterAll(() => {
    if (fs.existsSync(TEST_IMAGE_PATH)) fs.unlinkSync(TEST_IMAGE_PATH);
    try { fs.rmdirSync(FIXTURES_DIR); } catch (_) { /* not empty */ }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const uploadDir = getUploadDir();
    filesBeforeTest = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
  });

  afterEach(() => {
    const uploadDir = getUploadDir();
    if (fs.existsSync(uploadDir)) {
      fs.readdirSync(uploadDir).forEach((f) => {
        if (!filesBeforeTest.includes(f)) fs.unlinkSync(path.join(uploadDir, f));
      });
    }
  });

  // ─── Happy path ──────────────────────────────────────────────────────────────

  it('uploads a JPEG and generates a 300×300 thumbnail on disk', async () => {
    prisma.student.findUnique.mockResolvedValue(mockStudent);

    let capturedPhotoUrl;
    prisma.student.update.mockImplementation(({ data }) => {
      capturedPhotoUrl = data.photoUrl;
      return Promise.resolve({ ...mockStudent, photoUrl: data.photoUrl, class: mockStudent.class });
    });

    const res = await request(app)
      .post('/api/students/1/photo')
      .set('Authorization', global.adminAuth)
      .attach('photo', TEST_IMAGE_PATH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('photoUrl');
    expect(capturedPhotoUrl).toBeDefined();

    const thumbFilename = path.basename(capturedPhotoUrl);
    const thumbPath = path.join(getUploadDir(), thumbFilename);
    expect(fs.existsSync(thumbPath)).toBe(true);

    const metadata = await sharp(thumbPath).metadata();
    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(300);
  });

  it('replaces old photo file when a new one is uploaded', async () => {
    const uploadDir = getUploadDir();
    const oldThumb = path.join(uploadDir, 'thumb_old_photo.jpg');
    fs.writeFileSync(oldThumb, 'old photo data');
    filesBeforeTest.push('thumb_old_photo.jpg');

    const studentWithPhoto = { ...mockStudent, photoUrl: '/uploads/thumb_old_photo.jpg' };
    prisma.student.findUnique.mockResolvedValue(studentWithPhoto);
    prisma.student.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...studentWithPhoto, photoUrl: data.photoUrl })
    );

    const res = await request(app)
      .post('/api/students/1/photo')
      .set('Authorization', global.adminAuth)
      .attach('photo', TEST_IMAGE_PATH);

    expect(res.status).toBe(200);
    expect(fs.existsSync(oldThumb)).toBe(false);
  });

  // ─── Error cases ─────────────────────────────────────────────────────────────

  it('returns 400 when uploading a non-image file', async () => {
    const res = await request(app)
      .post('/api/students/1/photo')
      .set('Authorization', global.adminAuth)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'document.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app)
      .post('/api/students/1/photo')
      .set('Authorization', global.adminAuth);

    expect(res.status).toBe(400);
  });

  it('returns 404 when the student does not exist', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/students/1/photo')
      .set('Authorization', global.adminAuth)
      .attach('photo', TEST_IMAGE_PATH);

    expect(res.status).toBe(404);
  });

  it('returns 403 when teacher tries to upload a photo', async () => {
    // Use a tiny buffer to avoid EPIPE when server rejects before multer reads the stream
    const res = await request(app)
      .post('/api/students/1/photo')
      .set('Authorization', global.teacherAuth)
      .attach('photo', Buffer.from('x'), { filename: 'x.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });
});
