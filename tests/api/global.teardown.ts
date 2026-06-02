import { test as teardown } from '@playwright/test';
import * as fs from 'fs';
import { pool } from '../factories/db';
import { deleteScheduleById } from '../factories/schedule.factory';
import { deleteAcademicClassById } from '../factories/academic-class.factory';
import { deleteReregistrationById } from '../factories/reregistration.factory';
import { deletePeriodById } from '../factories/period.factory';
import { deleteAssessmentById } from '../factories/assessment.factory';
import { SEED_FILE, type ApiSeedData } from './helpers/api-seed';

/**
 * Teardown order respects FK constraints:
 *
 *   1. Schedule  (CASCADE → ScheduleDetail)
 *      ScheduleDetail.academicClassId = Restrict → must remove before AcademicClass
 *
 *   2. AcademicClass  (CASCADE → AcademicClassDetail)
 *      AcademicClass.periodId = Restrict → must remove before Period
 *
 *   3. Reregistration  (CASCADE chain):
 *      Reregistration → ReregisterDetail → KRS → KrsDetail / KrsOverride
 *                                              → KHS (krsId CASCADE)
 *                                                  → KhsDetail → KhsGrade
 *      NOTE: deleteReregistrationById deletes KRS first (RESTRICT safety) then
 *            Reregistration (which cascades ReregisterDetail).
 *      KHS.periodId = Restrict → KHS must be gone before Period delete.
 *
 *   4. Period  (KHS and AcademicClass are already removed)
 *
 *   5. Created Course / Assessment (if we created them in setup)
 *
 *   6. Restore test student's original year/majorId/lecturerId if we changed them
 */
teardown('cleanup API test data', async () => {
  let seed: ApiSeedData;

  try {
    seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8')) as ApiSeedData;
  } catch {
    console.warn('[api-teardown] Seed file not found — nothing to clean up.');
    return;
  }

  try {
    // 1. Schedule (cascades ScheduleDetail → removes Restrict on AcademicClass)
    await deleteScheduleById(seed.scheduleId);
    console.log(`  [api-teardown] Deleted schedule ${seed.scheduleId}`);

    // 2. AcademicClass (ScheduleDetail gone; AcademicClassDetail cascades)
    await deleteAcademicClassById(seed.academicClassId);
    console.log(`  [api-teardown] Deleted academicClass ${seed.academicClassId}`);

    // 3. Reregistration (cascades the whole KRS/KHS tree via deleteReregistrationById)
    await deleteReregistrationById(seed.reregistrationId);
    console.log(`  [api-teardown] Deleted reregistration ${seed.reregistrationId}`);

    // 4. Period (KHS and AcademicClass are gone)
    await deletePeriodById(seed.periodId);
    console.log(`  [api-teardown] Deleted period ${seed.periodId}`);

    // 5. Created Course / Assessment / Time / Room (only if setup created them)
    if (seed.createdCourseId) {
      await pool.query('DELETE FROM sb25_courses WHERE id = $1', [seed.createdCourseId]);
      console.log(`  [api-teardown] Deleted created course ${seed.createdCourseId}`);
    }
    if (seed.createdAssessmentId) {
      await deleteAssessmentById(seed.createdAssessmentId);
      console.log(`  [api-teardown] Deleted created assessment ${seed.createdAssessmentId}`);
    }
    if (seed.createdTimeId) {
      await pool.query('DELETE FROM sb25_times WHERE id = $1', [seed.createdTimeId]);
      console.log(`  [api-teardown] Deleted created time ${seed.createdTimeId}`);
    }
    if (seed.createdRoomId) {
      await pool.query('DELETE FROM sb25_rooms WHERE id = $1', [seed.createdRoomId]);
      console.log(`  [api-teardown] Deleted created room ${seed.createdRoomId}`);
    }

    // 6. Restore student data if we modified it
    if (seed.studentWasModified) {
      await pool.query(
        `UPDATE sb25_students SET year=$1, "majorId"=$2, "lecturerId"=$3 WHERE id=$4`,
        [
          seed.originalStudentYear,
          seed.originalStudentMajorId,
          seed.originalStudentLecturerId,
          seed.studentId,
        ],
      );
      console.log(`  [api-teardown] Restored test student ${seed.studentId}`);
    }

    // Remove seed file after successful cleanup
    fs.unlinkSync(SEED_FILE);
    console.log('  [api-teardown] Seed file removed. Cleanup complete.');
  } catch (err) {
    console.error('[api-teardown] Error during cleanup:', err);
    throw err;
  }
});
