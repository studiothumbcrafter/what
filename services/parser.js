const http = require('http');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2';

function parse(message) {
  const lowered = String(message || '').toLowerCase();
  const req = {
    budgetMax: null,
    location: null,
    bedrooms: null,
    bathrooms: null,
    furnishing: null,
    parking: null,
    balcony: null,
    floor: null,
    facilities: null,
    availabilityDate: null,
    flexibility: null,
    info: message,
  };

  // --- Budget ---
  const budgetMatch = lowered.match(/(?:under|max|maximum|upto|up to|below|less than|within)\s*[₹rs]?\s*([\d,]+(?:\.\d+)?)\s*(k)?/);
  if (budgetMatch) {
    let val = parseFloat(budgetMatch[1].replace(/,/g, ''));
    if (budgetMatch[2] === 'k') val *= 1000;
    req.budgetMax = val;
  } else {
    const amtMatch = lowered.match(/[₹rs]\s*([\d,]+(?:\.\d+)?)\s*(k)?/);
    if (amtMatch) {
      let val = parseFloat(amtMatch[1].replace(/,/g, ''));
      if (amtMatch[2] === 'k') val *= 1000;
      req.budgetMax = val;
    }
  }

  // --- Bedrooms ---
  const bhkMatch = lowered.match(/(\d+)\s*bhk|(\d+)\s*bedroom|(\d+)\s*bed\b/);
  if (bhkMatch) {
    req.bedrooms = parseInt(bhkMatch[1] || bhkMatch[2] || bhkMatch[3]);
  }

  // --- Bathrooms ---
  const bathMatch = lowered.match(/(\d+)\s*bath/);
  if (bathMatch) {
    req.bathrooms = parseInt(bathMatch[1]);
  }

  // --- Furnishing ---
  if (/\bsemi.?furnished\b/.test(lowered)) req.furnishing = 'semi-furnished';
  else if (/\bfurnished\b/.test(lowered)) req.furnishing = 'furnished';
  else if (/\bunfurnished\b/.test(lowered)) req.furnishing = 'unfurnished';

  // --- Parking ---
  if (/\bparking\b/.test(lowered)) req.parking = 1;

  // --- Balcony ---
  if (/\bbalcony\b/.test(lowered)) req.balcony = 1;

  // --- Floor ---
  const floorMatch = lowered.match(/(\d+)(?:st|nd|rd|th)?\s*floor/);
  if (floorMatch) req.floor = parseInt(floorMatch[1]);

  // --- Facilities ---
  const facKeywords = ['lift', 'security', 'power backup', 'gym', 'pool', 'swimming pool', 'garden', 'play area', 'wifi', 'internet', '24x7', 'cctv', 'fire safety', 'ramps'];
  const found = facKeywords.filter(k => lowered.includes(k));
  if (found.length > 0) req.facilities = found.join(', ');

  // --- Availability ---
  if (/\bnext month\b/.test(lowered)) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    req.availabilityDate = d.toISOString().slice(0, 10);
  } else if (/\bimmediately\b|\bnow\b|\basap\b/.test(lowered)) {
    req.availabilityDate = new Date().toISOString().slice(0, 10);
  }

  // --- Location (English + Hindi/Hinglish city names) ---
  const cityMap = [
    { en: 'mumbai', hi: ['मुंबई', 'बॉम्बे'] },
    { en: 'delhi', hi: ['दिल्ली'] },
    { en: 'bangalore', hi: ['बेंगलुरु', 'बंगलौर'] },
    { en: 'hyderabad', hi: ['हैदराबाद'] },
    { en: 'chennai', hi: ['चेन्नई'] },
    { en: 'pune', hi: ['पुणे'] },
    { en: 'kolkata', hi: ['कोलकाता'] },
    { en: 'noida', hi: ['नोएडा'] },
    { en: 'gurgaon', hi: ['गुड़गांव', 'गुरुग्राम'] },
  ];
  for (const cm of cityMap) {
    if (lowered.includes(cm.en)) { req.location = cm.en; break; }
    for (const h of cm.hi) {
      if (message.includes(h)) { req.location = cm.en; break; }
    }
    if (req.location) break;
  }

  return { requirements: req, confidence: 0.7 };
}

function parseWithOllama(message) {
  return new Promise((resolve, reject) => {
    const prompt = 'Extract rental requirements from this customer message (English/Hindi/Hinglish). Return ONLY valid JSON with keys: budgetMax, location, bedrooms, bathrooms, furnishing, parking, balcony, floor, facilities, availabilityDate, flexibility. Use null for unknown. Message: ' + JSON.stringify(message);
    const payload = JSON.stringify({ model: OLLAMA_MODEL, prompt: prompt, format: 'json', stream: false });
    const req = http.request({
      hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const json = JSON.parse(parsed.response || '{}');
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
    setTimeout(() => { req.destroy(); reject(new Error('ollama timeout')); }, 8000);
  });
}

module.exports = { parse, parseWithOllama };
