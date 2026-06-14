const fs = require("fs");
const path = require("path");
const { getUploadDir } = require("../utils/fileHelper");

const STORAGE = (process.env.STORAGE || "local").toLowerCase();

let s3;
const S3_BUCKET = process.env.S3_BUCKET || "trombi-uploads";

if (STORAGE === "s3") {
  const { S3Client } = require("@aws-sdk/client-s3");
  s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_KEY,
      secretAccessKey: process.env.S3_SECRET,
    },
    forcePathStyle: true,
  });
}

function extractKey(photoUrl) {
  if (photoUrl.startsWith("http")) {
    const { pathname } = new URL(photoUrl);
    return pathname.split("/").slice(2).join("/");
  }
  return path.basename(photoUrl);
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function upload(buffer, filename, mimetype) {
  if (STORAGE === "s3") {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
    // URL publique pour le navigateur (peut différer de l'endpoint interne).
    // En prod : S3_PUBLIC_URL=https://minio.example.com
    // En dev local : généralement http://localhost:9000
    const publicBase =
      process.env.S3_PUBLIC_URL ||
      process.env.S3_ENDPOINT ||
      "";
    return `${publicBase.replace(/\/$/, "")}/${S3_BUCKET}/${filename}`;
  }

  const filePath = path.join(getUploadDir(), filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

async function remove(photoUrl) {
  if (!photoUrl) return;

  if (STORAGE === "s3") {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const key = extractKey(photoUrl);
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return;
  }

  const filePath = path.join(getUploadDir(), path.basename(photoUrl));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function getBuffer(photoUrl) {
  if (!photoUrl) return null;

  if (STORAGE === "s3") {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const key = extractKey(photoUrl);
    try {
      const res = await s3.send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      );
      return streamToBuffer(res.Body);
    } catch {
      return null;
    }
  }

  const filePath = path.join(getUploadDir(), path.basename(photoUrl));
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

module.exports = { upload, remove, getBuffer, STORAGE };
