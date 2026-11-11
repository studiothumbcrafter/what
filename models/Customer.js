const crypto = require('crypto');

let db;

function setDatabase(database) {
  db = database;
}

function now() {
  return new Date().toISOString();
}

function generateId() {
  return 'MSG-' + Date.now() + '-' + crypto.randomInt(1000, 9999);
}

function upsert(phone, name) {
  const existing = get(phone);
  const timestamp = now();
  if (existing) {
    db.prepare('UPDATE customers SET updated_at = @updated_at, name = COALESCE(@name, name) WHERE phone = @phone')
      .run({ updated_at: timestamp, name: name, phone: phone });
    return get(phone);
  }
  db.prepare(`
    INSERT INTO customers (phone, name, requirements, state, created_at, updated_at)
    VALUES (@phone, @name, @requirements, @state, @created_at, @updated_at)
  `).run({
    phone: phone,
    name: name || null,
    requirements: null,
    state: 'collecting',
    created_at: timestamp,
    updated_at: timestamp,
  });
  return get(phone);
}

function get(phone) {
  const row = db.prepare('SELECT * FROM customers WHERE phone = @phone').get({ phone: phone });
  if (row && row.requirements) {
    try { row.requirements = JSON.parse(row.requirements); } catch (e) { row.requirements = {}; }
  }
  return row;
}

function updateRequirements(phone, requirements) {
  const row = get(phone);
  if (!row) return null;
  const json = typeof requirements === 'string' ? requirements : JSON.stringify(requirements);
  db.prepare('UPDATE customers SET requirements = @requirements, state = @state, updated_at = @updated_at WHERE phone = @phone')
    .run({ requirements: json, state: 'collecting', updated_at: now(), phone: phone });
  return get(phone);
}

function getRequirements(phone) {
  const row = get(phone);
  return row ? row.requirements : null;
}

function setState(phone, state) {
  db.prepare('UPDATE customers SET state = @state, updated_at = @updated_at WHERE phone = @phone')
    .run({ state: state, updated_at: now(), phone: phone });
  return get(phone);
}

function getState(phone) {
  const row = get(phone);
  return row ? row.state : null;
}

function logMessage(phone, role, message) {
  const id = generateId();
  const timestamp = now();
  db.prepare(`
    INSERT INTO conversations (id, phone, role, message, created_at)
    VALUES (@id, @phone, @role, @message, @created_at)
  `).run({ id: id, phone: phone, role: role, message: message, created_at: timestamp });
  return { id, phone, role, message, created_at: timestamp };
}

function getConversation(phone, limit) {
  return db.prepare(
    'SELECT * FROM conversations WHERE phone = @phone ORDER BY created_at DESC LIMIT @limit'
  ).all({ phone: phone, limit: limit || 50 });
}

module.exports = { upsert, get, updateRequirements, getRequirements, setState, getState, logMessage, getConversation, setDatabase };
