/**
 * Shared constants for API global setup and teardown.
 * Extracted to a non-test helper file so both setup and teardown can import it
 * without triggering Playwright's "test file cannot import test file" restriction.
 */
import * as path from 'path';

export const SEED_FILE = path.resolve(__dirname, '../../../.auth/api-seed.json');

export type ApiSeedData = {
  periodId: string;
  reregistrationId: string;
  krsId: string;
  khsId: string;
  academicClassId: string;
  scheduleId: string;
  studentId: string;
  studentWasModified: boolean;
  originalStudentYear: number | null;
  originalStudentMajorId: number | null;
  originalStudentLecturerId: string | null;
  createdAssessmentId: string | null;
  createdCourseId: string | null;
  // Time and Room for ScheduleDetail — tracked only if we created them
  createdTimeId: string | null;
  createdRoomId: number | null;
};
