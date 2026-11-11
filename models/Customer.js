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

async function upsert(phone, name) {
  const existing = await get(phone);
  const timestamp = now();
  if (existing) {
    await db.run('UPDATE customers SET updated_at = @updated_at, name = COALESCE(@name, name) WHERE phone = @phone', { updated_at: timestamp, name: name, phone: phone });
    return await get(phone);
  }
  await db.run(`
    INSERT INTO customers (phone, name, requirements, state, created_at, updated_at)
    VALUES (@phone, @name, @requirements, @state, @created_at, @updated_at)
  `, {
    phone: phone,
    name: name || null,
    requirements: null,
    state: 'collecting',
    created_at: timestamp,
    updated_at: timestamp,
  });
  return await get(phone);
}

async function get(phone) {
  const row = await db.get('SELECT * FROM customers WHERE phone = @phone', { phone: phone });
  if (row && row.requirements) {
    try { row.requirements = JSON.parse(row.requirements); } catch (e) { row.requirements = {}; }
  }
  return row;
}

async function updateRequirements(phone, requirements) {
  const row = await get(phone);
  if (!row) return null;
  const json = typeof requirements === 'string' ? requirements : JSON.stringify(requirements);
  await db.run('UPDATE customers SET requirements = @requirements, state = @state, updated_at = @updated_at WHERE phone = @phone', { requirements: json, state: 'collecting', updated_at: now(), phone: phone });
  return await get(phone);
}

async function getRequirements(phone) {
  const row = await get(phone);
  return row ? row.requirements : null;
}

async function setState(phone, state) {
  await db.run('UPDATE customers SET state = @state, updated_at = @updated_at WHERE phone = @phone', { state: state, updated_at: now(), phone: phone });
  return await get(phone);
}

async function getState(phone) {
  const row = await get(phone);
  return row ? row.state : null;
}

async function logMessage(phone, role, message) {
  const id = generateId();
  const timestamp = now();
  await db.run(`
    INSERT INTO conversations (id, phone, role, message, created_at)
    VALUES (@id, @phone, @role, @message, @created_at)
  `, { id: id, phone: phone, role: role, message: message, created_at: timestamp });
  return { id, phone, role, message, created_at: timestamp };
}

async function getConversation(phone, limit) {
  return db.all(
    'SELECT * FROM conversations WHERE phone = @phone ORDER BY created_at DESC LIMIT @limit',
    { phone: phone, limit: limit || 50 }
  );
}

module.exports = { upsert, get, updateRequirements, getRequirements, setState, getState, logMessage, getConversation, setDatabase };
