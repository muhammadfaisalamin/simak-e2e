import { test, expect } from '../../fixtures/grade-component.fixture';
import { createGradeComponent } from '../../factories/grade-component.factory';

/**
 * E2E Test Suite: Grade Component (Komponen Nilai) CRUD
 *
 * Covers positive and negative scenarios for creating, reading,
 * updating, and deleting grade components via the admin UI.
 *
 * Prerequisites:
 *  - Admin session cookie must be present (.auth/admin.json)
 *  - Application must be running at TEST_BASE_URL
 *  - DATABASE_URL must be set in .env.test
 *
 * Data isolation strategy:
 *  - Each test generates its own unique ID from Date.now()
 *  - CREATE tests: data entered via UI; cleanup by name via SQL factory
 *  - READ / UPDATE / DELETE tests: prerequisite row inserted directly via
 *    SQL factory — no dependency on the Create UI flow
 *  - trackForCleanup removes all rows via SQL after each test, pass or fail
 *  - mode: 'parallel' — tests are fully independent and can run concurrently
 */

test.describe('Grade Component Management', () => {
  test.describe.configure({ mode: 'parallel' });

  // ── POSITIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Page-level checks (no data) ────────────────────────────────────────

    test('should load the grade component page with the correct heading',
      async ({ gcPage }) => {
        // Trivially short — fixture already called goto(); no steps needed
        await expect(gcPage.pageHeading).toBeVisible();
        await expect(gcPage.page).toHaveURL(/grade-component/);
      },
    );

    test('should open the create modal with the correct form title',
      async ({ gcPage }) => {
        await test.step('Act: open create modal', async () => {
          await gcPage.openCreateModal();
        });

        await test.step('Assert: modal shows correct title and required fields', async () => {
          await expect(gcPage.page.getByText('Tambah data komponen nilai baru')).toBeVisible();
          await expect(gcPage.nameInput).toBeVisible();
          await expect(gcPage.acronymInput).toBeVisible();
          await expect(gcPage.submitButton).toBeVisible();
        });
      },
    );

    // ── CREATE test (UI-driven: exercises the create form itself) ───────────

    test('should create a new grade component with valid name and acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Daily Task ${id}`;
        const acronym = `DT${id}`;

        await test.step('Act: fill and submit create form', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name, acronym });
          await gcPage.submitForm();
          trackForCleanup.gcName(name);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await gcPage.assertModalClosed();
          await gcPage.gotoFiltered(name);
          await gcPage.assertRowVisible(name);
        });
      },
    );

    // ── READ tests (DB-seeded: no dependency on the Create UI flow) ─────────

    test('should display the new grade component with the correct acronym in the table',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Display Test ${id}`;
        const acronym = `DP${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Assert: row visible with correct name and acronym', async () => {
          await gcPage.gotoFiltered(name);
          const row = gcPage.rowByName(name);
          await expect(row).toBeVisible();
          await expect(row).toContainText(acronym);
        });
      },
    );

    test('should find a grade component when searching by name',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Weekly Quiz ${id}`;
        const acronym = `WQ${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: search by name via search box', async () => {
          await gcPage.goto();
          await gcPage.search(name);
        });

        await test.step('Assert: row appears in search results', async () => {
          await gcPage.assertRowVisible(name);
        });
      },
    );

    test('should open the update modal pre-filled with existing data',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Pre Update ${id}`;
        const acronym = `PU${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: open update modal for the seeded row', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.openUpdateModal(name);
        });

        await test.step('Assert: modal pre-filled with correct name and acronym', async () => {
          await expect(gcPage.page.getByText('Ubah data komponen nilai')).toBeVisible();
          await expect(gcPage.nameInput).toHaveValue(name);
          await expect(gcPage.acronymInput).toHaveValue(acronym);
        });
      },
    );

    // ── UPDATE test (DB-seeded) ─────────────────────────────────────────────

    test('should update an existing grade component name and acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id       = Date.now().toString().slice(-6);
        const original = { name: `Original ${id}`, acronym: `ORI${id}` };
        const updated  = { name: `Updated ${id}`,  acronym: `UPD${id}` };

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(original.name, original.acronym);
          // Track by ID — stable even after the name/acronym change below
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: open update modal and submit changes', async () => {
          await gcPage.gotoFiltered(original.name);
          await gcPage.updateGradeComponent(original.name, updated);
        });

        await test.step('Assert: updated name visible and original name gone', async () => {
          await gcPage.gotoFiltered(updated.name);
          await gcPage.assertRowVisible(updated.name);

          await gcPage.gotoFiltered(original.name);
          await gcPage.assertRowNotVisible(original.name);
        });
      },
    );

    // ── DELETE tests (DB-seeded) ────────────────────────────────────────────

    test('should open the delete confirmation modal with a warning message',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Del Modal ${id}`;
        const acronym = `DM${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: open delete confirmation modal', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.openDeleteModal(name);
        });

        await test.step('Assert: warning message and confirm button visible', async () => {
          await expect(gcPage.deleteWarningText).toBeVisible();
          await expect(gcPage.deleteConfirmButton).toBeVisible();
        });
      },
    );

    test('should delete a grade component and remove it from the table',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `To Delete ${id}`;
        const acronym = `TD${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          // Registered as safety net; SQL DELETE is a no-op if the UI delete succeeded
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: delete grade component via UI', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.deleteGradeComponent(name);
        });

        await test.step('Assert: row no longer appears in table', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.assertRowNotVisible(name);
        });
      },
    );

    // ── Modal / search (no data) ────────────────────────────────────────────

    test('should close the modal without saving when the close button is clicked',
      async ({ gcPage }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Close Modal ${id}`;
        const acronym = `CM${id}`;

        await test.step('Act: fill form then close modal without submitting', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name, acronym });
          await gcPage.closeModal();
        });

        await test.step('Assert: modal closed and data not saved to table', async () => {
          await gcPage.assertModalClosed();
          await gcPage.assertRowNotVisible(name);
        });
      },
    );

    test('should return empty search results for a non-matching query',
      async ({ gcPage }) => {
        await test.step('Act: search with a non-matching query', async () => {
          await gcPage.search('XXXXXXXXXNONEXISTENT99999');
        });

        await test.step('Assert: table shows no results', async () => {
          await gcPage.assertTableEmpty();
        });
      },
    );

  });

  // ── NEGATIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    // ── Validation errors (no data needed) ─────────────────────────────────

    test('should show a validation error when the name field is empty',
      async ({ gcPage }) => {
        await test.step('Act: submit form with name left empty', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillAcronym('TST');
          await gcPage.submitForm();
        });

        await test.step('Assert: name validation error shown and modal stays open', async () => {
          await gcPage.assertFieldError('Nama komponen nilai harus diisi');
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when the acronym field is empty',
      async ({ gcPage }) => {
        await test.step('Act: submit form with acronym left empty', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillName('Test Grade Component');
          await gcPage.submitForm();
        });

        await test.step('Assert: acronym validation error shown and modal stays open', async () => {
          await gcPage.assertFieldError('Akronim komponen nilai harus diisi');
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should show validation errors when both name and acronym fields are empty',
      async ({ gcPage }) => {
        await test.step('Act: submit form without filling any fields', async () => {
          await gcPage.openCreateModal();
          await gcPage.submitForm();
        });

        await test.step('Assert: both validation errors shown and modal stays open', async () => {
          await gcPage.assertFieldError('Nama komponen nilai harus diisi');
          await gcPage.assertFieldError('Akronim komponen nilai harus diisi');
          await gcPage.assertModalOpen();
        });
      },
    );

    // ── Duplicate / conflict checks (DB-seeded prerequisite) ───────────────

    test('should reject a duplicate grade component name',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Duplicate Name ${id}`;
        const acronym = `DN${id}`;

        await test.step('Arrange: seed existing grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: attempt to create second entry with the same name', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name, acronym: `DNA${id}` });
          await gcPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await gcPage.assertInlineFormError();
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should reject a duplicate grade component acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Duplicate Acronym ${id}`;
        const acronym = `DA${id}`;

        await test.step('Arrange: seed existing grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: attempt to create second entry with the same acronym', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name: `Duplicate Acronym Alt ${id}`, acronym });
          await gcPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await gcPage.assertInlineFormError();
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should not update a grade component to a name that already exists',
      async ({ gcPage, trackForCleanup }) => {
        const id    = Date.now().toString().slice(-6);
        const nameA = `Conflict A ${id}`;
        const nameB = `Conflict B ${id}`;

        await test.step('Arrange: seed two grade components via DB factory', async () => {
          const gcA = await createGradeComponent(nameA, `CA${id}`);
          const gcB = await createGradeComponent(nameB, `CB${id}`);
          trackForCleanup.gcId(gcA.id);
          trackForCleanup.gcId(gcB.id);
        });

        await test.step('Act: attempt to rename B to A\'s existing name', async () => {
          await gcPage.gotoFiltered(nameB);
          await gcPage.openUpdateModal(nameB);
          await gcPage.fillName(nameA);
          await gcPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await gcPage.assertInlineFormError();
          await gcPage.assertModalOpen();
        });
      },
    );

  });

});
