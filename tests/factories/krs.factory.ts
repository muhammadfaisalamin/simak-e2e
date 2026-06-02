import { randomUUID } from 'crypto';
import { pool } from './db';

export type KrsRecord = {
  id: string;
};

export type KrsInput = {
  reregisterId: string;
  studentId: string;
  lecturerId?: string | null;
  maxSks?: number | null;
  isStatusForm?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEED_REVISION';
};

/**
 * Insert a KRS row. Prerequisites (must already exist):
 *   - sb25_reregisters row with id = reregisterId
 *   - sb25_reregister_details row with (reregisterId, studentId) composite PK
 *
 * KRS has a composite FK to ReregisterDetail (onDelete: Cascade), so deleting the
 * ReregisterDetail (or its parent Reregister) will cascade-delete this KRS.
 */
export async function createKrs(input: KrsInput): Promise<KrsRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_krs
       (id, "reregisterId", "studentId", "lecturerId", "maxSks", "isStatusForm", ips)
     VALUES ($1, $2, $3, $4, $5, $6, 0)`,
    [
      id,
      input.reregisterId,
      input.studentId,
      input.lecturerId ?? null,
      input.maxSks ?? null,
      input.isStatusForm ?? 'DRAFT',
    ],
  );
  return { id };
}

/**
 * Insert a KrsDetail row linking a course to a KRS.
 * KrsDetail cascades when its parent KRS is deleted.
 */
export async function createKrsDetail(
  krsId: string,
  courseId: string,
): Promise<{ id: string }> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_krs_details (id, "krsId", "courseId", "isAcc")
     VALUES ($1, $2, $3, false)`,
    [id, krsId, courseId],
  );
  return { id };
}

/**
 * Delete a KRS row by ID.
 * Cascades: KrsDetail, KrsOverride, and Khs (which cascades KhsDetail → KhsGrade).
 *
 * NOTE: Reregister has onDelete: Restrict on KRS, so delete KRS *before*
 * attempting to delete Reregister. The deleteReregistrationById helper in
 * reregistration.factory.ts already does this in the correct order.
 */
export async function deleteKrsById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_krs WHERE id = $1', [id]);
}
