// Shared storage locations. DATA_DIR points at a persistent disk on Render.
const path = require('path');

function dataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '..', 'data');
}

function uploadsDir() {
  return process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'uploads')
    : path.join(__dirname, '..', 'uploads');
}

module.exports = { dataDir, uploadsDir };
