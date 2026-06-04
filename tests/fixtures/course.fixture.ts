import { test as authTest, expect } from './auth.fixture';
import { CoursePage } from '../admin/pages/CoursePage';
import { deleteCourseById, deleteCourseByCode } from '../factories/course.factory';
import { deleteAssessmentById } from '../factories/assessment.factory';
import { deleteGradeComponentById } from '../factories/grade-component.factory';
import { deleteMajorById } from '../factories/major.factory';

/**
 * CleanupTracker separates five registries so teardown enforces FK dependency order:
 *   1a. courses tracked by code  (UI-created — code is known at form-fill time)
 *   1b. courses tracked by ID    (DB-factory-created — ID is stable across renames)
 *   2.  assessments by ID        (after all courses referencing them are gone)
 *   3.  grade components by ID   (after all assessment_details are gone)
 *   4.  majors by ID             (after all courses referencing them are gone)
 *
 * All teardown steps use direct SQL so slowMo cannot cause silent failures.
 */
type CleanupTracker = {
  courseCode:   (code: string) => void;
  courseId:     (id: string)   => void;
  assessmentId: (id: string)   => void;
  gcId:         (id: string)   => void;
  majorId:      (id: number)   => void;
};

type CourseFixtures = {
  coursePage:      CoursePage;
  trackForCleanup: CleanupTracker;
};

export const test = authTest.extend<CourseFixtures>({
  coursePage: async ({ page }, use) => {
    const cp = new CoursePage(page);
    await cp.goto();
    await use(cp);
  },

  trackForCleanup: async ({}, use) => {
    const courseCodes:   string[] = [];
    const courseIds:     string[] = [];
    const assessmentIds: string[] = [];
    const gcIds:         string[] = [];
    const majorIds:      number[] = [];

    await use({
      courseCode:   (code) => courseCodes.push(code),
      courseId:     (id)   => courseIds.push(id),
      assessmentId: (id)   => assessmentIds.push(id),
      gcId:         (id)   => gcIds.push(id),
      majorId:      (id)   => majorIds.push(id),
    });

    // ── Teardown — FK Restrict order ────────────────────────────────────────
    // Step 1a: UI-created courses — delete by code
    for (const code of courseCodes) {
      try { await deleteCourseByCode(code); } catch { /* already gone */ }
    }
    // Step 1b: DB-factory-created courses — delete by primary key
    for (const id of courseIds) {
      try { await deleteCourseById(id); } catch { /* already gone */ }
    }
    // Step 2: assessments (AssessmentDetail rows deleted inside deleteAssessmentById)
    for (const id of assessmentIds) {
      try { await deleteAssessmentById(id); } catch { /* already gone */ }
    }
    // Step 3: grade components (no remaining assessment_detail references)
    for (const id of gcIds) {
      try { await deleteGradeComponentById(id); } catch { /* already gone */ }
    }
    // Step 4: majors (no remaining course references)
    for (const id of majorIds) {
      try { await deleteMajorById(id); } catch { /* already gone */ }
    }
  },
});

export { expect };
