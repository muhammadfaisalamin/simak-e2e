import { test, expect } from '../../fixtures/reregistration.fixture';
import { createReregistration } from '../../factories/reregistration.factory';
import { createPeriod } from '../../factories/period.factory';

/**
 * E2E Test Suite: Reregistration (Herregistrasi) CRUD
 *
 * Covers positive and negative scenarios for creating, reading,
 * updating, and deleting reregistrations via the admin (operator) UI.
 *
 * Prerequisites:
 *  - Admin session cookie must be present (.auth/admin.json)
 *  - Admin user must have roleType === "OPERATOR" (operator view is rendered)
 *  - Application must be running at TEST_BASE_URL
 *  - DATABASE_URL must be set in .env.test
 *
 * Data isolation strategy:
 *  - Each test generates its own unique ID from Date.now()
 *  - CREATE tests: Period seeded via SQL factory; Reregistration created via UI form
 *  - READ / UPDATE / DELETE tests: both Period and Reregistration seeded via SQL factory
 *  - Negative validation tests: Period seeded only when needed as dropdown prerequisite
 *  - trackForCleanup removes all rows via SQL after each test, pass or fail
 *  - Teardown order: Reregistration first (FK Restrict to Period), then Period
 *  - mode: 'parallel' — tests are fully independent and can run concurrently
 */

/** Helper: build a unique period name from a 6-digit test ID. */
function periodName(id: string): string {
  // Period.name has @@unique — must be globally unique across all test runs
  return `Semester Ganjil ${id}`;
}

