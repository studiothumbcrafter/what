// AI Rental Assistant - Conversation state machine per phone number
// Stage 1: In-memory, no database, no WhatsApp

const { parse } = require('./parser');

const conversations = new Map();

function getState(phone) {
  if (!conversations.has(phone)) {
    conversations.set(phone, { state: 'greeting', requirements: {} });
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
      return 'Thank you! I have your requirements. Searching for matching properties...';
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
    return 'Thank you! I have your requirements. Searching for matching properties...';
  }

  // Unknown input fallback
  return 'I did not understand that. Please reply with your maximum monthly budget (e.g., ₹12,000).';
}

module.exports = { handleMessage, getState };
