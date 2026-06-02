/**
 * DB helpers for API tests.
 *
 * Setiap fungsi membaca dari .auth/api-seed.json yang ditulis oleh
 * tests/api/global.setup.ts sebelum semua API test berjalan.
 *
 * Fungsi mengembalikan null jika seed file belum ada (misalnya saat
 * menjalankan test tanpa setup). Caller menggunakan test.skip(!id, reason)
 * untuk skip secara graceful.
 *
 * Pengecualian: getValidAvatarFilename dan getValidPaymentFilename masih
 * query DB langsung karena keduanya membutuhkan file fisik di disk yang
 * tidak dibuat oleh factory — test-nya tetap diskip jika tidak ada file.
 */
import * as fs from 'fs';
import { pool } from '../../factories/db';
import { SEED_FILE, type ApiSeedData } from './api-seed';

function readSeed(): ApiSeedData | null {
  try {
    return JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8')) as ApiSeedData;
  } catch {
    return null;
  }
}

// ── Individual student documents ───────────────────────────────────────────────

export function getValidKrsId(): string | null {
  return readSeed()?.krsId ?? null;
}

export function getValidKhsId(): string | null {
  return readSeed()?.khsId ?? null;
}

export function getValidStudentIdForTranscript(): string | null {
  return readSeed()?.studentId ?? null;
}

/**
 * Returns "reregisterId:studentId" — the format expected by /api/pdf?type=reregister.
 * The seeded ReregisterDetail has isStatusForm=true, which is required for PDF generation.
 */
export function getValidReregisterKey(): string | null {
  const seed = readSeed();
  if (!seed) return null;
  return `${seed.reregistrationId}:${seed.studentId}`;
}

// ── Class & period documents ───────────────────────────────────────────────────

export function getValidAcademicClassId(): string | null {
  return readSeed()?.academicClassId ?? null;
}

export function getValidPeriodId(): string | null {
  return readSeed()?.periodId ?? null;
}

export function getValidScheduleId(): string | null {
  return readSeed()?.scheduleId ?? null;
}

// ── File-based resources (still query DB — no factory can create files on disk) ─

/**
 * Returns the filename stored in Student.photo.
 * Tests using this will be skipped if no student has a photo on disk.
 */
export async function getValidAvatarFilename(): Promise<string | null> {
  const { rows } = await pool.query<{ photo: string }>(
    `SELECT photo FROM sb25_students
      WHERE photo IS NOT NULL AND photo <> ''
      LIMIT 1`,
  );
  return rows[0]?.photo ?? null;
}

/**
 * Returns the filename stored in ReregisterDetail.paymentReceiptFile.
 * Tests using this will be skipped if no payment receipt file exists on disk.
 */
export async function getValidPaymentFilename(): Promise<string | null> {
  const { rows } = await pool.query<{ f: string }>(
    `SELECT "paymentReceiptFile" AS f
       FROM sb25_reregister_details
      WHERE "paymentReceiptFile" IS NOT NULL AND "paymentReceiptFile" <> ''
      LIMIT 1`,
  );
  return rows[0]?.f ?? null;
}
