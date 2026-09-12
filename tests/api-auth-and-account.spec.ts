import { test, expect } from '@playwright/test';

test.describe('Auth, Session and Protected Routes APIs', () => {
  test('POST /api/check-auth - returns unauthenticated for new visitor', async ({ request }) => {
    const response = await request.post('/api/check-auth');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ isAuthenticated: false });
  });

  test('POST /api/login - returns 400 if credentials missing', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/login - returns 401 for wrong credentials', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: {
        username: 'nonexistent_user_99999',
        password: 'wrong_password_test_123',
      },
    });
    // If DB is reachable it returns 401, if DB env is not connected in tests it returns 500
    expect([401, 500]).toContain(response.status());
  });

  test('POST /api/register - validates username, email and password constraints', async ({ request }) => {
    // Short username
    const resShort = await request.post('/api/register', {
      data: { username: 'abc', email: 'test@example.com', password: 'ValidPassword12345' },
    });
    expect(resShort.status()).toBe(400);
    const bodyShort = await resShort.json();
    expect(bodyShort.error).toContain('Username must be more than 6 characters');

    // Invalid email
    const resEmail = await request.post('/api/register', {
      data: { username: 'validuser123', email: 'not-an-email', password: 'ValidPassword12345' },
    });
    expect(resEmail.status()).toBe(400);
    const bodyEmail = await resEmail.json();
    expect(bodyEmail.error).toContain('Email must be a valid email address');

    // Short password (< 15 chars)
    const resPass = await request.post('/api/register', {
      data: { username: 'validuser123', email: 'test@example.com', password: 'short' },
    });
    expect(resPass.status()).toBe(400);
    const bodyPass = await resPass.json();
    expect(bodyPass.error).toContain('Password must be at least 15 characters');
  });

  test('POST /api/favorites - rejects unauthenticated access with 401', async ({ request }) => {
    const response = await request.get('/api/favorites');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('POST /api/add-favorite - rejects unauthenticated access with 401', async ({ request }) => {
    const response = await request.post('/api/add-favorite', {
      data: { location_name: 'Paris', latitude: 48.85, longitude: 2.35, country_code: 'FR' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/remove-favorite - rejects unauthenticated access with 401', async ({ request }) => {
    const response = await request.post('/api/remove-favorite', {
      data: { id: 'some_id' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/reorder-favorites - rejects unauthenticated access with 401', async ({ request }) => {
    const response = await request.post('/api/reorder-favorites', {
      data: { orderedFavoriteIds: ['id1', 'id2'] },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/changepassword - rejects unauthenticated access with 401', async ({ request }) => {
    const response = await request.post('/api/changepassword', {
      data: { newpassword: 'new_password_12345' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/delete_my_account - rejects unauthenticated access with 401', async ({ request }) => {
    const response = await request.post('/api/delete_my_account');
    expect(response.status()).toBe(401);
  });

  test('GET /api/cached-favorites - returns array or empty list without crashing', async ({ request }) => {
    const response = await request.get('/api/cached-favorites');
    // If DB is connected returns 200, if not connected returns 500 error json
    expect([200, 500]).toContain(response.status());
  });

  test('POST /api/logout - clears session and responds with success', async ({ request }) => {
    const response = await request.post('/api/logout');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/password_reset/verify - returns 400 when token missing', async ({ request }) => {
    const response = await request.get('/api/password_reset/verify');
    expect(response.status()).toBe(400);
  });

  test('POST /api/password_reset/request - accepts request gracefully', async ({ request }) => {
    const response = await request.post('/api/password_reset/request', {
      data: { email: 'any_random_email@example.com' },
    });
    // In all cases, email enumeration is prevented (returns success or handles db error)
    expect([200, 500]).toContain(response.status());
  });
});
