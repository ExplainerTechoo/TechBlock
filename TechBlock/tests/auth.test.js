const request = require('supertest');
const app = require('../app');
const UserStore = require('../src/models/User');

describe('Authentication API Suite', () => {
  beforeEach(() => {
    UserStore.clearInMemory();
  });

  test('POST /api/auth/register should register a user and return a JWT token without password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'alice',
        email: 'alice@example.com',
        password: 'securepassword123'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toEqual('alice');
    expect(res.body.user.email).toEqual('alice@example.com');
    expect(res.body.user.password).toBeUndefined(); // Critical info masked!
  });

  test('POST /api/auth/register should fail with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bob',
        email: 'invalid-email-format',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Validation Error');
  });

  test('POST /api/auth/login should authenticate valid user and return JWT', async () => {
    // Register first
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'charlie',
        email: 'charlie@example.com',
        password: 'password123'
      });

    // Login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'charlie@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.password).toBeUndefined();
  });

  test('POST /api/auth/login should return generic error on invalid password to prevent enumeration', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'david',
        email: 'david@example.com',
        password: 'correctpassword'
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'david@example.com',
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toEqual('Invalid email or password.');
  });

  test('GET /api/auth/me should return authenticated user profile', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'eve',
        email: 'eve@example.com',
        password: 'password123'
      });

    const token = regRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.statusCode).toEqual(200);
    expect(meRes.body.user.username).toEqual('eve');
    expect(meRes.body.user.password).toBeUndefined();
  });
});
