import { pool } from './db';

/**
 * Returns the sb25_students.id for the test student configured in .env.test.
 *
 * The login flow uses User.email === TEST_STUDENT_EMAIL.
 * This function joins sb25_students → sb25_users to resolve the Student UUID.
 *
 * Prerequisites in .env.test:
 *   TEST_STUDENT_EMAIL   — the student's login username (same value used in student.setup.ts)
 *
 * The test student must have these Student fields populated for the form to pass
 * disabled-field validation (year, major, lecturer):
 *   year       → Int    (e.g. 2023)
 *   majorId    → FK to sb25_majors
 *   lecturerId → FK to sb25_lecturers
 */
export async function getTestStudentId(): Promise<string> {
  const username = process.env.TEST_STUDENT_EMAIL;
  if (!username) throw new Error('TEST_STUDENT_EMAIL not set in .env.test');

  const result = await pool.query<{ id: string }>(
    `SELECT s.id
       FROM sb25_students s
       JOIN sb25_users   u ON s."userId" = u.id
      WHERE u.email = $1`,
    [username],
  );

  if (!result.rows[0]) {
    throw new Error(`No student record found for username: ${username}`);
  }
  return result.rows[0].id;
}
