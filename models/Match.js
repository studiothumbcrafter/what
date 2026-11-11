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

async function record(phone, propertyId, organizationId) {
  const id = generateId();
  const shownAt = now();
  await db.run(`
    INSERT INTO matches (id, phone, property_id, shown_at, organization_id)
    VALUES (@id, @phone, @property_id, @shown_at, @organization_id)
  `, { id: id, phone: phone, property_id: propertyId, shown_at: shownAt, organization_id: organizationId || null });
  return { id, phone, property_id: propertyId, shown_at: shownAt };
}

async function getShownPropertyIds(phone) {
  const rows = await db.all('SELECT property_id FROM matches WHERE phone = @phone', { phone: phone });
  return rows.map(r => r.property_id);
}

async function getForPhone(phone, limit) {
  return db.all(`
    SELECT m.*, p.title, p.rent, p.location, p.bedrooms
    FROM matches m
    JOIN properties p ON p.id = m.property_id
    WHERE m.phone = @phone
    ORDER BY m.shown_at DESC
    LIMIT @limit
  `, { phone: phone, limit: limit || 50 });
}

module.exports = { record, getShownPropertyIds, getForPhone, setDatabase };
