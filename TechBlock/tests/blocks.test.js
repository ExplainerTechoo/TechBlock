const request = require('supertest');
const app = require('../app');
const UserStore = require('../src/models/User');
const BlockStore = require('../src/models/Block');

describe('TechBlock Storage Gateway API Suite', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;

  beforeEach(async () => {
    UserStore.clearInMemory();
    BlockStore.clearInMemory();

    // Register User 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user1', email: 'user1@example.com', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id || res1.body.user._id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user2', email: 'user2@example.com', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id || res2.body.user._id;
  });

  test('POST /api/blocks should create a block with calculated checksum', async () => {
    const res = await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'User 1 Block',
        data: 'Secret payload content 123',
        tags: ['backup', 'secure']
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.block).toHaveProperty('checksum');
    expect(res.body.block.title).toEqual('User 1 Block');
    expect(res.body.block.ownerId).toEqual(user1Id);
  });

  test('GET /api/blocks should enforce owner isolation (User 2 cannot see User 1 blocks)', async () => {
    // User 1 creates block
    await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'User 1 Confidential Block', data: 'Top Secret Data' });

    // User 2 lists blocks
    const res = await request(app)
      .get('/api/blocks')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.count).toEqual(0);
    expect(res.body.blocks).toHaveLength(0);
  });

  test('GET /api/blocks/:id should forbid unauthorized user access', async () => {
    const createRes = await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Private Block', data: 'Confidential Payload' });

    const blockId = createRes.body.block._id || createRes.body.block.id;

    // User 2 attempts to fetch User 1's block
    const fetchRes = await request(app)
      .get(`/api/blocks/${blockId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(fetchRes.statusCode).toEqual(403);
    expect(fetchRes.body.error).toEqual('Forbidden');
  });

  test('DELETE /api/blocks/:id should allow owner to delete block', async () => {
    const createRes = await request(app)
      .post('/api/blocks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Block to Delete', data: 'Temporary Payload' });

    const blockId = createRes.body.block._id || createRes.body.block.id;

    const delRes = await request(app)
      .delete(`/api/blocks/${blockId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(delRes.statusCode).toEqual(200);
    expect(delRes.body.message).toEqual('Storage block deleted successfully');
  });
});
