import { test, expect } from '@playwright/test';
import { getValidAvatarFilename } from './helpers/api-db';

/**
 * API Test Suite: GET /api/avatar
 *
 * Priority 4 — Simple file serving for student photos.
 * No DB queries, no business logic; lowest regression risk.
 *
 * Files are stored in the folder configured via the AVATAR_FOLDER env variable.
 * Response is always inline (not attachment), so the image renders directly in the browser.
 *
 * Coverage:
 *   - Missing param → 400
 *   - File not found on disk → 404
 *   - Valid file → 200 + image/* Content-Type + Content-Disposition: inline
 */

test.describe('GET /api/avatar — parameter validation', () => {

  test('should return 400 if file parameter is missing', async ({ request }) => {
    const res = await request.get('/api/avatar');
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing file');
  });

});

test.describe('GET /api/avatar — file not found', () => {

  test('should return 404 for a filename that does not exist on disk', async ({ request }) => {
    const res = await request.get('/api/avatar?file=nonexistent_file_xyz.jpg');
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).toContain('File not found');
  });

});

test.describe('GET /api/avatar — happy path', () => {

  test('should return an image with the correct MIME type and Content-Disposition: inline', async ({ request }) => {
    const filename = await getValidAvatarFilename();
    test.skip(!filename, 'No student photo (Student.photo) found in the database');

    const res = await request.get(`/api/avatar?file=${encodeURIComponent(filename)}`);
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toMatch(/^image\//); // image/jpeg, image/png, etc.

    const disposition = res.headers()['content-disposition'];
    expect(disposition).toBe('inline');

    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
  });

});
