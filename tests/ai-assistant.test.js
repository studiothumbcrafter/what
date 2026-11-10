const { handleMessage } = require('../services/ai-assistant');

describe('AI rental assistant - conversation state machine', () => {
  test('greeting transitions to collecting and asks budget', () => {
    const reply = handleMessage('+919876543201', 'hello');
    expect(reply).toContain('Hello');
    expect(reply).toContain('budget');
  });

  test('state persists per phone number', () => {
    handleMessage('+919876543202', 'hello');
    const reply = handleMessage('+919876543202', '12000');
    expect(reply).toContain('location');
  });

  test('different phone numbers have independent state', () => {
    handleMessage('+919876543203', 'hello');
    const reply = handleMessage('+919876543204', 'hello');
    expect(reply).toContain('budget');
  });

  test('unknown input returns a helpful string', () => {
    const reply = handleMessage('+919876543205', 'asdfghjkl');
    expect(reply).toBeDefined();
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });

  test('full mandatory field collection transitions to matching', () => {
    let reply = handleMessage('+919876543290', 'hello');
    expect(reply).toContain('budget');
    reply = handleMessage('+919876543290', '12000');
    expect(reply).toContain('location');
    reply = handleMessage('+919876543290', 'Mumbai');
    expect(reply).toContain('bedroom');
    reply = handleMessage('+919876543290', '2BHK');
    expect(reply).toContain('₹');
    expect(reply).toContain('match');
    expect(reply).toContain('Photos');
  });

  test('parser.js extracts all mandatory fields from one natural language message', () => {
    const reply = handleMessage('+919876543291', '2BHK under 15000 in Delhi');
    expect(reply).toContain('₹');
    expect(reply).toContain('delhi');
  });

  test('match result formatting shows properties with details', () => {
    let reply = handleMessage('+919876543300', 'hello');
    reply = handleMessage('+919876543300', '12000');
    reply = handleMessage('+919876543300', 'Mumbai');
    reply = handleMessage('+919876543300', '2BHK');
    expect(reply).toContain('₹');
    expect(reply).toContain('mumbai');
    expect(reply).toContain('match');
  });

  test('match result formatting shows max 3 properties', () => {
    let reply = handleMessage('+919876543301', 'hello');
    reply = handleMessage('+919876543301', '10000');
    reply = handleMessage('+919876543301', 'mumbai');
    reply = handleMessage('+919876543301', '2');
    // Count property price mentions - should be max 3
    const rentMatches = reply.match(/₹\d+/g) || [];
    expect(rentMatches.length).toBeLessThanOrEqual(3);
  });
});
