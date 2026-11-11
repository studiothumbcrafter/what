const path = require('path');
const fs = require('fs');
const os = require('os');

// Use a temp DB for tests
const tmpDb = path.join(os.tmpdir(), `smartrent-test-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

const { init } = require('../db');
const db = init();
const Property = require('../models/Property');
Property.setDatabase(db);

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});

describe('Property model', () => {
  test('creates, reads, updates, changes status and removes a property', async () => {
    const prop = await Property.create({
      title: 'Test 2BHK',
      rent: 12000,
      location: 'Mumbai',
      bedrooms: 2,
      bathrooms: 2,
      furnishing: 'furnished',
      parking: 1,
      balcony: 1,
      floor: 3,
      facilities: 'Lift,Security',
      availability_date: '2026-12-01',
      info: 'Test property',
      status: 'available',
    });
    expect(prop.id).toBeTruthy();
    expect(prop.id.startsWith('PRP-')).toBe(true);
    expect(prop.rent).toBe(12000);
    expect(prop.bedrooms).toBe(2);

    const got = await Property.get(prop.id);
    expect(got).toBeTruthy();
    expect(got.title).toBe('Test 2BHK');
    expect(got.location).toBe('Mumbai');

    const all = await Property.getAll();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(1);

    const updated = await Property.update(prop.id, { rent: 13000 });
    expect(updated).toBeTruthy();
    expect(updated.rent).toBe(13000);
    expect((await Property.get(prop.id)).rent).toBe(13000);

    await Property.setStatus(prop.id, 'rented');
    expect((await Property.get(prop.id)).status).toBe('rented');

    await Property.remove(prop.id);
    expect(await Property.get(prop.id)).toBeUndefined();
  });
});
