import { randomUUID } from 'crypto';
import { pool } from './db';

export type PeriodRecord = {
  id: string;
  name: string;
  year: number;
  semesterType: 'GANJIL' | 'GENAP';
};

/**
 * Insert a Period row directly into the database.
 * Period.name has a @@unique constraint — callers must supply a unique name.
 */
export async function createPeriod(
  year: number,
  semesterType: 'GANJIL' | 'GENAP',
  name: string,
): Promise<PeriodRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_periods (id, year, "semesterType", name, "isActive")
     VALUES ($1, $2, $3, $4, false)`,
    [id, year, semesterType, name],
  );
  return { id, name, year, semesterType };
}

/**
 * Delete a Period by its primary key.
 * Must be called AFTER all Reregister rows that reference this Period are removed
 * (Period ↔ Reregister has onDelete: Restrict).
 */
export async function deletePeriodById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_periods WHERE id = $1', [id]);
}
