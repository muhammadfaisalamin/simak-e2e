import { test, expect } from '@playwright/test';
import { getValidPeriodId, getValidScheduleId } from './helpers/api-db';

/**
 * API Test Suite: GET /api/excel
 *
 * Priority 2 — Campus operational Excel reports per academic period.
 * Used by admin at the start of each semester for decision-making.
 *
 * Binary validation strategy:
 *   - XLSX magic bytes: first 2 bytes must be 0x50 0x4B ('PK', ZIP file signature)
 *     because XLSX is a ZIP/Open XML format
 *   - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   - Content-Disposition: must contain 'attachment; filename='
 *
 * Endpoint behaviour per type:
 *   - All types except 'schedule' use u = periodId
 *   - 'schedule' uses u = scheduleId (INCONSISTENCY — worth noting)
 *   - Unknown type → 400
 *   - Empty data (period with no students) → 200 with an empty-row Excel file
 */

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function assertValidXlsx(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe(XLSX_CONTENT_TYPE);
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  // XLSX = ZIP container, magic bytes: PK
  expect(body[0]).toBe(0x50); // 'P'
  expect(body[1]).toBe(0x4B); // 'K'
}

// ── Parameter validation (always runs) ───────────────────────────────────────

test.describe('GET /api/excel — parameter validation', () => {

  test('should return 400 if type parameter is missing', async ({ request }) => {
    const res = await request.get('/api/excel?u=some-id');
    expect(res.status()).toBe(400);
  });

  test('should return 400 if u parameter is missing', async ({ request }) => {
    const res = await request.get('/api/excel?type=coursekrs');
    expect(res.status()).toBe(400);
  });

  test('should return 400 for an unknown type', async ({ request }) => {
    const periodId = getValidPeriodId();
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=invalid_type`);
    expect(res.status()).toBe(400);
  });

});

// ── Period-based reports (Priority 2a) ───────────────────────────────────────

test.describe('GET /api/excel — period-based reports', () => {

  let periodId: string | null;

  test.beforeAll(async () => {
    periodId = getValidPeriodId();
  });

  test('type=coursekrs should return course KRS recapitulation Excel', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=coursekrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/REKAPITULASI MATA KULIAH/);
  });

  test('type=studentsRegisteredKrs should return Excel of students who have completed KRS', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsRegisteredKrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA SUDAH KRS/);
  });

  test('type=studentsUnregisteredKrs should return Excel of students who have not completed KRS', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsUnregisteredKrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA BELUM KRS/);
  });

  test('type=studentsTakingThesis should return Excel of students in the thesis program', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsTakingThesis`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA PROGRAM TA/);
  });

  test('type=studentsTakingInternship should return Excel of students in the internship program', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsTakingInternship`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA PROGRAM PKL/);
  });

  test('type=studentActiveInactive should return Excel of active/inactive student status', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentActiveInactive`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/AKTIF-NONAKTIF/);
  });

  test('type=studentsRegularSore should return Excel of morning/afternoon class separation', async ({ request }) => {
    test.skip(!periodId, 'No Period found in the database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsRegularSore`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/Reg\.Pagi-Sore/);
  });

});

// ── Class schedule report (u = scheduleId, NOT periodId) ─────────────────────

test.describe('GET /api/excel — type=schedule (u = scheduleId)', () => {

  test('should return class schedule Excel for an existing scheduleId', async ({ request }) => {
    const scheduleId = getValidScheduleId();
    test.skip(!scheduleId, 'No ScheduleDetail found in the database');

    const res = await request.get(`/api/excel?u=${scheduleId}&type=schedule`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/JADWAL PERKULIAHAN/);
  });

  test('should return 404 for a scheduleId with no schedule details', async ({ request }) => {
    // Schedule with no details → empty data → endpoint returns 404
    const res = await request.get('/api/excel?u=00000000-0000-0000-0000-000000000000&type=schedule');
    expect(res.status()).toBe(404);
  });

});
