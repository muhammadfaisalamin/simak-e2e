import { test as authTest, expect } from './auth.fixture';
import { GradeComponentPage } from '../admin/pages/GradeComponentPage';
import {
  deleteGradeComponentByName,
  deleteGradeComponentById,
} from '../factories/grade-component.factory';

/**
 * CleanupTracker separates two registries:
 *   gcName — UI-created rows (only the name is known; looked up in teardown)
 *   gcId   — DB-factory-created rows (primary key, stable across renames)
 *
 * All teardown is SQL-only: no browser interaction, immune to slowMo timing.
 */
type CleanupTracker = {
  gcName: (name: string) => void;
  gcId:   (id: string)   => void;
};

type GcFixtures = {
  gcPage:          GradeComponentPage;
  trackForCleanup: CleanupTracker;
};

export const test = authTest.extend<GcFixtures>({
  gcPage: async ({ page }, use) => {
    const gcPage = new GradeComponentPage(page);
    await gcPage.goto();
    await use(gcPage);
  },

  trackForCleanup: async ({}, use) => {
    const gcNames: string[] = [];
    const gcIds:   string[] = [];

    await use({
      gcName: (name: string) => gcNames.push(name),
      gcId:   (id: string)   => gcIds.push(id),
    });

    // Teardown — SQL only, no page dependency
    for (const name of gcNames) {
      try { await deleteGradeComponentByName(name); } catch { /* already gone */ }
    }
    for (const id of gcIds) {
      try { await deleteGradeComponentById(id); } catch { /* already gone */ }
    }
  },
});

export { expect };
