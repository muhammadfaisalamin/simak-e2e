import { test, expect } from '@playwright/test';
import { getValidAcademicClassId } from './helpers/api-db';

/**
 * API Test Suite: GET /api/grade
 *
 * Priority 3 — Endpoint khusus untuk export nilai satu kelas akademik.
 * Digunakan dalam alur penilaian: dosen download template → isi nilai → upload.
 *
 * Dua mode yang diuji secara terpisah:
 *   - Tanpa ?template  → export nilai aktual (ExportAssessmentGrade)
 *   - Dengan ?template → export template kosong  (ExportAssessmentTemplate)
 *
 * Kedua mode menghasilkan file XLSX dari data kelas yang sama (academicClassId),
 * tetapi struktur isinya berbeda: template kosong vs kolom nilai terisi.
 */

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function assertValidXlsx(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe(XLSX_CONTENT_TYPE);
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body[0]).toBe(0x50); // 'P' — ZIP magic bytes (XLSX = ZIP/OpenXML)
  expect(body[1]).toBe(0x4B); // 'K'
}

// ── Validasi parameter (selalu jalan) ─────────────────────────────────────────

test.describe('GET /api/grade — validasi parameter', () => {

  test('harus return 400 jika academicClassId tidak ada', async ({ request }) => {
    const res = await request.get('/api/grade');
    expect(res.status()).toBe(400);
  });


});

// ── Happy path — butuh AcademicClass di DB ────────────────────────────────────

test.describe('GET /api/grade — export nilai aktual dan template', () => {

  let classId: string | null;

  test.beforeAll(async () => {
    classId = getValidAcademicClassId();
  });

  test('tanpa ?template harus return Excel nilai aktual', async ({ request }) => {
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const res = await request.get(`/api/grade?academicClassId=${classId}`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    // Content-Disposition: "Kelas {name} - ({code}) {courseName} - {period}.xlsx"
    expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
  });

  test('dengan ?template harus return Excel template kosong', async ({ request }) => {
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const res = await request.get(`/api/grade?academicClassId=${classId}&template=1`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    // Filename sama, tetapi isi file berbeda (kolom nilai kosong)
    expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
  });

  test('kedua mode menghasilkan file dengan nama yang sama', async ({ request }) => {
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const [resActual, resTemplate] = await Promise.all([
      request.get(`/api/grade?academicClassId=${classId}`),
      request.get(`/api/grade?academicClassId=${classId}&template=1`),
    ]);
    // Nama file harus identik (hanya isi Excel yang berbeda)
    expect(resActual.headers()['content-disposition'])
      .toBe(resTemplate.headers()['content-disposition']);
  });

});
