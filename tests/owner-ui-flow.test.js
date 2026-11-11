const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-owner-ui-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.WHATSAPP_APP_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../server');
const { init } = require('../db');

describe('Owner dashboard flow', () => {
  let token;
  let createdId;

  beforeAll(async () => {
    init();
    const login = await request(app)
      .post('/api/owner/login')
      .send({ username: 'admin', password: 'admin123' });
    token = login.body.token;
  });

  afterAll(() => {
    if (createdId) {
      const dir = path.join(__dirname, '..', 'uploads', 'photos');
      try {
        fs.readdirSync(dir)
          .filter((name) => name.includes('owner-ui-photo'))
          .forEach((name) => fs.unlinkSync(path.join(dir, name)));
      } catch (e) {}
    }
  });

  test('GET /owner serves the dashboard with plan and property UI', async () => {
    const res = await request(app).get('/owner');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Plan &amp; Billing');
    expect(res.text).toContain('Available plans');
    expect(res.text).toContain('addPropForm');
  });

  test('creates a property from JSON and uploads media to it', async () => {
    const created = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Owner UI property', rent: 9000, location: 'Test City', bedrooms: 2 });

    expect(created.status).toBe(201);
    createdId = created.body.id;
    expect(created.body.organization_id).toBeDefined();

    const media = await request(app)
      .post('/api/properties/' + createdId + '/media')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('fake-image'), 'owner-ui-photo.png');

    expect(media.status).toBe(200);
    expect(media.body.media.length).toBe(1);
    expect(media.body.media[0].type).toBe('photo');
  });

  test('the created property appears in the owner list', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.id === createdId)).toBe(true);
  });
});
