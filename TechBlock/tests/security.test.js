const request = require('supertest');
const app = require('../app');

describe('Security Hardening & Information Exposure Suite', () => {
  test('GET /api/health should set HTTP Security Headers (Helmet)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toEqual(200);
    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers).toHaveProperty('x-frame-options');
    expect(res.headers).toHaveProperty('strict-transport-security');
    expect(res.headers['x-content-type-options']).toEqual('nosniff');
  });

  test('GET /api/non-existent-route should return clean 404 without server info', async () => {
    const res = await request(app).get('/api/non-existent-route');

    expect(res.statusCode).toEqual(404);
    expect(res.body.error).toEqual('Not Found');
    expect(res.body).not.toHaveProperty('stack');
  });

  test('Error handling should mask critical internal details on 500 error', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Mock route throwing error
    app.get('/api/test-error', (req, res, next) => {
      next(new Error('Internal database connection error at /var/secret/db.key'));
    });

    const res = await request(app).get('/api/test-error');

    expect(res.statusCode).toEqual(500);
    expect(res.body.error).toEqual('Internal Server Error');
    expect(res.body.message).toEqual('An unexpected error occurred. Please contact support.');
    expect(res.body).not.toHaveProperty('stack');

    process.env.NODE_ENV = originalEnv;
  });
});
