const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const Customer = require('../models/Customer');
const { parse } = require('../services/parser');
const { match, recordMatches } = require('../services/matcher');
const Property = require('../models/Property');
const Match = require('../models/Match');
const Media = require('../models/Media');
const Visit = require('../models/Visit');

let client = null;
let dbRef = null;
let currentQR = null;
let currentQRImage = null;
let isLinked = false;

// Track pending visit confirmations per customer (phone -> {propertyId, propertyTitle})
const pendingVisits = {};

function setClient(c) {
  client = c;
}

function setDatabase(db) {
  Customer.setDatabase(db);
  Property.setDatabase(db);
  Match.setDatabase(db);
  Media.setDatabase(db);
  Visit.setDatabase(db);
  dbRef = db;
}

function init() {
  const chromePath = 'C:\\Users\\NOCXM\\.cache\\puppeteer\\chrome\\win64-146.0.7680.31\\chrome-win64\\chrome.exe';
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: false,
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--window-size=1366,768',
        '--start-maximized',
      ],
    },
  });

  client.on('qr', async (qr) => {
    currentQR = qr;
    try {
      currentQRImage = await QRCode.toDataURL(qr);
    } catch (e) {
      currentQRImage = null;
    }
    console.log('\n=== WHATSAPP QR CODE ===');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('Scan this QR with your WhatsApp (Linked Devices)\n');
  });

  client.on('ready', () => {
    isLinked = true;
    currentQR = null;
    currentQRImage = null;
    console.log('[whatsapp] Client ready');
  });

  client.on('disconnected', (reason) => {
    isLinked = false;
    currentQR = null;
    currentQRImage = null;
    console.log('[whatsapp] Disconnected:', reason);
  });

  client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast') return;
    const phone = msg.from;
    const text = msg.body || '';

    // Check whitelist — only allowed contacts can use the rental agent
    const allowed = await dbRef.get('SELECT 1 FROM allowed_contacts WHERE phone = @phone', { phone });
    if (!allowed) {
      await sendText(phone, "Sorry, this rental assistant is for authorized contacts only. Please contact the owner to be added to the list.");
      await Customer.logMessage(phone, 'assistant', "Sorry, this rental assistant is for authorized contacts only. Please contact the owner to be added to the list.");
      return;
    }

    await handleMessage(phone, text, msg);
  });

  client.on('auth_failure', (msg) => {
    console.error('[whatsapp] auth failure:', msg);
  });

  client.initialize().catch(err => {
    console.error('[whatsapp] initialization error:', err.message);
  });
  return client;
}

function getClient() {
  return client;
}

function getQR() {
  return currentQR;
}

function getQRImage() {
  return currentQRImage;
}

function getIsLinked() {
  return isLinked;
}

async function disconnect() {
  isLinked = false;
  if (client) {
    try {
      await client.logout();
    } catch (e) {
      console.error('[whatsapp] logout error:', e.message);
    }
    client.destroy();
    client = null;
    currentQR = null;
    currentQRImage = null;
    console.log('[whatsapp] Disconnected');
  }
}

// Mandatory fields in priority order for asking
const MANDATORY = ['budgetMax', 'location', 'bedrooms'];

function missingMandatory(req) {
  for (const k of MANDATORY) {
    if (req[k] == null) return k;
  }
  return null;
}

function questionFor(field) {
  const q = {
    budgetMax: 'What is your maximum monthly budget (e.g., ₹12,000)?',
    location: 'Which area or city are you looking in?',
    bedrooms: 'How many bedrooms do you need (e.g., 2BHK)?',
  };
  return q[field];
}

