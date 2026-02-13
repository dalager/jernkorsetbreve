import { test, expect } from '@playwright/test';

test.describe('Letters API E2E Tests', () => {

  test.describe('GET /health', () => {
    test('should return healthy status', async ({ request }) => {
      const response = await request.get('/health');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.letters_count).toBeGreaterThan(0);
      expect(data.places_count).toBeGreaterThan(0);
    });
  });

  test.describe('GET /letters', () => {
    test('should return list of letter summaries', async ({ request }) => {
      const response = await request.get('/letters');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThan(0);
      expect(data.items.length).toBe(data.total);
    });

    test('letter summaries should have correct fields', async ({ request }) => {
      const response = await request.get('/letters');
      const data = await response.json();

      const letter = data.items[0];
      expect(letter.id).toBeDefined();
      expect(letter.date).toBeDefined();
      expect(letter.sender).toBeDefined();
      expect(letter.recipient).toBeDefined();
      // text should NOT be in summary
      expect(letter.text).toBeUndefined();
    });
  });

  test.describe('GET /letters/{id}', () => {
    test('should return full letter for valid ID', async ({ request }) => {
      const response = await request.get('/letters/1');
      expect(response.ok()).toBeTruthy();

      const letter = await response.json();
      expect(letter.id).toBe(1);
      expect(letter.text).toBeDefined();
      expect(letter.sender).toBeDefined();
      expect(letter.recipient).toBeDefined();
    });

    test('should return 404 for non-existent letter', async ({ request }) => {
      const response = await request.get('/letters/99999');
      expect(response.status()).toBe(404);

      const error = await response.json();
      expect(error.error_code).toBe('LETTER_NOT_FOUND');
      expect(error.message).toContain('99999');
      expect(error.request_id).toBeDefined();
    });

    test('should return 400 for invalid letter ID (zero)', async ({ request }) => {
      const response = await request.get('/letters/0');
      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error.error_code).toBe('INVALID_LETTER_ID');
    });

    test('should return 400 for invalid letter ID (negative)', async ({ request }) => {
      const response = await request.get('/letters/-5');
      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error.error_code).toBe('INVALID_LETTER_ID');
    });

    test('should include X-Request-ID header', async ({ request }) => {
      const response = await request.get('/letters/1');
      expect(response.headers()['x-request-id']).toBeDefined();
    });
  });

  test.describe('GET /places', () => {
    test('should return places dictionary', async ({ request }) => {
      const response = await request.get('/places');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThan(0);
    });

    test('places should have correct structure', async ({ request }) => {
      const response = await request.get('/places');
      const data = await response.json();

      const placeId = Object.keys(data.items)[0];
      const place = data.items[placeId];
      expect(place.id).toBeDefined();
      expect(place.name).toBeDefined();
    });
  });

  test.describe('GET /', () => {
    test('should return all letters with full details', async ({ request }) => {
      const response = await request.get('/');
      expect(response.ok()).toBeTruthy();

      const letters = await response.json();
      expect(Array.isArray(letters)).toBeTruthy();
      expect(letters.length).toBeGreaterThan(0);

      // First letter should have text
      expect(letters[0].text).toBeDefined();
    });
  });

  test.describe('Error Response Format', () => {
    test('error responses should have consistent structure', async ({ request }) => {
      const response = await request.get('/letters/99999');
      const error = await response.json();

      // Check all required fields
      expect(error.error_code).toBeDefined();
      expect(typeof error.error_code).toBe('string');

      expect(error.message).toBeDefined();
      expect(typeof error.message).toBe('string');

      expect(error.request_id).toBeDefined();
      expect(typeof error.request_id).toBe('string');
    });
  });

  test.describe('Data Integrity', () => {
    test('letter IDs should be sequential from 1', async ({ request }) => {
      const response = await request.get('/letters');
      const data = await response.json();

      // First letter should have ID 1
      expect(data.items[0].id).toBe(1);
    });

    test('all letters should be accessible by ID', async ({ request }) => {
      const listResponse = await request.get('/letters');
      const { total } = await listResponse.json();

      // Check first and last letter are accessible
      const firstResponse = await request.get('/letters/1');
      expect(firstResponse.ok()).toBeTruthy();

      const lastResponse = await request.get(`/letters/${total}`);
      expect(lastResponse.ok()).toBeTruthy();
    });
  });
});
