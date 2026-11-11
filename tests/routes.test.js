const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-test-routes-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

const { init } = require('../db');
const db = init();
const Property = require('../models/Property');
Property.setDatabase(db);
const Customer = require('../models/Customer');
Customer.setDatabase(db);
const Match = require('../models/Match');
Match.setDatabase(db);

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});

describe('Owner view data shapes', () => {
  test('matches and customers join data is available to the dashboard queries', async () => {
    const p = await Property.create({ title: '2BHK Bandra', rent: 12000, location: 'Bandra, Mumbai', bedrooms: 2, bathrooms: 2, furnishing: 'furnished', parking: 1, balcony: 1, floor: 3, facilities: 'Lift', availability_date: '2026-12-01', info: 'x', status: 'available' });
    await Customer.upsert('+912222222222', 'Priya');
    await Customer.updateRequirements('+912222222222', { budgetMax: 12000, location: 'mumbai', bedrooms: 2 });
    await Match.record('+912222222222', p.id);

    // matches endpoint
    const rows = db.prepare('SELECT m.id, m.phone, m.property_id, m.shown_at, p.title, p.rent, p.location, p.bedrooms FROM matches m JOIN properties p ON p.id = m.property_id ORDER BY m.shown_at DESC').all();
    expect(rows.length).toBe(1);
    expect(rows[0].phone).toBe('+912222222222');
    expect(rows[0].title).toBe('2BHK Bandra');

    // customers endpoint
    const custs = db.prepare('SELECT * FROM customers ORDER BY updated_at DESC').all();
    expect(custs.length).toBe(1);
    expect(custs[0].phone).toBe('+912222222222');
    expect(JSON.parse(custs[0].requirements).budgetMax).toBe(12000);
  });
});
