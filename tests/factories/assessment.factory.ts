import { randomUUID } from 'crypto';
import { pool } from './db';

export type AssessmentComponent = {
  gradeComponentId: string;
  percentage: number;
};

export type AssessmentRecord = {
  id: string;
  name: string;
};

/**
 * Insert an Assessment with one or more AssessmentDetail rows directly into the
 * database. Bypasses the UI so tests that verify Read/Update/Delete behaviour
 * do not depend on the Create UI flow.
 */
export async function createAssessment(
  name: string,
  components: AssessmentComponent[],
): Promise<AssessmentRecord> {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO sb25_assessments (id, name) VALUES ($1, $2)',
    [id, name],
  );
  for (const comp of components) {
    await pool.query(
      'INSERT INTO sb25_assessments_details (id, "assessmentId", "gradeId", percentage) VALUES ($1, $2, $3, $4)',
      [randomUUID(), id, comp.gradeComponentId, comp.percentage],
    );
  }
  return { id, name };
}

/**
 * Delete an Assessment by its database ID, removing AssessmentDetail children first.
 * Preferred over deleteAssessmentByName for DB-factory-created rows because the ID
 * is stable even after the assessment name is changed by an update test.
 */
export async function deleteAssessmentById(id: string): Promise<void> {
  await pool.query(
    'DELETE FROM sb25_assessments_details WHERE "assessmentId" = $1',
    [id],
  );
  await pool.query(
    'DELETE FROM sb25_assessments WHERE id = $1',
    [id],
  );
}

/**
 * Delete an Assessment by name. Used for UI-created assessments where only the
 * name is known at the time trackForCleanup is called.
 */
export async function deleteAssessmentByName(name: string): Promise<void> {
  await pool.query(
    `DELETE FROM sb25_assessments_details
     WHERE "assessmentId" = (SELECT id FROM sb25_assessments WHERE name = $1)`,
    [name],
  );
  await pool.query(
    'DELETE FROM sb25_assessments WHERE name = $1',
    [name],
  );
}
