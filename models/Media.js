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

async function add(propertyId, type, filePath) {
  var id = generateId();
  var createdAt = now();
  await db.run(
    'INSERT INTO property_media (id, property_id, type, file_path, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, propertyId, type, filePath, createdAt]
  );
  return { id: id, property_id: propertyId, type: type, file_path: filePath, created_at: createdAt };
}

async function getByProperty(propertyId) {
  return db.all('SELECT * FROM property_media WHERE property_id = ? ORDER BY created_at ASC', [propertyId]);
}

async function removeByProperty(propertyId) {
  var media = await getByProperty(propertyId);
  for (var i = 0; i < media.length; i++) {
    var m = media[i];
    try {
      var fullPath = path.join(__dirname, '..', m.file_path);
      fs.unlinkSync(fullPath);
    } catch (e) {
      // file may not exist
    }
  }
  await db.run('DELETE FROM property_media WHERE property_id = ?', [propertyId]);
  return media;
}

module.exports = { add: add, getByProperty: getByProperty, removeByProperty: removeByProperty, setDatabase: setDatabase };
