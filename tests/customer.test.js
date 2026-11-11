const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-test-cust-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

const { init } = require('../db');
const db = init();
const Customer = require('../models/Customer');
Customer.setDatabase(db);

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});

describe('Customer model', () => {
  test('upserts, stores requirements, state and messages', async () => {
    const c = await Customer.upsert('+919876543210', 'Rahul');
    expect(c.phone).toBeTruthy();
    expect(c.name).toBe('Rahul');
    expect(c.state).toBe('collecting');
    const phone = c.phone;

    const updated = await Customer.updateRequirements(phone, { budgetMax: 12000, bedrooms: 2 });
    expect(updated.requirements).toBeTruthy();
    expect(updated.requirements.budgetMax).toBe(12000);
    expect(updated.requirements.bedrooms).toBe(2);

    const reqs = await Customer.getRequirements(phone);
    expect(reqs.budgetMax).toBe(12000);

    await Customer.setState(phone, 'matching');
    expect(await Customer.getState(phone)).toBe('matching');

    await Customer.logMessage(phone, 'customer', 'I need 2BHK under 12000');
    await Customer.logMessage(phone, 'assistant', 'Got it, searching...');
    const conv = await Customer.getConversation(phone);
    expect(Array.isArray(conv)).toBe(true);
    expect(conv.length).toBeGreaterThanOrEqual(2);
  });
});
