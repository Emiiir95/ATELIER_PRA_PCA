const prisma = require('../config/prisma');

async function getAllClasses({ year } = {}) {
  const where = {};
  if (year) where.year = year;
  return prisma.class.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { students: true } } },
  });
}

async function getPromos() {
  const classes = await prisma.class.findMany({
    orderBy: { year: 'desc' },
    include: { _count: { select: { students: true } } },
  });

  const map = new Map();
  for (const c of classes) {
    if (!map.has(c.year)) {
      map.set(c.year, { year: c.year, classesCount: 0, studentsCount: 0 });
    }
    const entry = map.get(c.year);
    entry.classesCount += 1;
    entry.studentsCount += c._count.students;
  }
  return Array.from(map.values()).sort((a, b) => b.year.localeCompare(a.year));
}

async function getClassById(id) {
  const cls = await prisma.class.findUnique({
    where: { id },
    include: { students: true },
  });
  if (!cls) {
    const err = new Error('Class not found');
    err.statusCode = 404;
    throw err;
  }
  return cls;
}

async function createClass(data) {
  return prisma.class.create({ data: { label: data.label, year: data.year } });
}

async function updateClass(id, data) {
  await getClassById(id);
  return prisma.class.update({ where: { id }, data: { label: data.label, year: data.year } });
}

async function deleteClass(id) {
  await getClassById(id);
  return prisma.class.delete({ where: { id } });
}

async function findOrCreateClass(label, year) {
  let cls = await prisma.class.findFirst({ where: { label, year } });
  if (!cls) {
    cls = await prisma.class.create({ data: { label, year } });
  }
  return cls;
}

module.exports = { getAllClasses, getPromos, getClassById, createClass, updateClass, deleteClass, findOrCreateClass };
