/**
 * src/middleware/upload.js
 * 
 * Secure Multipart File Upload Middleware (Multer)
 * 
 * Security Controls (Viva / Code Review):
 * 1. Whitelist-Only MIME Validation: Restricts uploads strictly to JPEG, PNG, and WEBP.
 *    Rejects executables, scripts (.php, .sh), or SVGs (which can harbor stored XSS).
 * 2. 5MB File Size Cap: Enforces a strict 5MB limit to prevent storage exhaustion.
 * 3. Cryptographic Random Filenames: Avoids original user-provided filenames to prevent
 *    path traversal attacks and naming collisions.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure destination directory exists: uploads/campaigns
const uploadDir = path.resolve(__dirname, '../../uploads/campaigns');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure randomized filename: timestamp-randomhex.extension
    const randomHex = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${randomHex}${cleanExt}`);
  }
});

// MIME type filter
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB maximum
  }
});

module.exports = upload;
