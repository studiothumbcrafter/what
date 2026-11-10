const { handleMessage } = require('../services/ai-assistant');

describe('AI rental assistant - conversation state machine', () => {
  test('greeting transitions to collecting and asks budget', () => {
    const reply = handleMessage('+919876543210', 'hello');
    expect(reply).toContain('Hello');
    expect(reply).toContain('budget');
  });

  test('state persists per phone number', () => {
    handleMessage('+919876543210', 'hello');
    const reply = handleMessage('+919876543210', '12000');
    expect(reply).toContain('location');
  });

  test('different phone numbers have independent state', () => {
    handleMessage('+919876543210', 'hello');
    const reply = handleMessage('+919876543211', 'hello');
    expect(reply).toContain('budget');
  });

  test('unknown input returns a helpful string', () => {
    const reply = handleMessage('+919876543210', 'asdfghjkl');
    expect(reply).toBeDefined();
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });
});
