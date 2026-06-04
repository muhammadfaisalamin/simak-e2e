import { randomUUID } from 'crypto';
import { pool } from './db';

export type GradeComponentRecord = {
  id: string;
  name: string;
  acronym: string;
};

/**
 * Insert a GradeComponent row directly into the database.
 * Returns the record including the generated UUID so callers can pass it to
 * deleteGradeComponentById for teardown.
 */
export async function createGradeComponent(
  name: string,
  acronym: string,
): Promise<GradeComponentRecord> {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO sb25_grade_components (id, name, acronym) VALUES ($1, $2, $3)',
    [id, name, acronym],
  );
  return { id, name, acronym };
}

/**
 * Insert N GradeComponent rows at once. Useful for multi-component assessment tests.
 * Names are "${namePrefix} 1", "${namePrefix} 2", …
 * Acronyms are "${acronymPrefix}1", "${acronymPrefix}2", …
 */
export async function createGradeComponents(
  count: number,
  namePrefix: string,
  acronymPrefix: string,
): Promise<GradeComponentRecord[]> {
  const records: GradeComponentRecord[] = [];
  for (let i = 1; i <= count; i++) {
    records.push(await createGradeComponent(`${namePrefix} ${i}`, `${acronymPrefix}${i}`));
  }
  return records;
}

/**
 * Delete a GradeComponent by name. Used for UI-created rows where only the name
 * is known at cleanup time (no DB ID returned by the create form).
 */
export async function deleteGradeComponentByName(name: string): Promise<void> {
  await pool.query(
    'DELETE FROM sb25_assessments_details WHERE "gradeId" = (SELECT id FROM sb25_grade_components WHERE name = $1)',
    [name],
  );
  await pool.query(
    'DELETE FROM sb25_grade_components WHERE name = $1',
    [name],
  );
}

/**
 * Delete a GradeComponent by its database ID.
 *
 * AssessmentDetail rows that reference this GC via gradeId carry onDelete: Restrict,
 * so they must be removed first. In normal teardown the assessment fixture has already
 * deleted them via the UI; this step is a safety net for partial-failure cases.
 */
export async function deleteGradeComponentById(id: string): Promise<void> {
  await pool.query(
    'DELETE FROM sb25_assessments_details WHERE "gradeId" = $1',
    [id],
  );
  await pool.query(
    'DELETE FROM sb25_grade_components WHERE id = $1',
    [id],
  );
}
