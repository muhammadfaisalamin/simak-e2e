import { test, expect } from '@playwright/test';
import { getValidAcademicClassId } from './helpers/api-db';

/**
 * API Test Suite: GET /api/grade
 *
 * Priority 3 — Dedicated endpoint for exporting grades of a single academic class.
 * Used in the grading workflow: lecturer downloads template → fills in grades → uploads.
 *
 * Two modes tested separately:
 *   - Without ?template → export actual grades (ExportAssessmentGrade)
 *   - With ?template=1  → export blank template (ExportAssessmentTemplate)
 *
 * Both modes produce an XLSX file from the same class data (academicClassId),
 * but their content structure differs: blank template vs. filled grade columns.
 */

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function assertValidXlsx(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe(XLSX_CONTENT_TYPE);
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body[0]).toBe(0x50); // 'P' — ZIP magic bytes (XLSX = ZIP/OpenXML)
  expect(body[1]).toBe(0x4B); // 'K'
}

// ── Parameter validation (always runs) ───────────────────────────────────────

test.describe('GET /api/grade — parameter validation', () => {

  test('should return 400 if academicClassId is missing', async ({ request }) => {
    const res = await request.get('/api/grade');
    expect(res.status()).toBe(400);
  });


});

// ── Happy path — requires an AcademicClass record in the DB ──────────────────

test.describe('GET /api/grade — actual grades and template export', () => {

  let classId: string | null;

  test.beforeAll(async () => {
    classId = getValidAcademicClassId();
  });

  test('without ?template should return Excel with actual grades', async ({ request }) => {
    test.skip(!classId, 'No AcademicClass found in the database');

    const res = await request.get(`/api/grade?academicClassId=${classId}`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    // Content-Disposition: "Kelas {name} - ({code}) {courseName} - {period}.xlsx"
    expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
  });

  test('with ?template=1 should return an empty Excel template', async ({ request }) => {
    test.skip(!classId, 'No AcademicClass found in the database');

    const res = await request.get(`/api/grade?academicClassId=${classId}&template=1`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    // Same filename, but different file content (grade columns are empty)
    expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
  });

  test('both modes should produce a file with the same name', async ({ request }) => {
    test.skip(!classId, 'No AcademicClass found in the database');

    const [resActual, resTemplate] = await Promise.all([
      request.get(`/api/grade?academicClassId=${classId}`),
      request.get(`/api/grade?academicClassId=${classId}&template=1`),
    ]);
    // Filenames must be identical — only the Excel content differs
    expect(resActual.headers()['content-disposition'])
      .toBe(resTemplate.headers()['content-disposition']);
  });

});
