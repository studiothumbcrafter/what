const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticateToken } = require('./services/auth');
const { init } = require('./db');
const ExcelJS = require('exceljs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartrent-secret-change-me';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let db;
try {
  db = init();
  console.log('[db] SQLite initialized');
} catch (err) {
  console.error('[db] init failed:', err.message);
  process.exit(1);
}

app.locals.db = db;

// Default owner credentials
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'admin';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'admin123';

// Owner login

// Owner login
app.post('/api/owner/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === OWNER_USERNAME && password === OWNER_PASSWORD) {
    const token = jwt.sign({ username, role: 'owner' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, username });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// Public property browse (with search) - MUST come before owner routes mount
app.get('/api/properties', (req, res) => {
  const d = req.app.locals.db;
  let query = 'SELECT * FROM properties WHERE status = @status';
  const params = { status: 'available' };
  if (req.query.location) {
    query += ' AND location LIKE @location';
    params.location = '%' + req.query.location + '%';
  }
  if (req.query.rent_max) {
    query += ' AND rent <= @rent_max';
    params.rent_max = parseInt(req.query.rent_max);
  }
  query += ' ORDER BY created_at DESC';
  const props = d.prepare(query).all(params);
  const result = props.map(p => {
    const media = d.prepare('SELECT * FROM property_media WHERE property_id = @id AND type = @type ORDER BY created_at ASC').all({ id: p.id, type: 'photo' });
    return {
      id: p.id,
      title: p.title,
      rent: p.rent,
      location: p.location,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      furnishing: p.furnishing,
      parking: p.parking,
      balcony: p.balcony,
      floor: p.floor,
      facilities: p.facilities,
      availability_date: p.availability_date,
      info: p.info,
      status: p.status,
      created_at: p.created_at,
      photo_count: media.length,
      photos: media.map(m => m.file_path),
    };
  });
  res.json(result);
});

// Owner dashboard APIs (authenticated)
app.use('/api', require('./routes/owner'));

// Visit request from website
app.post('/api/visits/request', authenticateToken, (req, res) => {
  const d = req.app.locals.db;
  const { property_id, message } = req.body || {};
  if (!property_id) return res.status(400).json({ error: 'property_id is required' });
  const prop = d.prepare('SELECT * FROM properties WHERE id = @id').get({ id: property_id });
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  const Visit = require('./models/Visit');
  Visit.setDatabase(d);
  const visit = Visit.create(req.user.phone || 'website-customer', property_id, message || 'Visit requested via website');
  res.json({ ok: true, visit });
});

// Visit management (owner)
app.patch('/api/visits/:id/status', authenticateToken, (req, res) => {
  const d = req.app.locals.db;
  const { status } = req.body || {};
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  const Visit = require('./models/Visit');
  Visit.setDatabase(d);
  const visit = Visit.setStatus(req.params.id, status);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
});

app.patch('/api/visits/:id/schedule', authenticateToken, (req, res) => {
  const d = req.app.locals.db;
  const { visit_date, visit_time } = req.body || {};
  if (!visit_date || !visit_time) {
    return res.status(400).json({ error: 'visit_date and visit_time are required' });
  }
  const Visit = require('./models/Visit');
  Visit.setDatabase(d);
  const visit = Visit.setVisitDetails(req.params.id, visit_date, visit_time);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
});

// Owner app (mobile-first)
app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'owner-app.html'));
});

// Serve static files (dashboard, assets)
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve PWA manifest
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Excel export function
function exportPropertiesToExcel() {
  try {
    const props = db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Properties');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 20 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Rent', key: 'rent', width: 15 },
      { header: 'Location', key: 'location', width: 30 },
      { header: 'Bedrooms', key: 'bedrooms', width: 12 },
      { header: 'Bathrooms', key: 'bathrooms', width: 12 },
      { header: 'Furnishing', key: 'furnishing', width: 15 },
      { header: 'Parking', key: 'parking', width: 10 },
      { header: 'Balcony', key: 'balcony', width: 10 },
      { header: 'Floor', key: 'floor', width: 10 },
      { header: 'Facilities', key: 'facilities', width: 30 },
      { header: 'Availability Date', key: 'availability_date', width: 20 },
      { header: 'Info', key: 'info', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created At', key: 'created_at', width: 25 },
    ];
    props.forEach(p => {
      sheet.addRow({
        id: p.id,
        title: p.title || '',
        rent: p.rent || '',
        location: p.location || '',
        bedrooms: p.bedrooms || '',
        bathrooms: p.bathrooms || '',
        furnishing: p.furnishing || '',
        parking: p.parking || '',
        balcony: p.balcony || '',
        floor: p.floor || '',
        facilities: p.facilities || '',
        availability_date: p.availability_date || '',
        info: p.info || '',
        status: p.status || '',
        created_at: p.created_at || '',
      });
    });
    const excelPath = path.join(__dirname, 'data', 'properties.xlsx');
    workbook.xlsx.writeFile(excelPath);
    console.log('[excel] Properties exported to ' + excelPath);
  } catch (err) {
    console.warn('[excel] Export failed:', err.message);
  }
}

// WhatsApp client (disabled — Chrome has no display in this environment)
// To enable WhatsApp QR code, run server.js on a machine with Chrome/display
let waClient = null;
console.log('[whatsapp] Skipped (no Chrome display in this environment)');

// Export endpoint
app.get('/api/properties/export', authenticateToken, (req, res) => {
  try {
    exportPropertiesToExcel();
    res.download(path.join(__dirname, 'data', 'properties.xlsx'), 'properties.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[server] SmartRent AI running on http://localhost:${PORT}`);
});

module.exports = app;
