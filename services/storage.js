// Shared storage locations. DATA_DIR points at a persistent disk on Render.
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dataDir() {
  return ensureDir(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
}

function uploadsDir() {
  return ensureDir(
    process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, 'uploads')
      : path.join(__dirname, '..', 'uploads')
  );
}

module.exports = { dataDir, uploadsDir };
