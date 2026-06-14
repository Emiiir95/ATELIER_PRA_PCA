const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const prisma = require("../config/prisma");
const { getExportDir, generateFilename } = require("../utils/fileHelper");
const storage = require("./storageService");

async function generateTrombi(classId, format, userId = null) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
    },
  });

  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }

  const exportDir = getExportDir();
  let filePath;
  let exportPath;

  if (format === "html") {
    const filename = generateFilename(`trombi_${classId}`, ".html");
    filePath = path.join(exportDir, filename);
    await generateHtml(cls, filePath);
    exportPath = `/exports/${filename}`;
  } else if (format === "pdf") {
    const filename = generateFilename(`trombi_${classId}`, ".pdf");
    filePath = path.join(exportDir, filename);
    await generatePdf(cls, filePath);
    exportPath = `/exports/${filename}`;
  } else {
    const err = new Error('Invalid format. Use "html" or "pdf"');
    err.statusCode = 400;
    throw err;
  }

  // Save export record
  await prisma.export.create({
    data: { format, path: exportPath, classId, userId },
  });

  return { filePath, exportPath, cls };
}

async function generateHtml(cls, filePath) {
  const photoMap = new Map();
  await Promise.all(
    cls.students
      .filter((s) => s.photoUrl)
      .map(async (s) => {
        const buf = await storage.getBuffer(s.photoUrl);
        if (buf) photoMap.set(s.id, buf);
      }),
  );

  const studentCards = cls.students
    .map((s) => {
      let photo;
      const buf = photoMap.get(s.id);
      if (buf) {
        const ext = path.extname(s.photoUrl).slice(1).toLowerCase();
        const mime = ext === "jpg" ? "jpeg" : ext;
        const base64 = buf.toString("base64");
        photo = `<img src="data:image/${mime};base64,${base64}" alt="${s.firstName} ${s.lastName}" class="w-full h-full object-cover" />`;
      } else {
        photo = `<div class="flex items-center justify-center h-full bg-gray-200 text-gray-400 text-4xl font-bold">${s.firstName[0]}${s.lastName[0]}</div>`;
      }

      return `
      <div class="bg-white rounded-xl shadow-md overflow-hidden flex flex-col items-center p-4 gap-3">
        <div class="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-300">
          ${photo}
        </div>
        <div class="text-center">
          <p class="font-semibold text-gray-800">${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</p>
          <p class="text-sm text-gray-500">${escapeHtml(s.email)}</p>
        </div>
      </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trombinoscope - ${escapeHtml(cls.label)} ${escapeHtml(cls.year)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen py-10 px-6">
  <div class="max-w-5xl mx-auto">
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold text-indigo-700">${escapeHtml(cls.label)}</h1>
      <p class="text-gray-500 mt-2">Promotion ${escapeHtml(cls.year)}</p>
      <p class="text-sm text-gray-400 mt-1">${cls.students.length} élève(s)</p>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      ${studentCards}
    </div>
    <footer class="text-center mt-12 text-xs text-gray-400 border-t border-gray-200 pt-4">
      <p>Généré le ${new Date().toLocaleDateString("fr-FR")} — Trombinoscope v2</p>
      <p class="mt-1 text-gray-300">
        Les données personnelles présentes dans ce document (nom, prénom, photo) sont utilisées
        dans le cadre pédagogique conformément au RGPD (Règlement UE 2016/679).
        Toute reproduction ou diffusion à des fins autres qu'éducatives est interdite.
        Droits d'accès, rectification et suppression : contacter l'établissement.
      </p>
    </footer>
  </div>
</body>
</html>`;

  fs.writeFileSync(filePath, html, "utf-8");
}

async function generatePdf(cls, filePath) {
  const photoMap = new Map();
  await Promise.all(
    cls.students
      .filter((s) => s.photoUrl)
      .map(async (s) => {
        const buf = await storage.getBuffer(s.photoUrl);
        if (buf) photoMap.set(s.id, buf);
      }),
  );

  const logoPath = path.join(__dirname, "../../assets/logo.png");
  const hasLogo = fs.existsSync(logoPath);

  return new Promise((resolve, reject) => {
    const MARGIN = 30;
    const doc = new PDFDocument({ margin: MARGIN, size: "A4", autoFirstPage: false });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ── Constantes layout ─────────────────────────────────────────────
    const HEADER_H = 56;
    const LOGO_D   = 40;
    const COLS     = 5;
    const ROWS     = 6;
    const GAP_X    = 8;
    const GAP_Y    = 8;
    const PAD_TOP  = 8;
    const PAD_BOT  = 8;
    const NAME_H   = 10;
    const EMAIL_H  = 8;
    const FOOTER_H = 36;

    const pageW    = 595.28; // A4 width
    const pageH    = 841.89; // A4 height
    const CARD_W   = (pageW - MARGIN * 2 - GAP_X * (COLS - 1)) / COLS;
    const footerY  = pageH - MARGIN - FOOTER_H;
    const gridTop  = MARGIN + HEADER_H + 8;
    const gridH    = footerY - gridTop - GAP_Y;
    const CARD_H   = (gridH - GAP_Y * (ROWS - 1)) / ROWS;
    const PHOTO_D  = CARD_H - PAD_TOP - 4 - NAME_H - 2 - EMAIL_H - PAD_BOT;

    const RGPD =
      "Les données personnelles présentes dans ce document (nom, prénom, photo) sont utilisées " +
      "dans le cadre pédagogique conformément au RGPD (Règlement UE 2016/679). " +
      "Toute reproduction ou diffusion à des fins autres qu'éducatives est interdite. " +
      "Droits d'accès, rectification et suppression : contacter l'établissement.";

    function drawHeader() {
      if (hasLogo) {
        doc.image(logoPath, MARGIN, MARGIN, { width: LOGO_D, height: LOGO_D });
      } else {
        doc.roundedRect(MARGIN, MARGIN, LOGO_D, LOGO_D, 10).fill("#4338ca");
        doc
          .fontSize(22)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("T", MARGIN, MARGIN + 9, { width: LOGO_D, align: "center" });
      }
      doc
        .fontSize(16)
        .fillColor("#4338ca")
        .font("Helvetica-Bold")
        .text(
          `Trombinoscope – Classe ${cls.label} (${cls.year})`,
          MARGIN + LOGO_D + 12,
          MARGIN + 6,
          { width: pageW - MARGIN * 2 - LOGO_D - 12 },
        );
      doc
        .fontSize(10)
        .fillColor("#6b7280")
        .font("Helvetica")
        .text(
          `${cls.students.length} élève(s)`,
          MARGIN + LOGO_D + 12,
          MARGIN + 26,
          { width: pageW - MARGIN * 2 - LOGO_D - 12 },
        );
    }

    function drawFooter() {
      doc
        .fontSize(7)
        .fillColor("#6b7280")
        .font("Helvetica")
        .text(
          `Généré le ${new Date().toLocaleDateString("fr-FR")} — Trombinoscope v2`,
          MARGIN,
          footerY,
          { width: pageW - MARGIN * 2, align: "center" },
        )
        .fontSize(5.5)
        .fillColor("#9ca3af")
        .text(RGPD, MARGIN, footerY + 14, {
          width: pageW - MARGIN * 2,
          align: "center",
        });
    }

    doc.on("pageAdded", () => {
      drawHeader();
      drawFooter();
    });

    doc.addPage(); // déclenche drawHeader/drawFooter pour la 1ère page

    let x = MARGIN;
    let y = gridTop;
    const PER_PAGE = COLS * ROWS;

    cls.students.forEach((student, i) => {
      // Saut de page tous les 30 élèves pour garder exactement la grille 5×6
      if (i > 0 && i % PER_PAGE === 0) {
        doc.addPage();
        y = gridTop;
        x = MARGIN;
      }

      doc
        .roundedRect(x, y, CARD_W, CARD_H, 8)
        .fillAndStroke("#ffffff", "#e5e7eb");

      const photoX = x + (CARD_W - PHOTO_D) / 2;
      const photoY = y + PAD_TOP;
      const cx = photoX + PHOTO_D / 2;
      const cy = photoY + PHOTO_D / 2;
      const r = PHOTO_D / 2;

      const photoBuf = photoMap.get(student.id);
      if (photoBuf) {
        doc.save();
        doc.circle(cx, cy, r).clip();
        doc.image(photoBuf, photoX, photoY, {
          width: PHOTO_D,
          height: PHOTO_D,
        });
        doc.restore();
        doc.circle(cx, cy, r).lineWidth(1.5).stroke("#a5b4fc");
      } else {
        doc.circle(cx, cy, r).fillAndStroke("#e0e7ff", "#a5b4fc");
        const initials =
          `${student.firstName[0]}${student.lastName[0]}`.toUpperCase();
        doc
          .fontSize(16)
          .fillColor("#4338ca")
          .text(initials, photoX, cy - 9, { width: PHOTO_D, align: "center" });
      }

      const textY = photoY + PHOTO_D + 4;
      doc
        .fontSize(7.5)
        .fillColor("#1f2937")
        .font("Helvetica-Bold")
        .text(`${student.firstName} ${student.lastName}`, x + 3, textY, {
          width: CARD_W - 6,
          align: "center",
          ellipsis: true,
        });
      doc
        .fontSize(6)
        .fillColor("#6b7280")
        .font("Helvetica")
        .text(student.email, x + 3, textY + NAME_H + 2, {
          width: CARD_W - 6,
          align: "center",
          ellipsis: true,
        });

      if ((i + 1) % COLS === 0) {
        x = MARGIN;
        y += CARD_H + GAP_Y;
      } else {
        x += CARD_W + GAP_X;
      }
    });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { generateTrombi };
