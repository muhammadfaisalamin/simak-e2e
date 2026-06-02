import { randomUUID } from 'crypto';
import { pool } from './db';

export type KhsRecord = {
  id: string;
};

export type KhsInput = {
  krsId: string;
  studentId: string;
  periodId: string;
  semester?: number;
  ips?: number;
  maxSks?: number | null;
  isRPL?: boolean;
};

export type KhsDetailInput = {
  finalScore?: number;
  weight?: number;
  gradeLetter?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'ANNOUNCEMENT';
};

/**
 * Insert a KHS row. Prerequisites:
 *   - KRS row with id = krsId (krsId is unique in sb25_khs)
 *   - Student row with id = studentId
 *   - Period row with id = periodId
 *
 * KHS.krsId → Krs.id onDelete: Cascade, so KHS is cascade-deleted when KRS is deleted.
 * KHS.periodId → Period.id onDelete: Restrict, so Period cannot be deleted while KHS exists.
 */
export async function createKhs(input: KhsInput): Promise<KhsRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_khs
       (id, "krsId", "studentId", "periodId", semester, ips, "maxSks", "isRPL")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.krsId,
      input.studentId,
      input.periodId,
      input.semester ?? 1,
      input.ips ?? 0,
      input.maxSks ?? null,
      input.isRPL ?? false,
    ],
  );
  return { id };
}

/**
 * Insert a KhsDetail row (one grade record per course per KHS).
 *
 * version=0, isLatest=true — simplest valid state for the versioning system.
 * KhsDetail cascades when its parent KHS is deleted.
 */
export async function createKhsDetail(
  khsId: string,
  courseId: string,
  input: KhsDetailInput = {},
): Promise<{ id: string }> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_khs_details
       (id, "khsId", "courseId", "finalScore", weight, "gradeLetter", status,
        version, "isLatest", "validFrom")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, true, now())`,
    [
      id,
      khsId,
      courseId,
      input.finalScore ?? 80,
      input.weight ?? 3.5,
      input.gradeLetter ?? 'A',
      input.status ?? 'DRAFT',
    ],
  );
  return { id };
}

/**
 * Delete a KHS row by ID.
 * KhsDetail cascades, and KhsGrade cascades from KhsDetail.
 *
 * In normal teardown this is rarely called directly — deleting KRS cascade-deletes KHS.
 */
export async function deleteKhsById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_khs WHERE id = $1', [id]);
}
