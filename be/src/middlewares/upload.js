const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf';
  if (!isPdf) {
    return cb(new Error('Only PDF uploads are allowed'));
  }
  return cb(null, true);
};

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = { uploadPdf };
