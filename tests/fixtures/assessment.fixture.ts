import { test as authTest, expect } from './auth.fixture';
import { AssessmentPage } from '../admin/pages/AssessmentPage';
import {
  deleteAssessmentByName,
  deleteAssessmentById,
} from '../factories/assessment.factory';
import { deleteGradeComponentById } from '../factories/grade-component.factory';

/**
 * CleanupTracker separates three registries so teardown enforces dependency order:
 *   1a. assessments tracked by name  (UI-created — name is the only known handle)
 *   1b. assessments tracked by ID    (DB-factory-created — ID is stable across renames)
 *   2.  grade components by ID       (SQL, after all AssessmentDetail rows are gone)
 *
 * Naming mirrors the grade-component fixture convention:
 *   assessmentName / assessmentId  ↔  gcName / gcId
 *   gradeComponentId               — prerequisite GCs (no equivalent in GC tests)
 *
 * All teardown steps use direct SQL so slowMo cannot cause silent failures.
 */
type CleanupTracker = {
  assessmentName:   (name: string) => void;
  assessmentId:     (id: string)   => void;
  gradeComponentId: (id: string)   => void;
};

type AssessmentFixtures = {
  assessmentPage:  AssessmentPage;
  trackForCleanup: CleanupTracker;
};

export const test = authTest.extend<AssessmentFixtures>({
  assessmentPage: async ({ page }, use) => {
    const ap = new AssessmentPage(page);
    await ap.goto();
    await use(ap);
  },

  trackForCleanup: async ({}, use) => {
    const assessmentNames: string[] = [];
    const assessmentIds:   string[] = [];
    const gcIds:           string[] = [];

    await use({
      assessmentName:   (name: string) => assessmentNames.push(name),
      assessmentId:     (id: string)   => assessmentIds.push(id),
      gradeComponentId: (id: string)   => gcIds.push(id),
    });

    // ── Teardown ───────────────────────────────────────────────────────────────
    // Step 1a: UI-created assessments — delete by name
    for (const name of assessmentNames) {
      try { await deleteAssessmentByName(name); } catch { /* already gone */ }
    }
    // Step 1b: DB-factory-created assessments — delete by primary key
    for (const id of assessmentIds) {
      try { await deleteAssessmentById(id); } catch { /* already gone */ }
    }
    // Step 2: grade components (AssessmentDetail rows removed in steps 1a/1b)
    for (const id of gcIds) {
      try { await deleteGradeComponentById(id); } catch { /* already gone */ }
    }
  },
});

export { expect };
