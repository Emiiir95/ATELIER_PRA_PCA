const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const EXPORT_DIR = path.join(__dirname, '../../exports');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getUploadDir() {
  ensureDir(UPLOAD_DIR);
  return UPLOAD_DIR;
}

function getExportDir() {
  ensureDir(EXPORT_DIR);
  return EXPORT_DIR;
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function generateFilename(prefix, ext) {
  return `${prefix}_${Date.now()}${ext}`;
}

module.exports = { getUploadDir, getExportDir, deleteFile, generateFilename, ensureDir };
