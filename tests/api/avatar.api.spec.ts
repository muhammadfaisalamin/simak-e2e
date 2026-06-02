import { test, expect } from '@playwright/test';
import { getValidAvatarFilename } from './helpers/api-db';

/**
 * API Test Suite: GET /api/avatar
 *
 * Priority 4 — File serving sederhana untuk foto mahasiswa.
 * Tidak ada DB query, tidak ada business logic; risiko regresi paling rendah.
 *
 * File disimpan di folder yang dikonfigurasi via env AVATAR_FOLDER.
 * Response selalu inline (bukan attachment), sehingga gambar tampil di browser.
 *
 * Cakupan:
 *   - Missing param → 400
 *   - File tidak ditemukan di disk → 404
 *   - File valid → 200 + image/* Content-Type + Content-Disposition: inline
 */

test.describe('GET /api/avatar — validasi parameter', () => {

  test('harus return 400 jika parameter file tidak ada', async ({ request }) => {
    const res = await request.get('/api/avatar');
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing file');
  });

});

test.describe('GET /api/avatar — file tidak ditemukan', () => {

  test('harus return 404 untuk nama file yang tidak ada di disk', async ({ request }) => {
    const res = await request.get('/api/avatar?file=nonexistent_file_xyz.jpg');
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).toContain('File not found');
  });

});

test.describe('GET /api/avatar — happy path', () => {

  test('harus return gambar dengan MIME type yang tepat dan Content-Disposition inline', async ({ request }) => {
    const filename = await getValidAvatarFilename();
    test.skip(!filename, 'Tidak ada foto mahasiswa (Student.photo) di database');

    const res = await request.get(`/api/avatar?file=${encodeURIComponent(filename)}`);
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toMatch(/^image\//); // image/jpeg, image/png, dll

    const disposition = res.headers()['content-disposition'];
    expect(disposition).toBe('inline');

    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
  });

});
