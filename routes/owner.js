const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const Property = require('../models/Property');
const Media = require('../models/Media');
const Visit = require('../models/Visit');
const { enforceLimit } = require('../services/subscription');
const { authenticateToken } = require('../services/auth');
const router = express.Router();

// All owner routes require authentication
router.use(authenticateToken);

// Ensure upload dirs exist
const { dataDir, uploadsDir } = require('../services/storage');
const uploadsRoot = uploadsDir();
const photoDir = path.join(uploadsRoot, 'photos');
const videoDir = path.join(uploadsRoot, 'videos');
fs.mkdirSync(photoDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'video') {
      cb(null, videoDir);
    } else {
      cb(null, photoDir);
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  },
});

const upload = multer({ storage: storage });

// Wire models to request-local db
router.use(function (req, res, next) {
  Property.setDatabase(req.app.locals.db);
  Media.setDatabase(req.app.locals.db);
  Visit.setDatabase(req.app.locals.db);
  next();
});

// Express 4 does not catch rejected promises from async handlers.
function wrap(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Serve uploaded files
router.get('/uploads/:type/:filename', function (req, res) {
  var type = req.params.type;
  var filename = req.params.filename;
  var dir = type === 'video' ? videoDir : photoDir;
  var filePath = path.join(dir, filename);
  res.sendFile(filePath, function (err) {
    if (err) res.status(404).json({ error: 'File not found' });
  });
});

// List all properties (with media count)
router.get('/properties', wrap(async function (req, res) {
  var props = await Property.getAll(req.user.org_id);
  var result = [];
  for (var i = 0; i < props.length; i++) {
    var p = props[i];
    var media = await Media.getByProperty(p.id);
    var photos = media.filter(function (m) { return m.type === 'photo'; });
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
      photo_count: photos.length,
      photos: photos.map(function (m) { return m.file_path; }),
    });
  }
  res.json(result);
}));

// Get one property with its media
router.get('/properties/:id', wrap(async function (req, res) {
  var prop = await Property.get(req.params.id, req.user.org_id);
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  prop.media = await Media.getByProperty(prop.id);
  res.json(prop);
}));

// Excel export helper
async function exportPropertiesToExcel(db, organizationId) {
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
  } catch (err) {
    console.warn('[excel] Export failed:', err.message);
  }
}

// Create a property
router.post('/properties', wrap(async function (req, res) {
  var props = req.body || {};
  if (!props.rent || !props.location) {
    return res.status(400).json({ error: 'rent and location are required' });
  }
  if (!req.user.org_id) {
    return res.status(403).json({ error: 'Token is missing organization context' });
  }
  try {
    await enforceLimit(req.app.locals.db, req.user.org_id, 'property');
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
  try {
    var created = await Property.create(props, req.user.org_id);
    await exportPropertiesToExcel(req.app.locals.db, req.user.org_id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Database error' });
  }
}));

// Update a property
router.put('/properties/:id', wrap(async function (req, res) {
  var props = req.body || {};
  var updated = await Property.update(req.params.id, props, req.user.org_id);
  if (!updated) return res.status(404).json({ error: 'Property not found' });
  res.json(updated);
}));

// Toggle status
router.patch('/properties/:id/status', wrap(async function (req, res) {
  var props = req.body || {};
  var status = props.status;
  if (!status) return res.status(400).json({ error: 'status is required' });
  var updated = await Property.setStatus(req.params.id, status, req.user.org_id);
  if (!updated) return res.status(404).json({ error: 'Property not found' });
  res.json(updated);
}));

// Delete a property and its media files
router.delete('/properties/:id', wrap(async function (req, res) {
  var removed = await Property.remove(req.params.id, req.user.org_id);
  if (!removed) return res.status(404).json({ error: 'Property not found' });
  await Media.removeByProperty(req.params.id);
  res.json({ ok: true });
}));

// Upload media for a property (multiple photos + one video)
router.post('/properties/:id/media', upload.array('files'), wrap(async function (req, res) {
  var propertyId = req.params.id;
  var prop = await Property.get(propertyId, req.user.org_id);
  if (!prop) {
    return res.status(404).json({ error: 'Property not found' });
  }
  var files = req.files || [];
  var added = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var type = f.fieldname === 'video' ? 'video' : 'photo';
    var filePath = '/uploads/' + (type === 'video' ? 'videos' : 'photos') + '/' + f.filename;
    added.push(await Media.add(propertyId, type, filePath));
  }
  res.json({ media: added });
}));

// List media for a property
router.get('/properties/:id/media', wrap(async function (req, res) {
  var prop = await Property.get(req.params.id, req.user.org_id);
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  res.json(await Media.getByProperty(req.params.id));
}));

// Match requests view (owner)
router.get('/matches', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const rows = await d.all(`
    SELECT m.id, m.phone, m.property_id, m.shown_at, p.title, p.rent, p.location, p.bedrooms
    FROM matches m
    JOIN properties p ON p.id = m.property_id
    WHERE m.organization_id = ?
    ORDER BY m.shown_at DESC
  `, [req.user.org_id]);
  res.json(rows);
}));

// Interested customers view (owner)
router.get('/customers', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const rows = await d.all('SELECT * FROM customers WHERE organization_id = ? ORDER BY updated_at DESC', [req.user.org_id]);
  const result = rows.map(r => {
    let requirements = {};
    try { requirements = JSON.parse(r.requirements || '{}'); } catch (e) {}
    return { phone: r.phone, name: r.name, state: r.state, requirements: requirements, created_at: r.created_at, updated_at: r.updated_at };
  });
  res.json(result);
}));

