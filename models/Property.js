const crypto = require('crypto');

let db;

function setDatabase(database) {
  db = database;
}

function now() {
  return new Date().toISOString();
}

function generateId() {
  return `PRP-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
}

function create(props, organizationId) {
  const id = generateId();
  const createdAt = now();
  const stmt = db.prepare(`
    INSERT INTO properties (id, organization_id, title, rent, location, bedrooms, bathrooms, furnishing, parking, balcony, floor, facilities, availability_date, info, status, created_at)
    VALUES (@id, @organization_id, @title, @rent, @location, @bedrooms, @bathrooms, @furnishing, @parking, @balcony, @floor, @facilities, @availability_date, @info, @status, @created_at)
  `);
  stmt.run({
    id,
    organization_id: organizationId || props.organization_id || '',
    title: props.title || null,
    rent: props.rent,
    location: props.location,
    bedrooms: props.bedrooms || null,
    bathrooms: props.bathrooms || null,
    furnishing: props.furnishing || null,
    parking: props.parking || 0,
    balcony: props.balcony || 0,
    floor: props.floor || null,
    facilities: props.facilities || null,
    availability_date: props.availability_date || null,
    info: props.info || null,
    status: props.status || 'available',
    created_at: createdAt,
  });
  return get(id);
}

function get(id, organizationId) {
  if (organizationId) {
    return db.prepare(
      'SELECT * FROM properties WHERE id = @id AND organization_id = @organizationId'
    ).get({ id, organizationId });
  }
  return db.prepare('SELECT * FROM properties WHERE id = @id').get({ id });
}

function getAll(organizationId) {
  if (organizationId) {
    return db.prepare(
      'SELECT * FROM properties WHERE organization_id = @organizationId ORDER BY created_at DESC'
    ).all({ organizationId });
  }
  return db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
}

function update(id, props, organizationId) {
  const fields = [];
  const values = { id };
  const allowed = [
    'title', 'rent', 'location', 'bedrooms', 'bathrooms', 'furnishing',
    'parking', 'balcony', 'floor', 'facilities', 'availability_date', 'info', 'status',
  ];
  for (const key of allowed) {
    if (props[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = props[key];
    }
  }
  if (fields.length === 0) return get(id, organizationId);
  let where = 'WHERE id = @id';
  if (organizationId) {
    where += ' AND organization_id = @organizationId';
    values.organizationId = organizationId;
  }
  const stmt = db.prepare(`UPDATE properties SET ${fields.join(', ')} ${where}`);
  stmt.run(values);
  return get(id, organizationId);
}

function setStatus(id, status, organizationId) {
  return update(id, { status }, organizationId);
}

function remove(id, organizationId) {
  const row = get(id, organizationId);
  if (!row) return null;
  if (organizationId) {
    db.prepare('DELETE FROM properties WHERE id = @id AND organization_id = @organizationId')
      .run({ id, organizationId });
  } else {
    db.prepare('DELETE FROM properties WHERE id = @id').run({ id });
  }
  return row;
}

module.exports = { create, get, getAll, update, setStatus, remove, setDatabase };
