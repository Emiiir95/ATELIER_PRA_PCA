const sharp = require("sharp");
const prisma = require("../config/prisma");
const { generateFilename } = require("../utils/fileHelper");
const storage = require("./storageService");

async function getStudents({ classId, year, q }) {
  const where = {};

  if (classId) {
    where.classId = parseInt(classId, 10);
  } else if (year) {
    where.class = { year };
  }

  if (q) {
    const search = q.trim();
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.student.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { class: { select: { id: true, label: true, year: true } } },
  });
}

async function getStudentById(id) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: { class: true },
  });
  if (!student) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }
  return student;
}

async function createStudent(data) {
  return prisma.student.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      classId: data.classId,
    },
    include: { class: true },
  });
}

async function updateStudent(id, data) {
  await getStudentById(id);
  return prisma.student.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      classId: data.classId ?? null,
    },
    include: { class: true },
  });
}

async function deleteStudent(id) {
  const student = await getStudentById(id);
  if (student.photoUrl) {
    await storage.remove(student.photoUrl);
  }
  return prisma.student.delete({ where: { id } });
}

async function uploadPhoto(id, file) {
  const student = await getStudentById(id);

  // Delete old photo
  if (student.photoUrl) {
    await storage.remove(student.photoUrl);
  }

  const thumbFilename = generateFilename("thumb", ".jpg");

  const thumbBuffer = await sharp(file.buffer)
    .resize(300, 300, { fit: "cover", position: "centre" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const photoUrl = await storage.upload(thumbBuffer, thumbFilename, "image/jpeg");

  return prisma.student.update({
    where: { id },
    data: { photoUrl },
    include: { class: true },
  });
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadPhoto,
};
