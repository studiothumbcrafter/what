const path = require('path');
const { dataDir, uploadsDir } = require('../services/storage');

describe('storage paths', () => {
  afterEach(() => {
    delete process.env.DATA_DIR;
  });

  test('defaults to the project data and uploads folders', () => {
    delete process.env.DATA_DIR;
    expect(dataDir()).toBe(path.join(__dirname, '..', 'data'));
    expect(uploadsDir()).toBe(path.join(__dirname, '..', 'uploads'));
  });

  test('uses DATA_DIR for the database and uploads when set', () => {
    process.env.DATA_DIR = path.join('tmp', 'render-disk');
    expect(dataDir()).toBe(path.join('tmp', 'render-disk'));
    expect(uploadsDir()).toBe(path.join('tmp', 'render-disk', 'uploads'));
  });
});
