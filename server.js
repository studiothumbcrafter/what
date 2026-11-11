const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { authenticateToken, getJwtSecret } = require('./services/auth');
const { ensureOwnerOrg, backfillOrganization } = require('./services/org');
const { dataDir } = require('./services/storage');
const { init } = require('./db');
const ExcelJS = require('exceljs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let db;
try {
  db = init();
} catch (err) {
  console.error('[db] init failed:', err.message);
  process.exit(1);
}

app.locals.db = db;

// Express 4 does not catch rejected promises from async handlers.
function wrap(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

const { ensureTrialSubscription, enforceLimit, recordUsage } = require('./services/subscription');

// Map the single owner account to an organization for tenant-scoped data.
// Startup work is async for Postgres, so routes that need the org await `ready`.
let OWNER_ORG_ID = null;
let startupError = null;
const ready = (async function () {
  if (db.ready) await db.ready;
  OWNER_ORG_ID = await ensureOwnerOrg(db);
  await backfillOrganization(db, OWNER_ORG_ID);
  await ensureTrialSubscription(db, OWNER_ORG_ID);
  console.log('[db] ready (' + db.kind + '), owner org: ' + OWNER_ORG_ID);
})().catch(function (err) {
  startupError = err;
  console.error('[db] startup failed:', err.message);
});

// Health check for Render and uptime monitors.
app.get('/health', function (req, res) {
  const ok = !startupError;
  res.status(ok ? 200 : 503).json({
    ok: ok,
    uptime: Math.round(process.uptime()),
    db: db.kind || 'sqlite',
  });
});

// Default owner credentials
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'admin';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'admin123';

// Owner login
app.post('/api/owner/login', wrap(async function (req, res) {
  await ready;
  if (startupError) {
    return res.status(503).json({ error: 'Database is not ready. Try again shortly.' });
  }
  const { username, password } = req.body || {};
  if (username === OWNER_USERNAME && password === OWNER_PASSWORD) {
    const token = jwt.sign(
      { sub: 'owner', username, role: 'owner', org_id: OWNER_ORG_ID },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    return res.json({ token, username, org_id: OWNER_ORG_ID });
  }
  res.status(401).json({ error: 'Invalid credentials' });
}));

// Public property browse (with search) - MUST come before owner routes mount
app.get('/api/properties', wrap(async function (req, res) {
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
  const props = await d.all(query, params);
  const result = [];
  for (const p of props) {
    const media = await d.all(
      'SELECT * FROM property_media WHERE property_id = @id AND type = @type ORDER BY created_at ASC',
      { id: p.id, type: 'photo' }
    );
    result.push({
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
    });
  }
  res.json(result);
}));

// Excel download. Must be registered before the owner router, otherwise
// /api/properties/:id inside routes/owner.js swallows "export" as an id.
app.get('/api/properties/export', authenticateToken, wrap(async function (req, res) {
  try {
    await exportPropertiesToExcel(req.user.org_id);
    res.download(path.join(dataDir(), 'properties.xlsx'), 'properties.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
}));

// Owner dashboard APIs (authenticated)
app.use('/api', require('./routes/owner'));

// Visit request from website
app.post('/api/visits/request', authenticateToken, wrap(async function (req, res) {
  const d = req.app.locals.db;
  const { property_id, message } = req.body || {};
  if (!property_id) return res.status(400).json({ error: 'property_id is required' });
  const prop = await d.get('SELECT * FROM properties WHERE id = @id', { id: property_id });
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  if (prop.organization_id && req.user.org_id && prop.organization_id !== req.user.org_id) {
    return res.status(404).json({ error: 'Property not found' });
  }
  const orgId = prop.organization_id || req.user.org_id;
  if (!orgId) {
    return res.status(403).json({ error: 'Token is missing organization context' });
  }
  try {
    await enforceLimit(d, orgId, 'visit');
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
  const Visit = require('./models/Visit');
  Visit.setDatabase(d);
  const visit = await Visit.create(req.user.phone || 'website-customer', property_id, message || 'Visit requested via website', orgId);
  await recordUsage(d, orgId, 'visit', 1);
  res.json({ ok: true, visit });
}));

// Visit management (owner)
app.patch('/api/visits/:id/status', authenticateToken, wrap(async function (req, res) {
  const d = req.app.locals.db;
  const { status } = req.body || {};
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  const Visit = require('./models/Visit');
  Visit.setDatabase(d);
  const visit = await Visit.setStatus(req.params.id, status, req.user.org_id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
}));

app.patch('/api/visits/:id/schedule', authenticateToken, wrap(async function (req, res) {
  const d = req.app.locals.db;
  const { visit_date, visit_time } = req.body || {};
  if (!visit_date || !visit_time) {
    return res.status(400).json({ error: 'visit_date and visit_time are required' });
  }
  const Visit = require('./models/Visit');
  Visit.setDatabase(d);
  const visit = await Visit.setVisitDetails(req.params.id, visit_date, visit_time, req.user.org_id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
}));

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
async function exportPropertiesToExcel(organizationId) {
  try {
    const props = organizationId
      ? await db.all('SELECT * FROM properties WHERE organization_id = ? ORDER BY created_at DESC', [organizationId])
      : await db.all('SELECT * FROM properties ORDER BY created_at DESC');
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
    const excelPath = path.join(dataDir(), 'properties.xlsx');
    await workbook.xlsx.writeFile(excelPath);
    console.log('[excel] Properties exported to ' + excelPath);
  } catch (err) {
    console.error('[excel] Export failed:', err.message);
    throw err;
  }
}

// WhatsApp client (disabled — Chrome has no display in this environment)
// To enable WhatsApp QR code, run server.js on a machine with Chrome/display
let waClient = null;
console.log('[whatsapp] Skipped (no Chrome display in this environment)');

// Export endpoint removed: registered earlier, before the owner router.

// WhatsApp webhook endpoint
app.post('/webhook/whatsapp', wrap(async function (req, res) {
  const { verifyWebhookSignature, parseWebhookMessage } = require('./services/whatsapp-cloud');
  const { sendMessage } = require('./services/whatsapp-cloud');

  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;

  // Verify signature
  const secret = process.env.WHATSAPP_APP_SECRET || 'test-secret';
  if (!verifyWebhookSignature(secret, signature, JSON.stringify(payload))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse message
  const msg = parseWebhookMessage(payload);
  if (!msg) {
    return res.status(200).json({ status: 'no message' });
  }

  // Route to AI assistant (Stage 1)
  const { handleMessage } = require('./services/ai-assistant');
  const reply = handleMessage(msg.phone, msg.text);

  if (reply) {
    // Send reply via WhatsApp Cloud API
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '123456789';
    sendMessage(phoneNumberId, msg.phone, reply).then(() => {
      console.log('[whatsapp] Sent reply to', msg.phone);
    }).catch((err) => {
      console.error('[whatsapp] Send error:', err.message);
    });
  }

  res.status(200).json({ status: 'ok' });
}));

app.listen(PORT, () => {
  console.log(`[server] SmartRent AI running on http://localhost:${PORT}`);
});

module.exports = app;
