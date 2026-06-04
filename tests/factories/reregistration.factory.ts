import { randomUUID } from 'crypto';
import { pool } from './db';

export type ReregistrationRecord = {
  id: string;
  name: string;
};

/**
 * Insert a Reregister row directly into the database.
 * Reregister has no @@unique constraint on name — duplicates are allowed at DB level.
 * Tests generate unique names with Date.now() suffixes to avoid cross-test interference.
 */
export async function createReregistration(
  name: string,
  periodId: string,
  isReregisterActive = false,
): Promise<ReregistrationRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_reregisters (id, name, "periodId", "isReregisterActive")
     VALUES ($1, $2, $3, $4)`,
    [id, name, periodId, isReregisterActive],
  );
  return { id, name };
}

/**
 * Delete a Reregister by its primary key.
 *
 * Teardown order:
 *   1. sb25_krs (onDelete: Restrict from Reregister) — safety net, no-op if empty
 *   2. sb25_reregisters — cascades ReregisterDetail (onDelete: Cascade)
 */
export async function deleteReregistrationById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_krs WHERE "reregisterId" = $1', [id]);
  await pool.query('DELETE FROM sb25_reregisters WHERE id = $1', [id]);
}

/**
 * Delete Reregister rows by name.
 * Used for UI-created rows where the DB ID is not known at cleanup time.
 * Since Reregister.name has no unique constraint, this may delete multiple rows
 * with identical names — safe in practice because tests always use unique name suffixes.
 */
export async function deleteReregistrationByName(name: string): Promise<void> {
  // Look up IDs then delete properly (handles Krs FK Restrict safety net)
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM sb25_reregisters WHERE name = $1',
    [name],
  );
  for (const row of result.rows) {
    await deleteReregistrationById(row.id);
  }
}
