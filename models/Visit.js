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

function create(phone, propertyId, message, organizationId) {
  const id = generateId();
  const createdAt = now();
  const stmt = db.prepare(`
    INSERT INTO visits (id, phone, property_id, status, message, created_at, organization_id)
    VALUES (@id, @phone, @property_id, @status, @message, @created_at, @organization_id)
  `);
  stmt.run({
    id,
    phone,
    property_id: propertyId,
    status: 'pending',
    message: message || null,
    created_at: createdAt,
    organization_id: organizationId || '',
  });
  return get(id);
}

function get(id, organizationId) {
  if (organizationId) {
    return db.prepare(
      'SELECT * FROM visits WHERE id = @id AND organization_id = @organizationId'
    ).get({ id, organizationId });
  }
  return db.prepare('SELECT * FROM visits WHERE id = @id').get({ id: id });
}

function getAll(organizationId) {
  if (organizationId) {
    return db.prepare(
      'SELECT * FROM visits WHERE organization_id = ? ORDER BY created_at DESC'
    ).all(organizationId);
  }
  return db.prepare('SELECT * FROM visits ORDER BY created_at DESC').all();
}

function getForPhone(phone, organizationId) {
  if (organizationId) {
    return db.prepare(
      'SELECT * FROM visits WHERE phone = @phone AND organization_id = @organizationId ORDER BY created_at DESC'
    ).all({ phone, organizationId });
  }
  return db.prepare('SELECT * FROM visits WHERE phone = @phone ORDER BY created_at DESC').all({ phone: phone });
}

function setStatus(id, status, organizationId) {
  if (organizationId) {
    db.prepare(
      'UPDATE visits SET status = @status WHERE id = @id AND organization_id = @organizationId'
    ).run({ status, id, organizationId });
  } else {
    db.prepare('UPDATE visits SET status = @status WHERE id = @id').run({ status: status, id: id });
  }
  return get(id, organizationId);
}

function setVisitDetails(id, visitDate, visitTime, organizationId) {
  if (organizationId) {
    db.prepare(
      'UPDATE visits SET visit_date = @visit_date, visit_time = @visit_time WHERE id = @id AND organization_id = @organizationId'
    ).run({ visit_date: visitDate, visit_time: visitTime, id, organizationId });
  } else {
    db.prepare('UPDATE visits SET visit_date = @visit_date, visit_time = @visit_time WHERE id = @id')
      .run({ visit_date: visitDate, visit_time: visitTime, id: id });
  }
  return get(id, organizationId);
}

module.exports = { create, get, getAll, getForPhone, setStatus, setVisitDetails, setDatabase };
