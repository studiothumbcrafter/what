// AI Rental Assistant - Conversation state machine per phone number
// Stage 1: In-memory, no database, no WhatsApp

const { parse } = require('./parser');
const { match } = require('./matcher');

const conversations = new Map();

// Sample properties (in-memory for Stage 1; replaced by DB in Stage 2)
const SAMPLE_PROPERTIES = [
  {
    id: 'prop-1',
    title: '2BHK Family Home',
    rent: 12000,
    location: 'mumbai',
    bedrooms: 2,
    bathrooms: 2,
    furnishing: 'furnished',
    parking: 1,
    balcony: 1,
    floor: 5,
    facilities: 'parking, balcony, security',
    availability_date: '2027-01-01',
    info: 'Spacious 2BHK in prime location with balcony and parking.',
    status: 'available',
    photos: ['https://example.com/prop1-photo1.jpg', 'https://example.com/prop1-photo2.jpg'],
  },
  {
    id: 'prop-2',
    title: '3BHK Luxury Apartment',
    rent: 18000,
    location: 'mumbai',
    bedrooms: 3,
    bathrooms: 3,
    furnishing: 'semi-furnished',
    parking: 1,
    balcony: 1,
    floor: 8,
    facilities: 'parking, security, gym',
    availability_date: '2026-12-01',
    info: 'Luxury 3BHK with gym and security.',
    status: 'available',
    photos: ['https://example.com/prop2-photo1.jpg'],
  },
  {
    id: 'prop-3',
    title: '2BHK Budget Home',
    rent: 9000,
    location: 'mumbai',
    bedrooms: 2,
    bathrooms: 1,
    furnishing: 'unfurnished',
    parking: 0,
    balcony: 0,
    floor: 2,
    facilities: 'security',
    availability_date: '2026-11-15',
    info: 'Affordable 2BHK for bachelors and small families.',
    status: 'available',
    photos: ['https://example.com/prop3-photo1.jpg', 'https://example.com/prop3-photo2.jpg', 'https://example.com/prop3-photo3.jpg'],
  },
  {
    id: 'prop-4',
    title: '2BHK Delhi Home',
    rent: 11000,
    location: 'delhi',
    bedrooms: 2,
    bathrooms: 2,
    furnishing: 'furnished',
    parking: 1,
    balcony: 1,
    floor: 3,
    facilities: 'parking, balcony, power backup',
    availability_date: '2027-02-01',
    info: 'Furnished 2BHK in Delhi with parking.',
    status: 'available',
    photos: ['https://example.com/prop4-photo1.jpg'],
  },
];

function getState(phone) {
  if (!conversations.has(phone)) {
    conversations.set(phone, { state: 'greeting', requirements: {}, humanHeld: false });
  }
  return conversations.get(phone);
}

const MANDATORY = ['budgetMax', 'location', 'bedrooms'];

function questionFor(field) {
  const q = {
    budgetMax: 'What is your maximum monthly budget (e.g., ₹12,000)?',
    location: 'Which location or city are you looking in?',
    bedrooms: 'How many bedrooms do you need (e.g., 2BHK)?',
  };
  return q[field];
}

function findMissing(state) {
  for (const field of MANDATORY) {
    if (!state.requirements[field]) return field;
  }
  return null;
}

// Manual fallback extraction for simple inputs that parser.js may miss
function manualParse(text) {
  const lowered = text.toLowerCase();
  const req = {};

  // Budget: plain numbers like "12000" or "12k"
  const budgetMatch = lowered.match(/^[\d,]+(\.\d+)?\s*(k)?$/);
  if (budgetMatch) {
    let val = parseFloat(budgetMatch[0].replace(/,/g, ''));
    if (budgetMatch[2] === 'k') val *= 1000;
    req.budgetMax = val;
  }

  // Bedrooms: "2bhk", "2 bedroom", "2 bed"
  const bhkMatch = lowered.match(/(\d+)\s*bhk|(\d+)\s*bedroom|(\d+)\s*bed\b/);
  if (bhkMatch) {
    req.bedrooms = parseInt(bhkMatch[1] || bhkMatch[2] || bhkMatch[3]);
  }

  // Location: treat as location if it's a single word/phrase not matching other patterns
  const words = lowered.trim().split(/\s+/);
  if (words.length <= 3 && !req.budgetMax && !req.bedrooms) {
    req.location = lowered;
  }

  return req;
}

function formatMatchResult(m) {
  const p = m.property;
  let text = `*${p.title}*\n`;
  text += `₹${p.rent}/month • ${p.location}\n`;
  text += `${p.bedrooms} BHK • ${p.bathrooms || '-'} bath`;
  if (p.furnishing) text += ` • ${p.furnishing}`;
  if (p.parking === 1) text += ' • Parking';
  if (p.balcony === 1) text += ' • Balcony';
  text += `\nWhy it matches: ${m.matchReasons.join('; ')}.\n`;
  text += `Photos: ${p.photos.length} available\n`;
  return text;
}

