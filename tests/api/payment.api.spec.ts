import { test, expect } from '@playwright/test';
import { getValidPaymentFilename } from './helpers/api-db';

/**
 * API Test Suite: GET /api/payment
 *
 * Priority 5 — File serving for reregistration payment receipts.
 * Identical to /api/avatar, with one additional feature: the ?download=true parameter
 * changes Content-Disposition from inline to attachment.
 *
 * Coverage:
 *   - Missing param → 400
 *   - File not found → 404
 *   - Valid file + download=false (default) → inline
 *   - Valid file + download=true            → attachment with filename
 */

test.describe('GET /api/payment — parameter validation', () => {

  test('should return 400 if file parameter is missing', async ({ request }) => {
    const res = await request.get('/api/payment');
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing file');
  });

});

test.describe('GET /api/payment — file not found', () => {

  test('should return 404 for a filename that does not exist on disk', async ({ request }) => {
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

  test('without ?download should return file with Content-Disposition: inline', async ({ request }) => {
    test.skip(!filename, 'No paymentReceiptFile found in the database');

    const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toBe('inline');
    expect(res.headers()['content-type']).toBeTruthy();

    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('with ?download=false should return Content-Disposition: inline', async ({ request }) => {
    test.skip(!filename, 'No paymentReceiptFile found in the database');

    const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=false`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toBe('inline');
  });

  test('with ?download=true should return Content-Disposition: attachment with filename', async ({ request }) => {
    test.skip(!filename, 'No paymentReceiptFile found in the database');

    const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=true`);
    expect(res.status()).toBe(200);
    const disposition = res.headers()['content-disposition'];
    expect(disposition).toMatch(/^attachment; filename="/);
    expect(disposition).toContain(filename);
  });

  test('inline and download modes should produce identical response bodies', async ({ request }) => {
    test.skip(!filename, 'No paymentReceiptFile found in the database');

    const [resInline, resDownload] = await Promise.all([
      request.get(`/api/payment?file=${encodeURIComponent(filename)}`),
      request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=true`),
    ]);
    const bodyInline = await resInline.body();
    const bodyDownload = await resDownload.body();

    expect(bodyInline.length).toBe(bodyDownload.length);
    // File content must be identical — only the header differs
    expect(bodyInline.equals(bodyDownload)).toBe(true);
  });

});
