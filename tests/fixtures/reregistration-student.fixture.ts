import { test as authTest, expect } from './auth.fixture';
import { ReregistrationStudentPage } from '../student/pages/ReregistrationStudentPage';
import { deleteReregistrationById } from '../factories/reregistration.factory';
import { deletePeriodById } from '../factories/period.factory';

/**
 * CleanupTracker for student reregistration tests.
 *
 * FK dependency order:
 *   1. reregistrations by ID  — deleteReregistrationById cascades ReregisterDetail
 *   2. periods by ID          — after all reregisters referencing them are gone
 *
 * Reregister → Period: onDelete Restrict → delete Reregister first.
 * ReregisterDetail → Reregister: onDelete Cascade → auto-deleted with Reregister.
 */
type CleanupTracker = {
  reregistrationId: (id: string) => void;
  periodId:         (id: string) => void;
};

type ReregistrationStudentFixtures = {
  reregistrationStudentPage: ReregistrationStudentPage;
  trackForCleanup:           CleanupTracker;
};

export const test = authTest.extend<ReregistrationStudentFixtures>({
  reregistrationStudentPage: async ({ page }, use) => {
    const rsp = new ReregistrationStudentPage(page);
    await rsp.goto();
    await use(rsp);
  },

  trackForCleanup: async ({}, use) => {
    const ids:     string[] = [];
    const periods: string[] = [];

    await use({
      reregistrationId: (id) => ids.push(id),
      periodId:         (id) => periods.push(id),
    });

    // ── Teardown — FK Restrict order ────────────────────────────────────────
    // Step 1: delete reregistrations (cascades ReregisterDetail)
    for (const id of ids) {
      try { await deleteReregistrationById(id); } catch { /* already gone */ }
    }
    // Step 2: delete periods (no remaining reregister references)
    for (const id of periods) {
      try { await deletePeriodById(id); } catch { /* already gone */ }
    }
  },
});

export { expect };
