import { test, expect } from '@playwright/test';
import { getValidPeriodId, getValidScheduleId } from './helpers/api-db';

/**
 * API Test Suite: GET /api/excel
 *
 * Priority 2 — Laporan Excel operasional kampus per periode.
 * Digunakan admin setiap awal semester untuk pengambilan keputusan.
 *
 * Strategi validasi binary:
 *   - Magic bytes XLSX: 2 byte pertama harus 0x50 0x4B ('PK', tanda file ZIP)
 *     karena XLSX adalah format ZIP/Open XML
 *   - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   - Content-Disposition: mengandung 'attachment; filename='
 *
 * Perilaku endpoint per tipe:
 *   - Semua tipe selain 'schedule' menggunakan u = periodId
 *   - 'schedule' menggunakan u = scheduleId (INKONSISTENSI yang perlu diperhatikan)
 *   - Tipe yang tidak dikenal → 400
 *   - Jika data kosong (periode tanpa mahasiswa) → 200 dengan Excel baris kosong
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

// ── Validasi parameter (selalu jalan) ─────────────────────────────────────────

test.describe('GET /api/excel — validasi parameter', () => {

  test('harus return 400 jika parameter type tidak ada', async ({ request }) => {
    const res = await request.get('/api/excel?u=some-id');
    expect(res.status()).toBe(400);
  });

  test('harus return 400 jika parameter u tidak ada', async ({ request }) => {
    const res = await request.get('/api/excel?type=coursekrs');
    expect(res.status()).toBe(400);
  });

  test('harus return 400 untuk type yang tidak dikenal', async ({ request }) => {
    const periodId = getValidPeriodId();
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=invalid_type`);
    expect(res.status()).toBe(400);
  });

});

// ── Laporan per periode (Priority 2a) ─────────────────────────────────────────

test.describe('GET /api/excel — laporan berbasis periodId', () => {

  let periodId: string | null;

  test.beforeAll(async () => {
    periodId = getValidPeriodId();
  });

  test('type=coursekrs harus return Excel rekapitulasi mata kuliah', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=coursekrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/REKAPITULASI MATA KULIAH/);
  });

  test('type=studentsRegisteredKrs harus return Excel mahasiswa sudah KRS', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsRegisteredKrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA SUDAH KRS/);
  });

  test('type=studentsUnregisteredKrs harus return Excel mahasiswa belum KRS', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsUnregisteredKrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA BELUM KRS/);
  });

  test('type=studentsTakingThesis harus return Excel mahasiswa program TA', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsTakingThesis`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA PROGRAM TA/);
  });

  test('type=studentsTakingInternship harus return Excel mahasiswa program PKL', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsTakingInternship`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/MAHASISWA PROGRAM PKL/);
  });

  test('type=studentActiveInactive harus return Excel status aktif/nonaktif', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentActiveInactive`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/AKTIF-NONAKTIF/);
  });

  test('type=studentsRegularSore harus return Excel pemisahan pagi/sore', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=studentsRegularSore`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/Reg\.Pagi-Sore/);
  });

});

// ── Jadwal perkuliahan (u = scheduleId, BUKAN periodId) ──────────────────────

test.describe('GET /api/excel — type=schedule (u = scheduleId)', () => {

  test('harus return Excel jadwal untuk scheduleId yang ada', async ({ request }) => {
    const scheduleId = getValidScheduleId();
    test.skip(!scheduleId, 'Tidak ada ScheduleDetail di database');

    const res = await request.get(`/api/excel?u=${scheduleId}&type=schedule`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/JADWAL PERKULIAHAN/);
  });

  test('harus return 404 untuk scheduleId yang tidak punya detail', async ({ request }) => {
    // Schedule tanpa detail → data kosong → endpoint return 404
    const res = await request.get('/api/excel?u=00000000-0000-0000-0000-000000000000&type=schedule');
    expect(res.status()).toBe(404);
  });

});
