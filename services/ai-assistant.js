// AI Rental Assistant - Conversation state machine per phone number
// Stage 1: In-memory, no database, no WhatsApp

const conversations = new Map();

function getState(phone) {
  if (!conversations.has(phone)) {
    conversations.set(phone, { state: 'greeting', requirements: {} });
  }
  return conversations.get(phone);
}

function questionFor(field) {
  const q = {
    budgetMax: 'What is your maximum monthly budget (e.g., ₹12,000)?',
    location: 'Which area or city are you looking in?',
    bedrooms: 'How many bedrooms do you need (e.g., 2BHK)?',
  };
  return q[field];
}

function handleMessage(phone, text) {
  const state = getState(phone);
  const trimmed = text.trim().toLowerCase();

  // Human handover: AI paused
  if (state.humanHeld) {
    return undefined;
  }

  // Greeting state
  if (state.state === 'greeting') {
    if (trimmed === 'hello' || trimmed === 'hi' || trimmed === 'hey') {
      state.state = 'collecting';
      return 'Hello! 👋 Welcome to SmartRent AI. I can help you find a rental home. What is your maximum monthly budget (e.g., ₹12,000)?';
    }
    return 'Hello! 👋 Welcome to SmartRent AI. I can help you find a rental home. What is your maximum monthly budget (e.g., ₹12,000)?';
  }

  // Collecting state - budget
  if (state.state === 'collecting') {
    if (!state.requirements.budgetMax) {
      const budget = parseInt(trimmed.replace(/[^0-9]/g, ''));
      if (budget && budget > 0) {
        state.requirements.budgetMax = budget;
        state.missingField = 'location';
        return 'Which location or city are you looking in?';
      }
      return 'Please enter a valid budget (e.g., ₹12,000).';
    }
    // Location
    if (!state.requirements.location && state.missingField === 'location') {
      state.requirements.location = trimmed;
      state.missingField = 'bedrooms';
      return 'How many bedrooms do you need (e.g., 2BHK)?';
    }
    // Bedrooms
    if (!state.requirements.bedrooms && state.missingField === 'bedrooms') {
      const beds = parseInt(trimmed.replace(/[^0-9]/g, ''));
      if (beds && beds > 0) {
        state.requirements.bedrooms = beds;
        state.state = 'matching';
        return 'Thank you! I have your requirements. Searching for matching properties...';
      }
      return 'Please enter a valid number of bedrooms (e.g., 2).';
    }
  }

  // Unknown input fallback
  return 'I did not understand that. Please reply with your maximum monthly budget (e.g., ₹12,000).';
}

module.exports = { handleMessage, getState };
