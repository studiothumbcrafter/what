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

async function create(props, organizationId) {
  const id = generateId();
  const createdAt = now();
  await db.run(`
    INSERT INTO properties (id, organization_id, title, rent, location, bedrooms, bathrooms, furnishing, parking, balcony, floor, facilities, availability_date, info, status, created_at)
    VALUES (@id, @organization_id, @title, @rent, @location, @bedrooms, @bathrooms, @furnishing, @parking, @balcony, @floor, @facilities, @availability_date, @info, @status, @created_at)
  `, {
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
  return await get(id);
}

async function get(id, organizationId) {
  if (organizationId) {
    return db.get(
      'SELECT * FROM properties WHERE id = @id AND organization_id = @organizationId',
      { id, organizationId }
    );
  }
  return db.get('SELECT * FROM properties WHERE id = @id', { id });
}

async function getAll(organizationId) {
  if (organizationId) {
    return db.all(
      'SELECT * FROM properties WHERE organization_id = @organizationId ORDER BY created_at DESC',
      { organizationId }
    );
  }
  return db.all('SELECT * FROM properties ORDER BY created_at DESC');
}

async function update(id, props, organizationId) {
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
  if (fields.length === 0) return await get(id, organizationId);
  let where = 'WHERE id = @id';
  if (organizationId) {
    where += ' AND organization_id = @organizationId';
    values.organizationId = organizationId;
  }
  await db.run(`UPDATE properties SET ${fields.join(', ')} ${where}`, values);
  return await get(id, organizationId);
}

function setStatus(id, status, organizationId) {
  return update(id, { status }, organizationId);
}

async function remove(id, organizationId) {
  const row = await get(id, organizationId);
  if (!row) return null;
  if (organizationId) {
    await db.run('DELETE FROM properties WHERE id = @id AND organization_id = @organizationId', { id, organizationId });
  } else {
    await db.run('DELETE FROM properties WHERE id = @id', { id });
  }
  return row;
}

module.exports = { create, get, getAll, update, setStatus, remove, setDatabase };
