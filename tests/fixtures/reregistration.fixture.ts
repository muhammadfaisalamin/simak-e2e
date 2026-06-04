import { test as authTest, expect } from './auth.fixture';
import { ReregistrationPage } from '../admin/pages/ReregistrationPage';
import {
  deleteReregistrationById,
  deleteReregistrationByName,
} from '../factories/reregistration.factory';
import { deletePeriodById } from '../factories/period.factory';

/**
 * CleanupTracker separates three registries so teardown enforces FK dependency order:
 *   1a. reregistrations tracked by name  (UI-created — name is known at form-fill time)
 *   1b. reregistrations tracked by ID    (DB-factory-created — ID stable across renames)
 *   2.  periods by ID                    (after all reregistrations referencing them are gone)
 *
 * Reregister → Period: onDelete Restrict → delete Reregister first, then Period.
 * ReregisterDetail → Reregister: onDelete Cascade → auto-deleted with Reregister.
 */
type CleanupTracker = {
  reregistrationName: (name: string) => void;
  reregistrationId:   (id: string)   => void;
  periodId:           (id: string)   => void;
};

type ReregistrationFixtures = {
  reregistrationPage: ReregistrationPage;
  trackForCleanup:    CleanupTracker;
};

export const test = authTest.extend<ReregistrationFixtures>({
  reregistrationPage: async ({ page }, use) => {
    const rp = new ReregistrationPage(page);
    await rp.goto();
    await use(rp);
  },

  trackForCleanup: async ({}, use) => {
    const names:   string[] = [];
    const ids:     string[] = [];
    const periods: string[] = [];

    await use({
      reregistrationName: (name) => names.push(name),
      reregistrationId:   (id)   => ids.push(id),
      periodId:           (id)   => periods.push(id),
    });

    // ── Teardown — FK Restrict order ────────────────────────────────────────
    // Step 1a: UI-created reregistrations — delete by name
    for (const name of names) {
      try { await deleteReregistrationByName(name); } catch { /* already gone */ }
    }
    // Step 1b: DB-factory-created reregistrations — delete by primary key
    for (const id of ids) {
      try { await deleteReregistrationById(id); } catch { /* already gone */ }
    }
    // Step 2: periods (no remaining reregister references)
    for (const id of periods) {
      try { await deletePeriodById(id); } catch { /* already gone */ }
    }
  },
});

export { expect };
