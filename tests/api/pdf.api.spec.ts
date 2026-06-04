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
 * Priority 1 — Endpoint ini langsung berdampak ke mahasiswa (KRS, KHS, transkrip,
 * herregistrasi) dan mengandung logika paling kompleks di seluruh layer API
 * (transkrip: pemetaan predecessor/successor kurikulum, hitung SKS konsentrasi).
 *
 * Strategi validasi binary:
 *   - Magic bytes PDF: 4 byte pertama harus '%PDF' (ASCII)
 *   - Content-Type: 'application/pdf'
 *   - Content-Disposition: mengandung 'attachment; filename='
 *   - Ukuran body: > 100 bytes (bukan response error teks)
 *
 * Catatan skip:
 *   Tipe dokumen individual (krs, khs, transcript, reregister, assessment)
 *   membutuhkan record di DB. Jika tidak ada, test di-skip secara otomatis.
 *   Tipe agregat (coursekrs, studentsXxx) menghasilkan PDF walau data kosong.
 */

// ── Shared assertions ────────────────────────────────────────────────────────

function assertValidPdf(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe('application/pdf');
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
}

// ── Parameter validation (selalu jalan, tidak butuh data DB) ─────────────────

test.describe('GET /api/pdf — validasi parameter', () => {

  test('harus return 400 jika parameter type tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?u=some-id');
    expect(res.status()).toBe(400);
  });

  test('harus return 400 jika parameter u tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?type=krs');
    expect(res.status()).toBe(400);
  });

});

// ── Dokumen individual mahasiswa (Priority 1a) ────────────────────────────────

test.describe('GET /api/pdf — type=krs (Kartu Rencana Studi)', () => {

  test('harus return PDF valid untuk krsId yang ada', async ({ request }) => {
    const krsId = getValidKrsId();
    test.skip(!krsId, 'Tidak ada record KRS di database');

    const res = await request.get(`/api/pdf?u=${krsId}&type=krs`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/KRS-/);
  });

  test('harus return 400 untuk krsId yang tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?u=00000000-0000-0000-0000-000000000000&type=krs');
    expect(res.status()).toBe(400);
  });

});

test.describe('GET /api/pdf — type=khs (Kartu Hasil Studi)', () => {

  test('harus return PDF valid untuk khsId yang ada', async ({ request }) => {
    const khsId = getValidKhsId();
    test.skip(!khsId, 'Tidak ada record KHS di database');

    const res = await request.get(`/api/pdf?u=${khsId}&type=khs`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/KHS-/);
  });


});

// ── Transkrip akademik (Priority 1b — logika paling kompleks) ─────────────────

test.describe('GET /api/pdf — type=transcript (Transkrip Akademik)', () => {

  test('harus return PDF valid untuk studentId yang ada', async ({ request }) => {
    const studentId = getValidStudentIdForTranscript();
    test.skip(!studentId, 'Tidak ada student dengan data lengkap di database');

    const res = await request.get(`/api/pdf?u=${studentId}&type=transcript`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/TRANSCRIPT/);
  });

  test('harus return 400 untuk studentId yang tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?u=00000000-0000-0000-0000-000000000000&type=transcript');
    expect(res.status()).toBe(400);
  });

});

// ── Formulir herregistrasi (Priority 1c) ─────────────────────────────────────

test.describe('GET /api/pdf — type=reregister (Formulir Herregistrasi)', () => {

  test('harus return PDF valid untuk reregisterId:studentId yang ada', async ({ request }) => {
    const key = getValidReregisterKey();
    test.skip(!key, 'Tidak ada ReregisterDetail dengan isStatusForm=true di database');

    const res = await request.get(`/api/pdf?u=${key}&type=reregister`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/HERREGISTRASI-/);
  });

  test('harus return 400 jika format u bukan reregisterId:studentId yang valid', async ({ request }) => {
    const res = await request.get('/api/pdf?u=invalid-key-format&type=reregister');
    expect(res.status()).toBe(400);
  });

});

// ── Daftar nilai kelas akademik ────────────────────────────────────────────────

test.describe('GET /api/pdf — type=assessment (Daftar Nilai Kelas)', () => {

  test('harus return PDF valid untuk academicClassId yang ada', async ({ request }) => {
    const classId = getValidAcademicClassId();
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const res = await request.get(`/api/pdf?u=${classId}&type=assessment`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/DAFTAR NILAI/);
  });


});

// ── Laporan agregat per periode (200 walau data kosong) ───────────────────────

test.describe('GET /api/pdf — laporan agregat (menggunakan periodId yang ada)', () => {

  // Semua tipe agregat bagian dari satu describe agar periodId di-fetch sekali
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
    test(`type=${type} harus return PDF valid`, async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res = await request.get(`/api/pdf?u=${periodId}&type=${type}`);
      const body = await res.body();
      assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    });
  }

});
