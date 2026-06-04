import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { pool } from '../factories/db';
import { createPeriod } from '../factories/period.factory';
import { createReregistration } from '../factories/reregistration.factory';
import { createReregisterDetail } from '../factories/reregister-detail.factory';
import { createKrs, createKrsDetail } from '../factories/krs.factory';
import { createKhs, createKhsDetail } from '../factories/khs.factory';
import { createAcademicClass } from '../factories/academic-class.factory';
import { createSchedule, createScheduleDetail } from '../factories/schedule.factory';
import { getTestStudentId } from '../factories/student.factory';
import { SEED_FILE, type ApiSeedData } from './helpers/api-seed';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// ── Helper: get or create a Time entry ────────────────────────────────────────

async function resolveOrCreateTime(): Promise<{ timeId: string; createdTimeId: string | null }> {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM sb25_times LIMIT 1`);
  if (rows[0]) return { timeId: rows[0].id, createdTimeId: null };

  const { randomUUID } = await import('crypto');
  const timeId = randomUUID();
  await pool.query(
    `INSERT INTO sb25_times (id, "timeStart", "timeFinish") VALUES ($1, '07:00:00', '09:30:00')`,
    [timeId],
  );
  return { timeId, createdTimeId: timeId };
}

// ── Helper: get or create a Room entry ────────────────────────────────────────

async function resolveOrCreateRoom(): Promise<{ roomId: number; createdRoomId: number | null }> {
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM sb25_rooms LIMIT 1`);
  if (rows[0]) return { roomId: rows[0].id, createdRoomId: null };

  const { rows: inserted } = await pool.query<{ id: number }>(
    `INSERT INTO sb25_rooms (name, location, capacity) VALUES ('E2E Room', 'BJB', 30) RETURNING id`,
  );
  return { roomId: inserted[0].id, createdRoomId: inserted[0].id };
}

// ── Helper: get any existing lecturer from DB ──────────────────────────────────

