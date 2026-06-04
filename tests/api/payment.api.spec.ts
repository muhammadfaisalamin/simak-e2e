import { test, expect } from '@playwright/test';
import { getValidPaymentFilename } from './helpers/api-db';

/**
 * API Test Suite: GET /api/payment
 *
 * Priority 5 — File serving untuk bukti pembayaran herregistrasi.
 * Identik dengan /api/avatar, ditambah satu fitur: parameter ?download=true
 * mengubah Content-Disposition dari inline ke attachment.
 *
 * Cakupan:
 *   - Missing param → 400
 *   - File tidak ditemukan → 404
 *   - File valid + download=false (default) → inline
 *   - File valid + download=true            → attachment dengan filename
 */

test.describe('GET /api/payment — validasi parameter', () => {

  test('harus return 400 jika parameter file tidak ada', async ({ request }) => {
    const res = await request.get('/api/payment');
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing file');
  });

});

test.describe('GET /api/payment — file tidak ditemukan', () => {

  test('harus return 404 untuk nama file yang tidak ada di disk', async ({ request }) => {
    const res = await request.get('/api/payment?file=nonexistent_receipt_xyz.pdf');
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).toContain('File not found');
  });

});

test.describe('GET /api/payment — happy path', () => {

  let filename: string | null;

  test.beforeAll(async () => {
    filename = await getValidPaymentFilename();
  });

  test('tanpa ?download harus return file dengan Content-Disposition inline', async ({ request }) => {
    test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

    const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toBe('inline');
    expect(res.headers()['content-type']).toBeTruthy();

    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('dengan ?download=false harus return Content-Disposition inline', async ({ request }) => {
    test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

    const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=false`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toBe('inline');
  });

  test('dengan ?download=true harus return Content-Disposition attachment dengan nama file', async ({ request }) => {
    test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

    const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=true`);
    expect(res.status()).toBe(200);
    const disposition = res.headers()['content-disposition'];
    expect(disposition).toMatch(/^attachment; filename="/);
    expect(disposition).toContain(filename);
  });

  test('mode inline dan download menghasilkan body yang identik', async ({ request }) => {
    test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

    const [resInline, resDownload] = await Promise.all([
      request.get(`/api/payment?file=${encodeURIComponent(filename)}`),
      request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=true`),
    ]);
    const bodyInline = await resInline.body();
    const bodyDownload = await resDownload.body();

    expect(bodyInline.length).toBe(bodyDownload.length);
    // Isi file harus sama persis — hanya header yang berbeda
    expect(bodyInline.equals(bodyDownload)).toBe(true);
  });

});
