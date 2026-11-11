const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-test-media-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

const { init } = require('../db');
const db = init();
const Property = require('../models/Property');
Property.setDatabase(db);
const Media = require('../models/Media');
Media.setDatabase(db);

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});

describe('Media model', () => {
  test('adds photos and videos and lists them by property', async () => {
    const prop = await Property.create({
      title: 'Media Test',
      rent: 10000,
      location: 'Delhi',
      bedrooms: 1,
      bathrooms: 1,
      furnishing: 'unfurnished',
      parking: 0,
      balcony: 0,
      floor: 1,
      facilities: null,
      availability_date: '2026-12-01',
      info: null,
      status: 'available',
    });

    const photo = await Media.add(prop.id, 'photo', '/uploads/photos/1.jpg');
    expect(photo.id).toBeTruthy();
    expect(photo.property_id).toBe(prop.id);
    expect(photo.type).toBe('photo');

    const video = await Media.add(prop.id, 'video', '/uploads/videos/1.mp4');
    expect(video.type).toBe('video');

    const list = await Media.getByProperty(prop.id);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(2);
  });
});