async function resolveExistingLecturerId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM sb25_lecturers LIMIT 1`,
  );
  if (!rows[0]) throw new Error('No lecturer found in DB. At least one lecturer must exist.');
  return rows[0].id;
}

// ── Helper: get or create a course (returns courseId) ─────────────────────────

async function resolveOrCreateCourse(
  majorId: number | null,
): Promise<{ courseId: string; createdAssessmentId: string | null; createdCourseId: string | null }> {
  // Prefer a course that matches the student's major (for curriculum coherence)
  const { rows } = await pool.query<{ id: string }>(
    majorId
      ? `SELECT id FROM sb25_courses WHERE "majorId" = $1 LIMIT 1`
      : `SELECT id FROM sb25_courses LIMIT 1`,
    majorId ? [majorId] : [],
  );

  if (rows[0]) {
    return { courseId: rows[0].id, createdAssessmentId: null, createdCourseId: null };
  }

  // Fallback: try any course
  const { rows: anyRows } = await pool.query<{ id: string }>(
    `SELECT id FROM sb25_courses LIMIT 1`,
  );
  if (anyRows[0]) {
    return { courseId: anyRows[0].id, createdAssessmentId: null, createdCourseId: null };
  }

  // Last resort: create a minimal Assessment + Course
  const { randomUUID } = await import('crypto');
  const assessmentId = randomUUID();
  await pool.query(
    `INSERT INTO sb25_assessments (id, name) VALUES ($1, $2)`,
    [assessmentId, `E2E API Assessment ${Date.now()}`],
  );

  const courseId = randomUUID();
  const code = `E2E${Date.now().toString().slice(-6)}`;
  await pool.query(
    `INSERT INTO sb25_courses
       (id, name, code, sks, "majorId", "assessmentId", "courseType", "isPKL", "isSkripsi")
     VALUES ($1, $2, $3, 3, $4, $5, 'WAJIB', false, false)`,
    [courseId, `E2E API Course ${code}`, code, majorId, assessmentId],
  );

  return { courseId, createdAssessmentId: assessmentId, createdCourseId: courseId };
}

// ── Main setup ─────────────────────────────────────────────────────────────────

setup('seed API test data', async () => {
  const ts = Date.now();

  // ── 1. Test student ────────────────────────────────────────────────────────
  const studentId = await getTestStudentId();

  const { rows: [student] } = await pool.query<{
    year: number | null;
    majorId: number | null;
    lecturerId: string | null;
    name: string | null;
    nim: string | null;
    placeOfBirth: string | null;
    birthday: Date | null;
    address: string | null;
    domicile: string | null;
    email: string | null;
    hp: string | null;
    motherName: string | null;
    motherNIK: string | null;
    guardianName: string | null;
    guardianNIK: string | null;
    guardianHp: string | null;
    guardianJob: string | null;
    guardianAddress: string | null;
  }>(
    `SELECT year, "majorId", "lecturerId", name, nim, "placeOfBirth", birthday,
            address, domicile, email, hp, "motherName", "motherNIK",
            "guardianName", "guardianNIK", "guardianHp", "guardianJob", "guardianAddress"
       FROM sb25_students WHERE id = $1`,
    [studentId],
  );

  const originalStudentYear       = student.year;
  const originalStudentMajorId    = student.majorId;
  const originalStudentLecturerId = student.lecturerId;

  // Resolve values we'll use for student's year/major/lecturer
  let effectiveMajorId    = student.majorId;
  let effectiveLecturerId = student.lecturerId;
  let effectiveYear       = student.year;

  if (!effectiveMajorId) {
    const { rows } = await pool.query<{ id: number }>(`SELECT id FROM sb25_majors LIMIT 1`);
    if (!rows[0]) throw new Error('No major found in DB. At least one major must exist.');
    effectiveMajorId = rows[0].id;
  }

  if (!effectiveLecturerId) {
    effectiveLecturerId = await resolveExistingLecturerId();
  }

  if (!effectiveYear) {
    effectiveYear = 2024;
  }

  const studentWasModified =
    effectiveMajorId    !== originalStudentMajorId   ||
    effectiveLecturerId !== originalStudentLecturerId ||
    effectiveYear       !== originalStudentYear;

  // Fill in required PDF fields with defaults if null — ensures reregister PDF can be generated
  const needsPdfFields =
    !student.name || !student.nim || !student.placeOfBirth || !student.birthday ||
    !student.address || !student.domicile || !student.hp || !student.email ||
    !student.motherName || !student.motherNIK ||
    !student.guardianName || !student.guardianNIK || !student.guardianHp ||
    !student.guardianJob || !student.guardianAddress;

  if (studentWasModified || needsPdfFields) {
    await pool.query(
      `UPDATE sb25_students
          SET year         = $1,
              "majorId"    = $2,
              "lecturerId" = $3,
              name              = COALESCE(name, $4),
              nim               = COALESCE(nim, $5),
              "placeOfBirth"    = COALESCE("placeOfBirth", $6),
              birthday          = COALESCE(birthday, $7),
              address           = COALESCE(address, $8),
              domicile          = COALESCE(domicile, $9),
              email             = COALESCE(email, $10),
              hp                = COALESCE(hp, $11),
              "motherName"      = COALESCE("motherName", $12),
              "motherNIK"       = COALESCE("motherNIK", $13),
              "guardianName"    = COALESCE("guardianName", $14),
              "guardianNIK"     = COALESCE("guardianNIK", $15),
              "guardianHp"      = COALESCE("guardianHp", $16),
              "guardianJob"     = COALESCE("guardianJob", $17),
              "guardianAddress" = COALESCE("guardianAddress", $18)
        WHERE id = $19`,
      [
        effectiveYear, effectiveMajorId, effectiveLecturerId,
        'E2E Test Student', '99000001',
        'Jakarta', new Date('2000-01-01'),
        'Jl. E2E No. 1, Jakarta', 'Jl. E2E No. 1, Jakarta',
        'e2e@test.local', '081234567890',
        'E2E Mother', '1234567890123456',
        'E2E Guardian', '1234567890123457', '081234567891',
        'Wiraswasta', 'Jl. Guardian E2E No. 1',
        studentId,
      ],
    );
    console.log(`  [api-setup] Updated test student fields (year, majorId, pdf fields)`);
  }

  // ── 2. Course ───────────────────────────────────────────────────────────────
  const { courseId, createdAssessmentId, createdCourseId } =
    await resolveOrCreateCourse(effectiveMajorId);

  console.log(`  [api-setup] Using courseId=${courseId}`);

  // ── 3. Period ───────────────────────────────────────────────────────────────
  const period = await createPeriod(2025, 'GANJIL', `E2E API Period ${ts}`);
  console.log(`  [api-setup] Created period: ${period.id}`);

  // ── 4. Reregistration ───────────────────────────────────────────────────────
  const reregistration = await createReregistration(
    `E2E API Reregistration ${ts}`,
    period.id,
    true,
  );
  console.log(`  [api-setup] Created reregistration: ${reregistration.id}`);

  // ── 5. ReregisterDetail (isStatusForm=true → needed for reregister PDF) ─────
  await createReregisterDetail(reregistration.id, studentId, {
    semester: 1,
    semesterStatus: 'AKTIF',
    isStatusForm: true,
    paymentStatus: 'LUNAS',
    lecturerId: effectiveLecturerId,
  });
  console.log(`  [api-setup] Created reregisterDetail for student ${studentId}`);

  // ── 6. KRS (depends on ReregisterDetail existing) ───────────────────────────
  const krs = await createKrs({
    reregisterId: reregistration.id,
    studentId,
    lecturerId: effectiveLecturerId,
    maxSks: 24,
    isStatusForm: 'SUBMITTED',
  });
  console.log(`  [api-setup] Created KRS: ${krs.id}`);

  // ── 7. KrsDetail (at least one course on the KRS) ───────────────────────────
  await createKrsDetail(krs.id, courseId);

  // ── 8. KHS (depends on KRS existing) ────────────────────────────────────────
  const khs = await createKhs({
    krsId: krs.id,
    studentId,
    periodId: period.id,
    semester: 1,
    ips: 3.5,
    maxSks: 24,
  });
  console.log(`  [api-setup] Created KHS: ${khs.id}`);

  // ── 9. KhsDetail (at least one grade record — required for transcript) ───────
  await createKhsDetail(khs.id, courseId, {
    finalScore: 85,
    weight: 3.5,
    gradeLetter: 'A',
    status: 'ANNOUNCEMENT',
  });

  // ── 10. AcademicClass ────────────────────────────────────────────────────────
  const academicClass = await createAcademicClass({
    name: `E2E-API-Kelas-A-${ts}`,
    periodId: period.id,
    lecturerId: effectiveLecturerId,
    courseId,
    semester: 1,
  });
  console.log(`  [api-setup] Created academicClass: ${academicClass.id}`);

  // ── 11. Schedule + ScheduleDetail (butuh Time + Room agar Excel export berhasil)
  const { timeId, createdTimeId } = await resolveOrCreateTime();
  const { roomId, createdRoomId } = await resolveOrCreateRoom();

  const schedule = await createSchedule(period.id, `E2E API Schedule ${ts}`);
  await createScheduleDetail(schedule.id, {
    academicClassId: academicClass.id,
    dayName: 'SENIN',
    timeId,
    roomId,
  });
  console.log(`  [api-setup] Created schedule: ${schedule.id} (timeId=${timeId}, roomId=${roomId})`);

  // ── 12. Write seed file ───────────────────────────────────────────────────────
  const seed: ApiSeedData = {
    periodId:           period.id,
    reregistrationId:   reregistration.id,
    krsId:              krs.id,
    khsId:              khs.id,
    academicClassId:    academicClass.id,
    scheduleId:         schedule.id,
    studentId,
    studentWasModified,
    originalStudentYear,
    originalStudentMajorId,
    originalStudentLecturerId,
    createdAssessmentId,
    createdCourseId,
    createdTimeId,
    createdRoomId,
  };

  fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
  fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2), 'utf-8');
  console.log(`  [api-setup] Seed file written → ${SEED_FILE}`);
});
