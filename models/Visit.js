const crypto = require('crypto');

let db;

function setDatabase(database) {
  db = database;
}

function now() {
  return new Date().toISOString();
}

function generateId() {
  return 'VIS-' + Date.now() + '-' + crypto.randomInt(1000, 9999);
}

async function create(phone, propertyId, message, organizationId) {
  const id = generateId();
  const createdAt = now();
  await db.run(`
    INSERT INTO visits (id, phone, property_id, status, message, created_at, organization_id)
    VALUES (@id, @phone, @property_id, @status, @message, @created_at, @organization_id)
  `, {
    id,
    phone,
    property_id: propertyId,
    status: 'pending',
    message: message || null,
    created_at: createdAt,
    organization_id: organizationId || '',
  });
  return await get(id);
}

async function get(id, organizationId) {
  if (organizationId) {
    return db.get(
      'SELECT * FROM visits WHERE id = @id AND organization_id = @organizationId',
      { id, organizationId }
    );
  }
  return db.get('SELECT * FROM visits WHERE id = @id', { id: id });
}

async function getAll(organizationId) {
  if (organizationId) {
    return db.all(
      'SELECT * FROM visits WHERE organization_id = ? ORDER BY created_at DESC',
      [organizationId]
    );
  }
  return db.all('SELECT * FROM visits ORDER BY created_at DESC');
}

async function getForPhone(phone, organizationId) {
  if (organizationId) {
    return db.all(
      'SELECT * FROM visits WHERE phone = @phone AND organization_id = @organizationId ORDER BY created_at DESC',
      { phone, organizationId }
    );
  }
  return db.all('SELECT * FROM visits WHERE phone = @phone ORDER BY created_at DESC', { phone: phone });
}

async function setStatus(id, status, organizationId) {
  if (organizationId) {
    await db.run(
      'UPDATE visits SET status = @status WHERE id = @id AND organization_id = @organizationId',
      { status, id, organizationId }
    );
  } else {
    await db.run('UPDATE visits SET status = @status WHERE id = @id', { status: status, id: id });
  }
  return await get(id, organizationId);
}

async function setVisitDetails(id, visitDate, visitTime, organizationId) {
  if (organizationId) {
    await db.run(
      'UPDATE visits SET visit_date = @visit_date, visit_time = @visit_time WHERE id = @id AND organization_id = @organizationId',
      { visit_date: visitDate, visit_time: visitTime, id, organizationId }
    );
  } else {
    await db.run('UPDATE visits SET visit_date = @visit_date, visit_time = @visit_time WHERE id = @id', { visit_date: visitDate, visit_time: visitTime, id: id });
  }
  return await get(id, organizationId);
}

module.exports = { create, get, getAll, getForPhone, setStatus, setVisitDetails, setDatabase };