test.describe('Reregistration Management', () => {
  test.describe.configure({ mode: 'parallel', timeout: 90000 });

  // ── POSITIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Page-level checks (no data) ────────────────────────────────────────

    test('should load the reregistration page with the correct heading',
      async ({ reregistrationPage }) => {
        // Trivially short — fixture already called goto(); no steps needed
        await expect(reregistrationPage.pageHeading).toBeVisible();
        await expect(reregistrationPage.page).toHaveURL(/reregistrations/);
      },
    );

    test('should open the create modal with the correct form title',
      async ({ reregistrationPage }) => {
        await test.step('Act: open create modal', async () => {
          await reregistrationPage.openCreateModal();
        });

        await test.step('Assert: modal shows correct title and required fields', async () => {
          await expect(reregistrationPage.page.getByText('Tambah data her-registrasi baru')).toBeVisible();
          await expect(reregistrationPage.nameInput).toBeVisible();
          await expect(reregistrationPage.submitButton).toBeVisible();
        });
      },
    );

    // ── CREATE test (UI-driven: exercises the create form itself) ───────────

    test('should create a new reregistration via UI',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi Create ${id}`;
        let pName  = '';

        await test.step('Arrange: seed period via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          trackForCleanup.periodId(period.id);
          pName = period.name;
        });

        await test.step('Act: fill create form and submit', async () => {
          await reregistrationPage.goto();
          await reregistrationPage.openCreateModal();
          await reregistrationPage.fillForm({ name, periodName: pName });
          await reregistrationPage.submitForm();
          trackForCleanup.reregistrationName(name);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await reregistrationPage.assertModalClosed();
          await reregistrationPage.gotoFiltered(name);
          await reregistrationPage.assertRowVisible(name);
        });
      },
    );

    // ── READ tests (DB-seeded: no dependency on the Create UI flow) ─────────

    test('should display a new reregistration in the table',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi Display ${id}`;

        await test.step('Arrange: seed period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: row visible in table', async () => {
          await reregistrationPage.gotoFiltered(name);
          await expect(reregistrationPage.rowByName(name)).toBeVisible();
        });
      },
    );

    test('should find a reregistration when searching by name',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi Search ${id}`;

        await test.step('Arrange: seed period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: search by name via search box', async () => {
          await reregistrationPage.goto();
          await reregistrationPage.search(name);
        });

        await test.step('Assert: row appears in search results', async () => {
          await reregistrationPage.assertRowVisible(name);
        });
      },
    );

    test('should open the update modal pre-filled with existing data',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi PreFill ${id}`;
        let pName  = '';

        await test.step('Arrange: seed period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
          pName = period.name;
        });

        await test.step('Act: open update modal for the seeded row', async () => {
          await reregistrationPage.gotoFiltered(name);
          await reregistrationPage.openUpdateModal(name);
        });

        await test.step('Assert: modal pre-filled with correct name and period', async () => {
          await expect(reregistrationPage.page.getByText('Ubah data her-registrasi')).toBeVisible();
          await expect(reregistrationPage.nameInput).toHaveValue(name);
          await reregistrationPage.assertSelectedPeriod(pName);
        });
      },
    );

    // ── UPDATE tests (DB-seeded) ────────────────────────────────────────────

    test('should update an existing reregistration name',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id           = Date.now().toString().slice(-6);
        const originalName = `Herregistrasi Original ${id}`;
        const updatedName  = `Herregistrasi Updated ${id}`;

        await test.step('Arrange: seed period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(originalName, period.id);
          // Track by ID — stable even after the name changes
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open update modal and submit new name', async () => {
          await reregistrationPage.gotoFiltered(originalName);
          await reregistrationPage.updateReregistration(originalName, updatedName);
        });

        await test.step('Assert: updated name visible and original name gone', async () => {
          await reregistrationPage.gotoFiltered(updatedName);
          await reregistrationPage.assertRowVisible(updatedName);

          await reregistrationPage.gotoFiltered(originalName);
          await reregistrationPage.assertRowNotVisible(originalName);
        });
      },
    );

    test('should activate a reregistration via the update form',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi Activate ${id}`;

        await test.step('Arrange: seed inactive period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          // isReregisterActive defaults to false
          const rr = await createReregistration(name, period.id, false);
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open update modal, check the active checkbox, and submit', async () => {
          await reregistrationPage.gotoFiltered(name);
          await reregistrationPage.openUpdateModal(name);
          await reregistrationPage.activeCheckbox.check();
          await reregistrationPage.submitForm();
          await reregistrationPage.assertModalClosed();
        });

        await test.step('Assert: row now shows AKTIF badge', async () => {
          await reregistrationPage.gotoFiltered(name);
          await expect(reregistrationPage.rowByName(name)).toContainText('AKTIF');
        });
      },
    );

    // ── DELETE tests (DB-seeded) ────────────────────────────────────────────

    test('should open the delete confirmation modal with a warning message',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi DelModal ${id}`;

        await test.step('Arrange: seed period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open delete confirmation modal', async () => {
          await reregistrationPage.gotoFiltered(name);
          await reregistrationPage.openDeleteModal(name);
        });

        await test.step('Assert: warning message and confirm button visible', async () => {
          await expect(reregistrationPage.deleteWarningText).toBeVisible();
          await expect(reregistrationPage.deleteConfirmButton).toBeVisible();
        });
      },
    );

    test('should delete a reregistration and remove it from the table',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const name = `Herregistrasi Delete ${id}`;

        await test.step('Arrange: seed period and reregistration via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          // Registered as safety net; SQL DELETE is a no-op if the UI delete succeeded
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: delete reregistration via UI', async () => {
          await reregistrationPage.gotoFiltered(name);
          await reregistrationPage.deleteReregistration(name);
        });

        await test.step('Assert: row no longer appears in table', async () => {
          await reregistrationPage.gotoFiltered(name);
          await reregistrationPage.assertRowNotVisible(name);
        });
      },
    );

    // ── Modal close / empty search (no data) ───────────────────────────────

    test('should close the modal without saving when the close button is clicked',
      async ({ reregistrationPage }) => {
        const id = Date.now().toString().slice(-6);

        await test.step('Act: fill name then close modal without submitting', async () => {
          await reregistrationPage.openCreateModal();
          await reregistrationPage.fillName(`Herregistrasi Close ${id}`);
          await reregistrationPage.closeModal();
        });

        await test.step('Assert: modal is closed', async () => {
          await reregistrationPage.assertModalClosed();
        });
      },
    );

    test('should return empty search results for a non-matching query',
      async ({ reregistrationPage }) => {
        await test.step('Act: search with a non-matching query', async () => {
          await reregistrationPage.search('XXXXXXXXXNONEXISTENT99999');
        });

        await test.step('Assert: table shows no results', async () => {
          await reregistrationPage.assertTableEmpty();
        });
      },
    );

  });

  // ── NEGATIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    test('should show a validation error when the name field is empty',
      async ({ reregistrationPage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        let pName  = '';

        await test.step('Arrange: seed period via DB factory for dropdown options', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          trackForCleanup.periodId(period.id);
          pName = period.name;
        });

        await test.step('Act: select period but leave name empty and submit', async () => {
          await reregistrationPage.goto();
          await reregistrationPage.openCreateModal();
          await reregistrationPage.selectPeriod(pName);
          await reregistrationPage.submitForm();
        });

        await test.step('Assert: name validation error shown and modal stays open', async () => {
          await reregistrationPage.assertFieldError('nama herregistrasi harus diisi');
          await reregistrationPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when no period is selected',
      async ({ reregistrationPage }) => {
        const id = Date.now().toString().slice(-6);

        await test.step('Act: fill name but leave period unselected and submit', async () => {
          await reregistrationPage.openCreateModal();
          await reregistrationPage.fillName(`Herregistrasi NoPeriod ${id}`);
          await reregistrationPage.submitForm();
        });

        await test.step('Assert: period validation error shown and modal stays open', async () => {
          // periodId value is `undefined` (react-select never touched in create mode) —
          // Zod z.string() type check fires before the custom min(1) message → "Required"
          await reregistrationPage.assertFieldError('Required');
          await reregistrationPage.assertModalOpen();
        });
      },
    );

  });

});