// Allowed contacts (whitelist) — who can use the rental agent
router.get('/allowed-contacts', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const rows = await d.all('SELECT * FROM allowed_contacts WHERE organization_id = ? ORDER BY added_at DESC', [req.user.org_id]);
  res.json(rows);
}));

router.post('/allowed-contacts', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const orgId = req.user.org_id;
  const { phone, name } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  try {
    const existing = await d.get('SELECT organization_id FROM allowed_contacts WHERE phone = ?', [phone]);
    if (existing && existing.organization_id && existing.organization_id !== orgId) {
      return res.status(409).json({ error: 'This phone number is already registered with another workspace' });
    }
    await d.run(`
      INSERT INTO allowed_contacts (phone, name, added_at, organization_id)
      VALUES (@phone, @name, @added_at, @organization_id)
      ON CONFLICT(phone) DO UPDATE SET
        name = excluded.name,
        added_at = excluded.added_at,
        organization_id = excluded.organization_id
    `, { phone, name: name || null, added_at: new Date().toISOString(), organization_id: orgId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

router.delete('/allowed-contacts/:phone', wrap(async function (req, res) {
  const d = req.app.locals.db;
  await d.run('DELETE FROM allowed_contacts WHERE phone = @phone AND organization_id = @organization_id', {
    phone: req.params.phone,
    organization_id: req.user.org_id,
  });
  res.json({ ok: true });
}));

// WhatsApp Cloud API status (no QR pairing)
router.get('/whatsapp/qr', function (req, res) {
  res.status(410).json({
    error: 'QR pairing is not used. Configure the Meta WhatsApp Cloud API variables in Render.',
  });
});

router.get('/whatsapp/status', function (req, res) {
  const required = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'];
  const missing = required.filter(function (key) { return !process.env[key]; });
  res.json({
    mode: 'cloud',
    configured: missing.length === 0,
    missing: missing,
    linked: false,
    hasQr: false,
  });
});

router.post('/whatsapp/disconnect', function (req, res) {
  res.status(410).json({
    error: 'Cloud API connections are managed in Meta, not from this dashboard.',
  });
});

// Subscription status
router.get('/subscription/status', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const orgId = req.user.org_id;

  if (!orgId) {
    return res.status(403).json({ error: 'Token is missing organization context' });
  }

  const subscription = await d.get(`
    SELECT s.*, p.name AS plan_name,
           COALESCE(s.price_paise, p.price_paise) AS effective_price_paise,
           p.billing_interval, p.property_limit,
           p.monthly_match_limit, p.monthly_visit_limit
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.organization_id = ?
  `, [orgId]);

  if (!subscription) {
    return res.json({
      status: 'none',
      plan: null,
      message: 'No active subscription. Please subscribe to a plan.'
    });
  }

  const propertyRow = await d.get(
    'SELECT COUNT(*) AS count FROM properties WHERE organization_id = ?',
    [orgId]
  );
  const propertyCount = Number(propertyRow ? propertyRow.count : 0);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthKey = monthStart.toISOString().slice(0, 10);
  const usage = await d.all(`
    SELECT type, COALESCE(SUM(count), 0) AS total
    FROM usage_logs
    WHERE organization_id = ? AND date >= ?
    GROUP BY type
  `, [orgId, monthKey]);
  const usageByType = {};
  usage.forEach(function (row) { usageByType[row.type] = Number(row.total); });

  res.json({
    subscription_id: subscription.id,
    plan: subscription.plan_id || subscription.plan,
    plan_name: subscription.plan_name,
    status: subscription.status,
    price_paise: subscription.effective_price_paise,
    currency: subscription.currency || 'INR',
    renews_at: subscription.renewal_date,
    renewal_date: subscription.renewal_date,
    trial_start: subscription.trial_start,
    trial_end: subscription.trial_end,
    property_limit: subscription.property_limit,
    monthly_match_limit: subscription.monthly_match_limit,
    monthly_visit_limit: subscription.monthly_visit_limit,
    usage: {
      properties: propertyCount,
      matches: usageByType.match || 0,
      visits: usageByType.visit || 0,
      messages: subscription.message_usage || 0,
      ai: subscription.ai_usage || 0
    },
    message_usage: subscription.message_usage || 0,
    ai_usage: subscription.ai_usage || 0,
    created_at: subscription.created_at
  });
}));

// Visit requests — list all visits
router.get('/visits', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const rows = await d.all(`
    SELECT v.*, p.title, p.rent, p.location, p.bedrooms
    FROM visits v
    JOIN properties p ON p.id = v.property_id
    WHERE v.organization_id = ?
    ORDER BY v.created_at DESC
  `, [req.user.org_id]);
  res.json(rows);
}));

// Visit requests — pending only
router.get('/visits/pending', wrap(async function (req, res) {
  const d = req.app.locals.db;
  const rows = await d.all(`
    SELECT v.*, p.title, p.rent, p.location, p.bedrooms
    FROM visits v
    JOIN properties p ON p.id = v.property_id
    WHERE v.status = 'pending' AND v.organization_id = ?
    ORDER BY v.created_at DESC
  `, [req.user.org_id]);
  res.json(rows);
}));

// Approve / reject a visit
router.patch('/visits/:id/status', wrap(async function (req, res) {
  const { status } = req.body || {};
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  const visit = await Visit.setStatus(req.params.id, status, req.user.org_id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
}));

// Set visit date & time
router.patch('/visits/:id/schedule', wrap(async function (req, res) {
  const { visit_date, visit_time } = req.body || {};
  if (!visit_date || !visit_time) {
    return res.status(400).json({ error: 'visit_date and visit_time are required' });
  }
  const visit = await Visit.setVisitDetails(req.params.id, visit_date, visit_time, req.user.org_id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
}));

module.exports = router;