function formatMatches(matches) {
  if (matches.length === 0) {
    return 'Sorry, I couldn\u2019t find any available properties matching your requirements. Would you like to relax one requirement (budget, location, or bedrooms)?';
  }

  let text = `Here are the best matching properties (showing ${Math.min(matches.length, 3)}):\n\n`;
  matches.slice(0, 3).forEach((m, i) => {
    text += `${i + 1}. ${formatMatchResult(m)}\n`;
  });
  text += '\nReply with a property number to book a visit, or ask me to show more.';
  return text;
}

function handleMessage(phone, text) {
  const state = getState(phone);
  const trimmed = text.trim();
  const lowered = trimmed.toLowerCase();

  // Human handover: AI paused
  if (state.humanHeld) {
    return undefined;
  }

  // Greeting state
  if (state.state === 'greeting') {
    if (lowered === 'hello' || lowered === 'hi' || lowered === 'hey') {
      state.state = 'collecting';
      return 'Hello! 👋 Welcome to SmartRent AI. I can help you find a rental home. What is your maximum monthly budget (e.g., ₹12,000)?';
    }
    // Try parsing natural language even in greeting
    const parsed = parse(lowered);
    const parsedReqs = parsed.requirements || {};
    const manualReqs = manualParse(lowered);
    const merged = { ...parsedReqs };
    for (const field of MANDATORY) {
      if (!merged[field] && manualReqs[field]) {
        merged[field] = manualReqs[field];
      }
    }
    for (const field of MANDATORY) {
      if (merged[field]) {
        state.requirements[field] = merged[field];
      }
    }
    const missing = findMissing(state);
    if (!missing) {
      state.state = 'matching';
      const results = match(state.requirements, SAMPLE_PROPERTIES);
      return formatMatches(results);
    }
    state.state = 'collecting';
    return questionFor(missing);
  }

  // Collecting state - use parser.js with manual fallback
  if (state.state === 'collecting') {
    const parsed = parse(trimmed);
    const parsedReqs = parsed.requirements || {};

    // Manual fallback for fields parser.js missed
    const manualReqs = manualParse(trimmed);

    // Merge: parsed first, then manual fill gaps
    const merged = { ...parsedReqs };
    for (const field of MANDATORY) {
      if (!merged[field] && manualReqs[field]) {
        merged[field] = manualReqs[field];
      }
    }

    // Update state with merged requirements
    for (const field of MANDATORY) {
      if (merged[field]) {
        state.requirements[field] = merged[field];
      }
    }

    const missing = findMissing(state);

    if (missing) {
      return questionFor(missing);
    }

    // All mandatory fields collected
    state.state = 'matching';
    const results = match(state.requirements, SAMPLE_PROPERTIES);
    return formatMatches(results);
  }

  // Matching state - handle property selection or new search
  if (state.state === 'matching') {
    const numMatch = trimmed.match(/^(\d+)$/);
    if (numMatch) {
      const choice = parseInt(numMatch[1]);
      const results = match(state.requirements, SAMPLE_PROPERTIES);
      const selected = results[choice - 1];
      if (selected) {
        state.state = 'visit_pending';
        state.pendingVisit = {
          propertyId: selected.property.id,
          propertyTitle: selected.property.title,
          propertyRent: selected.property.rent,
          propertyLocation: selected.property.location,
        };
        return `Shall I book a visit for *${selected.property.title}*?\n₹${selected.property.rent}/month • ${selected.property.location}\nReply "yes" to confirm or "no" to cancel.`;
      }
      return 'Invalid property number. Please select a valid number from the list.';
    }
    // New search - reset and start over
    state.state = 'greeting';
    state.requirements = {};
    return 'Hello! 👋 Welcome back to SmartRent AI. What is your maximum monthly budget (e.g., ₹12,000)?';
  }

  // Visit pending state - confirm or cancel
  if (state.state === 'visit_pending') {
    if (lowered === 'yes' || lowered === 'ok' || lowered === 'confirm' || lowered === 'sure' || lowered === 'y') {
      const v = state.pendingVisit;
      state.state = 'matching';
      state.pendingVisit = null;
      return `✅ Visit booked for *${v.propertyTitle}*!\n\nRent: ₹${v.propertyRent}/month\nLocation: ${v.propertyLocation}\n\nI\u2019ll confirm the visit date & time with you shortly.`;
    }
    if (lowered === 'no' || lowered === 'cancel' || lowered === 'not now' || lowered === 'n') {
      state.state = 'matching';
      state.pendingVisit = null;
      return 'Okay, visit cancelled. Let me know if you want to see other properties.';
    }
    return 'Please reply "yes" to confirm the visit or "no" to cancel.';
  }

  // Unknown input fallback
  return 'I did not understand that. Please reply with your maximum monthly budget (e.g., ₹12,000).';
}

function takeover(phone) {
  const state = getState(phone);
  state.humanHeld = true;
}

function reactivate(phone) {
  const state = getState(phone);
  state.humanHeld = false;
}

module.exports = { handleMessage, getState, takeover, reactivate };
