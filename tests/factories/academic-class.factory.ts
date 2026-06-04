import { randomUUID } from 'crypto';
import { pool } from './db';

export type AcademicClassRecord = {
  id: string;
  name: string;
};

export type AcademicClassInput = {
  name: string;
  periodId: string;
  lecturerId: string;
  courseId: string;
  semester?: number;
};

export async function createAcademicClass(
  input: AcademicClassInput,
): Promise<AcademicClassRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_academic_classes (id, name, "periodId", "lecturerId", "courseId", semester)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.name, input.periodId, input.lecturerId, input.courseId, input.semester ?? 1],
  );
  return { id, name: input.name };
}

/**
 * Delete an AcademicClass by ID.
 *
 * Teardown order caller must respect:
 *   1. Delete ScheduleDetail rows that reference this class first
 *      (ScheduleDetail.academicClassId has onDelete: Restrict)
 *   2. Presence rows also restrict — but we never create Presence in tests,
 *      so this is a no-op in practice.
 *   AcademicClassDetail rows cascade automatically.
 */
export async function deleteAcademicClassById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_academic_classes WHERE id = $1', [id]);
}
