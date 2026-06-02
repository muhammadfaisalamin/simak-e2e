import { pool } from './db';

export type MajorRecord = {
  id: number;
  name: string;
};

export async function createMajor(name: string): Promise<MajorRecord> {
  const result = await pool.query<{ id: number }>(
    'INSERT INTO sb25_majors (name) VALUES ($1) RETURNING id',
    [name],
  );
  return { id: result.rows[0].id, name };
}

export async function deleteMajorById(id: number): Promise<void> {
  await pool.query('DELETE FROM sb25_majors WHERE id = $1', [id]);
}
