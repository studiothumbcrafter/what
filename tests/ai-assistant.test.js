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
    expect(reply).not.toContain('budget');
    expect(reply).not.toContain('location');
    expect(reply).not.toContain('bedroom');
    expect(reply).toContain('Searching for matching properties');
  });

  test('parser.js extracts all mandatory fields from one natural language message', () => {
    const reply = handleMessage('+919876543291', '2BHK under 15000 in Delhi');
    expect(reply).toContain('Searching for matching properties');
  });
});
