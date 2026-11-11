const crypto = require('crypto');

let db;

function setDatabase(database) {
  db = database;
}

function now() {
  return new Date().toISOString();
}

function generateId() {
  return 'MTC-' + Date.now() + '-' + crypto.randomInt(1000, 9999);
}

function record(phone, propertyId) {
  const id = generateId();
  db.prepare(`
    INSERT INTO matches (id, phone, property_id, shown_at)
    VALUES (@id, @phone, @property_id, @shown_at)
  `).run({ id: id, phone: phone, property_id: propertyId, shown_at: now() });
  return { id, phone, property_id: propertyId, shown_at: now() };
}

function getShownPropertyIds(phone) {
  const rows = db.prepare('SELECT property_id FROM matches WHERE phone = @phone').all({ phone: phone });
  return rows.map(r => r.property_id);
}

function getForPhone(phone, limit) {
  return db.prepare(`
    SELECT m.*, p.title, p.rent, p.location, p.bedrooms
    FROM matches m
    JOIN properties p ON p.id = m.property_id
    WHERE m.phone = @phone
    ORDER BY m.shown_at DESC
    LIMIT @limit
  `).all({ phone: phone, limit: limit || 50 });
}

module.exports = { record, getShownPropertyIds, getForPhone, setDatabase };
