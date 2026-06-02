import { randomUUID } from 'crypto';
import { pool } from './db';

export type CourseRecord = {
  id: string;
  name: string;
  code: string;
};

export type CourseInput = {
  name: string;
  code: string;
  sks: number;
  majorId: number;
  assessmentId: string;
  courseType: string;
  isPKL?: boolean;
  isSkripsi?: boolean;
};

export async function createCourse(input: CourseInput): Promise<CourseRecord> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO sb25_courses
       (id, name, code, sks, "majorId", "assessmentId", "courseType", "isPKL", "isSkripsi")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.name,
      input.code,
      input.sks,
      input.majorId,
      input.assessmentId,
      input.courseType,
      input.isPKL ?? false,
      input.isSkripsi ?? false,
    ],
  );
  return { id, name: input.name, code: input.code };
}

export async function deleteCourseById(id: string): Promise<void> {
  await pool.query('DELETE FROM sb25_courses WHERE id = $1', [id]);
}

export async function deleteCourseByCode(code: string): Promise<void> {
  await pool.query('DELETE FROM sb25_courses WHERE code = $1', [code]);
}