async function handleMessage(phone, text, msg) {
  await Customer.logMessage(phone, 'customer', text);
  await Customer.upsert(phone);

  const conv = await Customer.getConversation(phone, 2);
  const isNewCustomer = conv.length <= 1;

  // Send welcome message to new customers
  if (isNewCustomer) {
    const welcome = "Hello! 👋 Welcome to SmartRent AI. I can help you find a rental home. Tell me what you're looking for — for example: '2BHK under ₹12,000 in Mumbai'. What's your maximum monthly budget?";
    await sendText(phone, welcome);
    await Customer.logMessage(phone, 'assistant', welcome);
  }

  const trimmed = text.trim();

  // --- Visit confirmation flow ---
  // If customer is confirming a pending visit ("yes", "ok", "confirm")
  if (pendingVisits[phone] && /^(yes|ok|confirm|sure|y)$/i.test(trimmed)) {
    const p = pendingVisits[phone];
    await Visit.create(phone, p.propertyId, 'Customer booked visit via WhatsApp');
    delete pendingVisits[phone];
    const reply = `✅ Visit booked for *${p.propertyTitle}*!\n\nRent: ₹${p.rent}/month\nLocation: ${p.location}\n\nI’ll confirm the visit date & time with you shortly.`;
    await sendText(phone, reply);
    await Customer.logMessage(phone, 'assistant', reply);
    return;
  }

  // If customer is declining a pending visit ("no", "cancel")
  if (pendingVisits[phone] && /^(no|cancel|not now)$/i.test(trimmed)) {
    delete pendingVisits[phone];
    const reply = 'Okay, visit cancelled. Let me know if you want to see other properties.';
    await sendText(phone, reply);
    await Customer.logMessage(phone, 'assistant', reply);
    return;
  }

  // --- Handle property number reply (e.g., "1", "2", "3") ---
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch && !missingMandatory((await Customer.getRequirements(phone)) || {})) {
    const choice = parseInt(numMatch[1]);
    // Get recent matches for this customer
    const shown = await Match.getForPhone(phone, 10);
    const prop = shown[choice - 1];
    if (prop) {
      pendingVisits[phone] = {
        propertyId: prop.property_id,
        propertyTitle: prop.title,
        rent: prop.rent,
        location: prop.location,
      };
      const reply = `Shall I book a visit for *${prop.title}*?\n₹${prop.rent}/month • ${prop.location}\nReply "yes" to confirm or "no" to cancel.`;
      await sendText(phone, reply);
      await Customer.logMessage(phone, 'assistant', reply);
      return;
    }
  }

  // --- Handle "visit" / "book" keyword ---
  if (/visit|book|schedule/i.test(trimmed)) {
    const shown = await Match.getForPhone(phone, 10);
    if (shown.length === 0) {
      await sendText(phone, "I haven’t shown you any properties yet. Tell me your requirements first!");
      await Customer.logMessage(phone, 'assistant', "I haven’t shown you any properties yet. Tell me your requirements first!");
      return;
    }
    const list = shown.map((p, i) => `${i + 1}. ${p.title} — ₹${p.rent}/month • ${p.location}`).join('\n');
    const reply = `Which property would you like to visit? Reply with the number:\n\n${list}`;
    await sendText(phone, reply);
    await Customer.logMessage(phone, 'assistant', reply);
    return;
  }

  const existing = (await Customer.getRequirements(phone)) || {};
  const parsed = parse(text);

  // Merge: new parsed values override, but keep existing for fields not mentioned
  const merged = { ...existing };
  for (const k of Object.keys(parsed.requirements)) {
    const v = parsed.requirements[k];
    if (v != null && v !== '') merged[k] = v;
  }

  // Detect budget flexibility language
  if (/flex|negotiable|can increase|stretch/.test(text.toLowerCase())) merged.flexibility = 1;

  await Customer.updateRequirements(phone, merged);

  const missing = missingMandatory(merged);

  if (missing) {
    // Ask only the next missing question
    await Customer.setState(phone, 'collecting');
    const reply = 'I’d love to help you find a home. ' + questionFor(missing);
    await sendText(phone, reply);
    await Customer.logMessage(phone, 'assistant', reply);
    return;
  }

  // Enough info — run matching
  await Customer.setState(phone, 'matching');
  const results = match(phone, merged);
  await sendMatches(phone, results, merged);
}

async function sendMatches(phone, results, requirements) {
  if (results.length === 0) {
    const flexReq = requirements.flexibility === 1 ? '' : ' Try allowing a flexible budget.';
    const reply = "Sorry, I couldn't find any available properties matching your requirements." + flexReq + ' Would you like to relax one requirement (budget, location, or bedrooms)?';
    await sendText(phone, reply);
    await Customer.logMessage(phone, 'assistant', reply);
    return;
  }

  recordMatches(phone, results);

  // Intro line
  let intro = 'Here are the best matching properties:';
  if (results.length === 1) intro = 'I found one matching property:';
  await sendText(phone, intro);
  await Customer.logMessage(phone, 'assistant', intro);

  for (let i = 0; i < results.length; i++) {
    const m = results[i];
    const p = m.property;
    const media = await Media.getByProperty(p.id);
    const photos = media.filter(x => x.type === 'photo');

    let msgText = `*${i + 1}. ${p.title}*\n`;
    msgText += `₹${p.rent}/month • ${p.location}\n`;
    msgText += `${p.bedrooms} BHK • ${p.bathrooms || '-'} bath`;
    if (p.furnishing) msgText += ' • ' + p.furnishing;
    if (p.parking == 1) msgText += ' • Parking';
    if (p.balcony == 1) msgText += ' • Balcony';
    msgText += '\nWhy it matches: ' + m.matchReasons.join('; ') + '.';
    msgText += '\nReply with the number to book a visit, or ask me to show more.';

    // Send text
    await sendText(phone, msgText);
    await Customer.logMessage(phone, 'assistant', msgText);

    // Send photos (up to 3 genuine photos)
    for (let j = 0; j < Math.min(photos.length, 3); j++) {
      await sendMedia(phone, photos[j].file_path);
    }
  }
}

async function sendText(phone, text) {
  if (!client) return;
  try { await client.sendMessage(phone, text); } catch (e) { console.error('[whatsapp] send error:', e.message); }
}

async function sendMedia(phone, filePath) {
  if (!client) return;
  try {
    const fullPath = require('path').join(__dirname, '..', filePath);
    await client.sendMessage(phone, fullPath, { caption: '' });
  } catch (e) { console.error('[whatsapp] media send error:', e.message); }
}

module.exports = { init, getClient, setClient, setDatabase, getQR, getQRImage, getIsLinked, disconnect, handleMessage };
