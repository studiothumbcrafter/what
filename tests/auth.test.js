const { authenticateToken } = require('../services/auth');

describe('Owner authentication', () => {
  test('authenticateToken returns 401 when no token', async () => {
    const req = { headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticateToken returns 403 for invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticateToken sets req.user with org_id for valid token', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { sub: 'user-1', email: 'owner@example.com', role: 'owner', org_id: 'org-1' },
      'test-supabase-secret',
      { expiresIn: '7d' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    // Temporarily override SUPABASE_JWT_SECRET for this test
    const originalSecret = process.env.SUPABASE_JWT_SECRET;
    process.env.SUPABASE_JWT_SECRET = 'test-supabase-secret';

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-1');
    expect(req.user.org_id).toBe('org-1');
    expect(req.user.role).toBe('owner');

    process.env.SUPABASE_JWT_SECRET = originalSecret;
  });
});
