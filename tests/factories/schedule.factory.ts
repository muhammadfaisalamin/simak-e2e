import { randomUUID } from 'crypto';
import { pool } from './db';

export type ScheduleRecord = {
  id: string;
  name: string;
};

export type ScheduleDetailInput = {
  academicClassId?: string | null;
  dayName?: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'MINGGU';
  timeId?: string | null;
  roomId?: number | null;
};

/**
 * Insert a Schedule row.
 * Schedule.periodId → Period.id (no onDelete specified → defaults to Restrict in Prisma).
 * ScheduleDetail rows cascade when this Schedule is deleted.
 */
export async function createSchedule(
  periodId: string,
  name: string,
): Promise<ScheduleRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_schedules (id, "periodId", name, "isActive")
     VALUES ($1, $2, $3, false)`,
    [id, periodId, name],
  );
  return { id, name };
}

/**
 * Insert a ScheduleDetail row linking a Schedule to an AcademicClass (optional).
 *
 * timeId and roomId are optional (nullable). The unique constraint
 * [academicClassId, timeId] uses PostgreSQL null-inequality semantics:
 * multiple rows with (classId, null) are allowed simultaneously.
 */
export async function createScheduleDetail(
  scheduleId: string,
  input: ScheduleDetailInput = {},
): Promise<{ id: string }> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_schedule_details
       (id, "scheduleId", "academicClassId", "dayName", "timeId", "roomId")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      scheduleId,
      input.academicClassId ?? null,
      input.dayName ?? 'SENIN',
      input.timeId ?? null,
      input.roomId ?? null,
    ],
  );
  return { id };
}

/**
 * Delete a Schedule and all its ScheduleDetail rows (cascade).
 * ScheduleDetail.academicClassId → AcademicClass with onDelete: Restrict means
 * deleting Schedule here is safe — we're removing ScheduleDetail via CASCADE,
 * not deleting AcademicClass.
 */
export async function deleteScheduleById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_schedules WHERE id = $1', [id]);
}
