import { test, expect } from '@playwright/test';
import {
  getValidKrsId,
  getValidKhsId,
  getValidStudentIdForTranscript,
  getValidReregisterKey,
  getValidAcademicClassId,
  getValidPeriodId,
} from './helpers/api-db';

/**
 * API Test Suite: GET /api/pdf
 *
 * Priority 1 — This endpoint directly impacts students (KRS, KHS, transcript,
 * reregistration) and contains the most complex logic in the entire API layer
 * (transcript: predecessor/successor curriculum mapping, SKS concentration calculation).
 *
 * Binary validation strategy:
 *   - PDF magic bytes: first 4 bytes must be '%PDF' (ASCII)
 *   - Content-Type: 'application/pdf'
 *   - Content-Disposition: must contain 'attachment; filename='
 *   - Body size: > 100 bytes (not an error text response)
 *
 * Skip notes:
 *   Individual document types (krs, khs, transcript, reregister, assessment)
 *   require records in the DB. If none exist, the test is skipped automatically.
 *   Aggregate types (coursekrs, studentsXxx) generate a PDF even when data is empty.
 */

// ── Shared assertions ────────────────────────────────────────────────────────

function assertValidPdf(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe('application/pdf');
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
}

// ── Parameter validation (always runs, no DB data required) ──────────────────

test.describe('GET /api/pdf — parameter validation', () => {

  test('should return 400 if type parameter is missing', async ({ request }) => {
    const res = await request.get('/api/pdf?u=some-id');
    expect(res.status()).toBe(400);
  });

  test('should return 400 if u parameter is missing', async ({ request }) => {
    const res = await request.get('/api/pdf?type=krs');
    expect(res.status()).toBe(400);
  });

});

// ── Individual student documents (Priority 1a) ────────────────────────────────

test.describe('GET /api/pdf — type=krs (Study Plan Card)', () => {

  test('should return a valid PDF for an existing krsId', async ({ request }) => {
    const krsId = getValidKrsId();
    test.skip(!krsId, 'No KRS record found in the database');

    const res = await request.get(`/api/pdf?u=${krsId}&type=krs`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/KRS-/);
  });

  test('should return 400 for a non-existent krsId', async ({ request }) => {
    const res = await request.get('/api/pdf?u=00000000-0000-0000-0000-000000000000&type=krs');
    expect(res.status()).toBe(400);
  });

});

test.describe('GET /api/pdf — type=khs (Grade Card)', () => {

  test('should return a valid PDF for an existing khsId', async ({ request }) => {
    const khsId = getValidKhsId();
    test.skip(!khsId, 'No KHS record found in the database');

    const res = await request.get(`/api/pdf?u=${khsId}&type=khs`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/KHS-/);
  });


});

// ── Academic transcript (Priority 1b — most complex logic) ───────────────────

test.describe('GET /api/pdf — type=transcript (Academic Transcript)', () => {

  test('should return a valid PDF for an existing studentId', async ({ request }) => {
    const studentId = getValidStudentIdForTranscript();
    test.skip(!studentId, 'No student with complete data found in the database');

    const res = await request.get(`/api/pdf?u=${studentId}&type=transcript`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/TRANSCRIPT/);
  });

  test('should return 400 for a non-existent studentId', async ({ request }) => {
    const res = await request.get('/api/pdf?u=00000000-0000-0000-0000-000000000000&type=transcript');
    expect(res.status()).toBe(400);
  });

});

// ── Reregistration form (Priority 1c) ────────────────────────────────────────

test.describe('GET /api/pdf — type=reregister (Reregistration Form)', () => {

  test('should return a valid PDF for an existing reregisterId:studentId', async ({ request }) => {
    const key = getValidReregisterKey();
    test.skip(!key, 'No ReregisterDetail with isStatusForm=true found in the database');

    const res = await request.get(`/api/pdf?u=${key}&type=reregister`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/HERREGISTRASI-/);
  });

  test('should return 400 if u is not a valid reregisterId:studentId format', async ({ request }) => {
    const res = await request.get('/api/pdf?u=invalid-key-format&type=reregister');
    expect(res.status()).toBe(400);
  });

});

// ── Academic class grade list ─────────────────────────────────────────────────

test.describe('GET /api/pdf — type=assessment (Class Grade List)', () => {

  test('should return a valid PDF for an existing academicClassId', async ({ request }) => {
    const classId = getValidAcademicClassId();
    test.skip(!classId, 'No AcademicClass found in the database');

    const res = await request.get(`/api/pdf?u=${classId}&type=assessment`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/DAFTAR NILAI/);
  });


});

// ── Aggregate reports per period (200 even when data is empty) ────────────────

test.describe('GET /api/pdf — aggregate reports (using a valid periodId)', () => {

  // All aggregate types share one describe block so periodId is fetched only once
  let periodId: string | null;

  test.beforeAll(async () => {
    periodId = getValidPeriodId();
  });

  for (const type of [
    'coursekrs',
    'studentsRegisteredKrs',
    'studentsUnregisteredKrs',
    'studentsTakingThesis',
    'studentsTakingInternship',
    'studentActiveInactive',
    'studentsRegularSore',
  ] as const) {
    test(`type=${type} should return a valid PDF`, async ({ request }) => {
      test.skip(!periodId, 'No Period found in the database');

      const res = await request.get(`/api/pdf?u=${periodId}&type=${type}`);
      const body = await res.body();
      assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    });
  }

});
