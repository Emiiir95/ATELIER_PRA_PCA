const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const storage = require("../src/services/storageService");

const prisma = new PrismaClient();
const AVATARS_DIR = path.join(__dirname, "avatars");

async function uploadAvatar(filename) {
  const src = path.join(AVATARS_DIR, filename);
  if (!fs.existsSync(src)) return null;

  const ext = path.extname(filename);
  const thumbName = `thumb_seed_${path.basename(filename, ext)}${ext}`;

  const thumbBuffer = await sharp(src)
    .resize(300, 300, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return storage.upload(thumbBuffer, thumbName, "image/jpeg");
}

async function main() {
  console.log("Seeding database...");

  // ── Users ─────────────────────────────────────────────────────────
  const users = [
    { email: "admin@trombi.fr",   password: "Admin123!",   role: "ADMIN"   },
    { email: "dupont@trombi.fr",  password: "Teacher123!", role: "TEACHER" },
    { email: "martin@trombi.fr",  password: "Teacher123!", role: "TEACHER" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { passwordHash, role: u.role },
      create: { email: u.email, passwordHash, role: u.role },
    });
    console.log(`  [user] ${u.role.padEnd(7)} ${u.email}  /  ${u.password}`);
  }

  // ── Classes ───────────────────────────────────────────────────────
  const bts1 = await prisma.class.upsert({
    where: { id: 1 }, update: {},
    create: { label: "BTS SIO SLAM", year: "2024-2025" },
  });
  const bts2 = await prisma.class.upsert({
    where: { id: 2 }, update: {},
    create: { label: "BTS SIO SISR", year: "2024-2025" },
  });
  const bach = await prisma.class.upsert({
    where: { id: 3 }, update: {},
    create: { label: "Bachelor DevOps", year: "2024-2025" },
  });
  console.log(`\n  [classes] ${bts1.label}, ${bts2.label}, ${bach.label}`);

  // ── Students ──────────────────────────────────────────────────────
  const allStudents = [
    { firstName: "Alice",   lastName: "Dupont",   email: "alice.dupont@bts-sio.fr",    classId: bts1.id, avatar: "alice.jpg"   },
    { firstName: "Baptiste",lastName: "Martin",   email: "baptiste.martin@bts-sio.fr", classId: bts1.id, avatar: "baptiste.jpg"},
    { firstName: "Camille", lastName: "Bernard",  email: "camille.bernard@bts-sio.fr", classId: bts1.id, avatar: "camille.jpg" },
    { firstName: "Dylan",   lastName: "Leroy",    email: "dylan.leroy@bts-sio.fr",     classId: bts1.id, avatar: "dylan.jpg"   },
    { firstName: "Emma",    lastName: "Moreau",   email: "emma.moreau@bts-sio.fr",     classId: bts1.id, avatar: "emma.jpg"    },
    { firstName: "Florian", lastName: "Simon",    email: "florian.simon@bts-sio.fr",   classId: bts1.id, avatar: "florian.jpg" },
    { firstName: "Gabriel", lastName: "Laurent",  email: "gabriel.laurent@bts-sio.fr", classId: bts2.id, avatar: null          },
    { firstName: "Hugo",    lastName: "Petit",    email: "hugo.petit@bts-sio.fr",      classId: bts2.id, avatar: "hugo.jpg"    },
    { firstName: "Ines",    lastName: "Garcia",   email: "ines.garcia@bts-sio.fr",     classId: bts2.id, avatar: "ines.jpg"    },
    { firstName: "Julien",  lastName: "Robert",   email: "julien.robert@bts-sio.fr",   classId: bts2.id, avatar: "julien.jpg"  },
    { firstName: "Kevin",   lastName: "Thomas",   email: "kevin.thomas@bachelor.fr",   classId: bach.id, avatar: null          },
    { firstName: "Lea",     lastName: "Richard",  email: "lea.richard@bachelor.fr",    classId: bach.id, avatar: "lea.jpg"     },
    { firstName: "Mathieu", lastName: "Durand",   email: "mathieu.durand@bachelor.fr", classId: bach.id, avatar: null          },
    { firstName: "Noemie",  lastName: "Lefebvre", email: "noemie.lefebvre@bachelor.fr",classId: bach.id, avatar: "noemie.jpg"  },
    { firstName: "Oscar",   lastName: "Mercier",  email: "oscar.mercier@bachelor.fr",  classId: bach.id, avatar: "oscar.jpg"   },
  ];

  let withPhoto = 0;
  for (const s of allStudents) {
    const photoUrl = s.avatar ? await uploadAvatar(s.avatar) : null;
    if (photoUrl) withPhoto++;

    await prisma.student.upsert({
      where:  { email: s.email },
      update: { photoUrl },
      create: { firstName: s.firstName, lastName: s.lastName, email: s.email, classId: s.classId, photoUrl },
    });
    console.log(`  ${photoUrl ? "📷" : "  "} ${s.firstName} ${s.lastName}`);
  }

  console.log(`\n${allStudents.length} élèves (${withPhoto} avec photo)`);
  console.log("Seed terminé !\n");
  console.log("Comptes créés :");
  console.log("  admin@trombi.fr   /  Admin123!    (ADMIN)");
  console.log("  dupont@trombi.fr  /  Teacher123!  (TEACHER)");
  console.log("  martin@trombi.fr  /  Teacher123!  (TEACHER)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
