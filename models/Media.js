const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let db;

function setDatabase(database) {
  db = database;
}

function now() {
  return new Date().toISOString();
}

function generateId() {
  return 'MED-' + Date.now() + '-' + crypto.randomInt(1000, 9999);
}

function add(propertyId, type, filePath) {
  var id = generateId();
  var createdAt = now();
  var stmt = db.prepare(
    'INSERT INTO property_media (id, property_id, type, file_path, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, propertyId, type, filePath, createdAt);
  return { id: id, property_id: propertyId, type: type, file_path: filePath, created_at: createdAt };
}

function getByProperty(propertyId) {
  var stmt = db.prepare('SELECT * FROM property_media WHERE property_id = ? ORDER BY created_at ASC');
  return stmt.all(propertyId);
}

function removeByProperty(propertyId) {
  var media = getByProperty(propertyId);
  for (var i = 0; i < media.length; i++) {
    var m = media[i];
    try {
      var fullPath = path.join(__dirname, '..', m.file_path);
      fs.unlinkSync(fullPath);
    } catch (e) {
      // file may not exist
    }
  }
  db.prepare('DELETE FROM property_media WHERE property_id = ?').run(propertyId);
  return media;
}

module.exports = { add: add, getByProperty: getByProperty, removeByProperty: removeByProperty, setDatabase: setDatabase };
