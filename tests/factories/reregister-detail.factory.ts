import { pool } from './db';

export type ReregisterDetailInput = {
  semester?: number;
  semesterStatus?: string;
  campusType?: string | null;
  nominal?: number | null;
  paymentStatus?: 'BELUM_LUNAS' | 'LUNAS';
  paymentDescription?: string | null;
  isStatusForm?: boolean;
  lecturerId?: string | null;
};

export async function createReregisterDetail(
  reregisterId: string,
  studentId: string,
  input: ReregisterDetailInput = {},
): Promise<{ reregisterId: string; studentId: string }> {
  await pool.query(
    `INSERT INTO sb25_reregister_details
       ("reregisterId", "studentId", semester, "semesterStatus", "campusType",
        nominal, "paymentStatus", "paymentDescription", "isStatusForm", "lecturerId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      reregisterId,
      studentId,
      input.semester ?? 1,
      input.semesterStatus ?? 'NONAKTIF',
      input.campusType ?? null,
      input.nominal ?? null,
      input.paymentStatus ?? 'BELUM_LUNAS',
      input.paymentDescription ?? null,
      input.isStatusForm ?? false,
      input.lecturerId ?? null,
    ],
  );
  return { reregisterId, studentId };
}

export async function deleteReregisterDetail(
  reregisterId: string,
  studentId: string,
): Promise<void> {
  await pool.query(
    'DELETE FROM sb25_reregister_details WHERE "reregisterId" = $1 AND "studentId" = $2',
    [reregisterId, studentId],
  );
}
