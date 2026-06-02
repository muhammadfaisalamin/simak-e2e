import { test, expect } from '../../fixtures/assessment.fixture';
import {
  createAssessment,
} from '../../factories/assessment.factory';
import {
  createGradeComponent,
  createGradeComponents,
} from '../../factories/grade-component.factory';

/**
 * E2E Test Suite: Assessment (Bentuk Penilaian) CRUD
 *
 * Covers positive and negative scenarios for creating, reading,
 * updating, and deleting assessments via the admin UI.
 *
 * Prerequisites:
 *  - Admin session cookie must be present (.auth/admin.json)
 *  - Application must be running at TEST_BASE_URL
 *  - DATABASE_URL must be set in .env.test
 *
 * Data isolation strategy:
 *  - Each test generates its own unique ID from Date.now()
 *  - CREATE tests: GradeComponents seeded via SQL factory, assessment created via UI
 *  - READ / UPDATE / DELETE tests: both GradeComponents and the Assessment itself
 *    are seeded directly via SQL factories — no dependency on the Create UI flow
 *  - trackForCleanup removes all rows via SQL after each test, pass or fail
 */

test.describe('Assessment Management', () => {
  // slowMo: 1000ms + 4-component form makes the longest test ~40s; 90s gives headroom.
  // mode: 'parallel' — tests are fully independent and can run concurrently across workers.
  test.describe.configure({ mode: 'parallel', timeout: 90000 });

  // ── POSITIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Page-level checks (no data) ────────────────────────────────────────

    test('should load the assessment page with the correct heading',
      async ({ assessmentPage }) => {
        // Trivially short — fixture already called goto(); no steps needed
        await expect(assessmentPage.pageHeading).toBeVisible();
        await expect(assessmentPage.page).toHaveURL(/assesment/);
      },
    );

    test('should open the create modal with the correct form title',
      async ({ assessmentPage }) => {
        await test.step('Act: open create modal', async () => {
          await assessmentPage.openCreateModal();
        });

        await test.step('Assert: modal shows correct title and required fields', async () => {
          await expect(assessmentPage.page.getByText('Tambah data penilaian baru')).toBeVisible();
          await expect(assessmentPage.nameInput).toBeVisible();
          await expect(assessmentPage.addComponentButton).toBeVisible();
          await expect(assessmentPage.submitButton).toBeVisible();
        });
      },
    );

    // ── CREATE tests (UI-driven: exercises the create form itself) ──────────

    test('should create a new assessment with a single grade component',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Single ${id}`;
        // Populated in Arrange, consumed in Act
        let gcName = '';

        await test.step('Arrange: seed one grade component via DB factory', async () => {
          const gc = await createGradeComponent(`GC Single ${id}`, `GCS${id}`);
          trackForCleanup.gradeComponentId(gc.id);
          gcName = gc.name;
        });

        await test.step('Act: fill single-component form and submit', async () => {
          // goto() after factory insert so the GC appears in the react-select dropdown
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillSingleComponentForm(assName, gcName);
          await assessmentPage.submitForm();
          trackForCleanup.assessmentName(assName);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await assessmentPage.assertModalClosed();
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.assertRowVisible(assName);
        });
      },
    );

    test('should create a new assessment with two grade components',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Multi2 ${id}`;
        let gc1Name = '', gc2Name = '';

        await test.step('Arrange: seed two grade components via DB factory', async () => {
          const gc1 = await createGradeComponent(`GC M2A ${id}`, `M2A${id}`);
          const gc2 = await createGradeComponent(`GC M2B ${id}`, `M2B${id}`);
          trackForCleanup.gradeComponentId(gc1.id);
          trackForCleanup.gradeComponentId(gc2.id);
          gc1Name = gc1.name;
          gc2Name = gc2.name;
        });

        await test.step('Act: fill two-component form and submit', async () => {
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillTwoComponentForm(assName, gc1Name, '50', gc2Name, '50');
          await assessmentPage.submitForm();
          trackForCleanup.assessmentName(assName);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await assessmentPage.assertModalClosed();
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.assertRowVisible(assName);
        });
      },
    );

    test('should create a new assessment with four grade components',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Multi4 ${id}`;
        let gcs: Array<{ id: string; name: string; acronym: string }> = [];

        await test.step('Arrange: seed four grade components via DB factory', async () => {
          gcs = await createGradeComponents(4, `GC M4 ${id}`, `M4${id}`);
          gcs.forEach(gc => trackForCleanup.gradeComponentId(gc.id));
        });

        await test.step('Act: fill four-component form and submit', async () => {
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillComponentsForm(
            assName,
            gcs.map(gc => ({ gcName: gc.name, percentage: '25' })),
          );
          await assessmentPage.submitForm();
          trackForCleanup.assessmentName(assName);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await assessmentPage.assertModalClosed();
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.assertRowVisible(assName);
        });
      },
    );

    // ── READ tests (DB-seeded: no dependency on the Create UI flow) ─────────

    test('should display the new assessment in the table',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Display ${id}`;

        await test.step('Arrange: seed assessment with grade component via DB factory', async () => {
          const gc  = await createGradeComponent(`GC Display ${id}`, `GD${id}`);
          const ass = await createAssessment(assName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
        });

        await test.step('Assert: row visible in table', async () => {
          await assessmentPage.gotoFiltered(assName);
          await expect(assessmentPage.rowByName(assName)).toBeVisible();
        });
      },
    );

    test('should find an assessment when searching by name',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Search ${id}`;

        await test.step('Arrange: seed assessment with grade component via DB factory', async () => {
          const gc  = await createGradeComponent(`GC Search ${id}`, `GSearch${id}`);
          const ass = await createAssessment(assName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
        });

        await test.step('Act: search by name via search box', async () => {
          await assessmentPage.goto();
          await assessmentPage.search(assName);
        });

        await test.step('Assert: row appears in search results', async () => {
          await assessmentPage.assertRowVisible(assName);
        });
      },
    );

    test('should open the update modal pre-filled with existing data',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment PreFill ${id}`;
        let gcName = '';

        await test.step('Arrange: seed assessment with grade component via DB factory', async () => {
          const gc  = await createGradeComponent(`GC PreFill ${id}`, `GPF${id}`);
          const ass = await createAssessment(assName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
          gcName = gc.name;
        });

        await test.step('Act: open update modal for the seeded row', async () => {
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.openUpdateModal(assName);
        });

        await test.step('Assert: modal pre-filled with correct name and grade component', async () => {
          await expect(assessmentPage.page.getByText('Ubah data penilaian')).toBeVisible();
          await expect(assessmentPage.nameInput).toHaveValue(assName);
          await assessmentPage.assertSelectedGradeComponent(0, gcName);
        });
      },
    );

    // ── UPDATE tests (DB-seeded) ────────────────────────────────────────────

    test('should update an existing assessment name',
      async ({ assessmentPage, trackForCleanup }) => {
        const id           = Date.now().toString().slice(-6);
        const originalName = `Assessment Original ${id}`;
        const updatedName  = `Assessment Updated ${id}`;

        await test.step('Arrange: seed assessment with grade component via DB factory', async () => {
          const gc  = await createGradeComponent(`GC Update ${id}`, `GU${id}`);
          const ass = await createAssessment(originalName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          // Track by ID — remains valid even after the name is changed by the update
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
        });

        await test.step('Act: open update modal and submit new name', async () => {
          await assessmentPage.gotoFiltered(originalName);
          await assessmentPage.openUpdateModal(originalName);
          await assessmentPage.fillName(updatedName);
          await assessmentPage.submitForm();
          await assessmentPage.assertModalClosed();
        });

        await test.step('Assert: updated name visible and original name gone', async () => {
          await assessmentPage.gotoFiltered(updatedName);
          await assessmentPage.assertRowVisible(updatedName);

          await assessmentPage.gotoFiltered(originalName);
          await assessmentPage.assertRowNotVisible(originalName);
        });
      },
    );

    // ── DELETE tests (DB-seeded) ────────────────────────────────────────────

    test('should open the delete confirmation modal with a warning message',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment DelModal ${id}`;

        await test.step('Arrange: seed assessment with grade component via DB factory', async () => {
          const gc  = await createGradeComponent(`GC DelModal ${id}`, `GDM${id}`);
          const ass = await createAssessment(assName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
        });

        await test.step('Act: open delete confirmation modal', async () => {
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.openDeleteModal(assName);
        });

        await test.step('Assert: warning message and confirm button visible', async () => {
          await expect(assessmentPage.deleteWarningText).toBeVisible();
          await expect(assessmentPage.deleteConfirmButton).toBeVisible();
        });
      },
    );

    test('should delete an assessment and remove it from the table',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Delete ${id}`;

        await test.step('Arrange: seed assessment with grade component via DB factory', async () => {
          const gc  = await createGradeComponent(`GC Delete ${id}`, `GDel${id}`);
          const ass = await createAssessment(assName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          // Registered as safety net; SQL DELETE is a no-op if the UI delete succeeded
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
        });

        await test.step('Act: delete assessment via UI', async () => {
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.deleteAssessment(assName);
        });

        await test.step('Assert: row no longer appears in table', async () => {
          await assessmentPage.gotoFiltered(assName);
          await assessmentPage.assertRowNotVisible(assName);
        });
      },
    );

    // ── Modal close / empty search (no data) ───────────────────────────────

    test('should close the modal without saving when the close button is clicked',
      async ({ assessmentPage }) => {
        const id = Date.now().toString().slice(-6);

        await test.step('Act: fill name then close modal without submitting', async () => {
          await assessmentPage.openCreateModal();
          await assessmentPage.fillName(`Assessment Close ${id}`);
          await assessmentPage.closeModal();
        });

        await test.step('Assert: modal is closed', async () => {
          await assessmentPage.assertModalClosed();
        });
      },
    );

    test('should return empty search results for a non-matching query',
      async ({ assessmentPage }) => {
        await test.step('Act: search with a non-matching query', async () => {
          await assessmentPage.search('XXXXXXXXXNONEXISTENT99999');
        });

        await test.step('Assert: table shows no results', async () => {
          await assessmentPage.assertTableEmpty();
        });
      },
    );

  });

  // ── NEGATIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    test('should show a validation error when the name field is empty',
      async ({ assessmentPage }) => {
        await test.step('Act: submit form with name left empty', async () => {
          await assessmentPage.openCreateModal();
          await assessmentPage.setPercentage(0, '100');
          await assessmentPage.submitForm();
        });

        await test.step('Assert: name validation error shown and modal stays open', async () => {
          await assessmentPage.assertFieldError('Nama penilaian harus diisi');
          await assessmentPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when no grade component is selected',
      async ({ assessmentPage }) => {
        await test.step('Act: submit form with no grade component selected', async () => {
          await assessmentPage.openCreateModal();
          await assessmentPage.fillName('Test Assessment');
          await assessmentPage.setPercentage(0, '100');
          await assessmentPage.submitForm();
        });

        await test.step('Assert: grade component validation error shown and modal stays open', async () => {
          await assessmentPage.assertFieldError('komponen nilai harus diisi');
          await assessmentPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when the percentage is zero',
      async ({ assessmentPage, trackForCleanup }) => {
        const id = Date.now().toString().slice(-6);
        let gcName = '';

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(`GC PctZero ${id}`, `GPZ${id}`);
          trackForCleanup.gradeComponentId(gc.id);
          gcName = gc.name;
        });

        await test.step('Act: select grade component and set percentage to zero', async () => {
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillName('Test Assessment');
          await assessmentPage.selectGradeComponent(0, gcName);
          await assessmentPage.setPercentage(0, '0');
          await assessmentPage.submitForm();
        });

        await test.step('Assert: percentage validation error shown and modal stays open', async () => {
          await assessmentPage.assertFieldError('persentase harus dari 1 sampai 100 %');
          await assessmentPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when the total percentage is not 100',
      async ({ assessmentPage, trackForCleanup }) => {
        const id = Date.now().toString().slice(-6);
        let gcName = '';

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(`GC PctTotal ${id}`, `GPT${id}`);
          trackForCleanup.gradeComponentId(gc.id);
          gcName = gc.name;
        });

        await test.step('Act: select grade component and set percentage to 50 (total ≠ 100)', async () => {
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillName('Test Assessment');
          await assessmentPage.selectGradeComponent(0, gcName);
          await assessmentPage.setPercentage(0, '50');
          await assessmentPage.submitForm();
        });

        await test.step('Assert: total percentage validation error shown and modal stays open', async () => {
          await assessmentPage.assertFieldError('Total persentase harus 100%');
          await assessmentPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when the same grade component is selected twice',
      async ({ assessmentPage, trackForCleanup }) => {
        const id = Date.now().toString().slice(-6);
        let gcName = '';

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(`GC Duplicate ${id}`, `GDP${id}`);
          trackForCleanup.gradeComponentId(gc.id);
          gcName = gc.name;
        });

        await test.step('Act: select the same grade component in two rows and submit', async () => {
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillName('Test Assessment');
          await assessmentPage.selectGradeComponent(0, gcName);
          await assessmentPage.setPercentage(0, '50');
          await assessmentPage.addComponentRow();
          await assessmentPage.selectGradeComponent(1, gcName);
          await assessmentPage.setPercentage(1, '50');
          await assessmentPage.submitForm();
        });

        await test.step('Assert: duplicate component validation error shown and modal stays open', async () => {
          await assessmentPage.assertFieldError('Komponen nilai tidak boleh duplikat');
          await assessmentPage.assertModalOpen();
        });
      },
    );

    test('should reject a duplicate assessment name',
      async ({ assessmentPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const assName = `Assessment Duplicate ${id}`;
        let gcName = '';

        await test.step('Arrange: seed existing assessment via DB factory', async () => {
          const gc  = await createGradeComponent(`GC DupAss ${id}`, `GDA${id}`);
          // Seed the first entry directly — no UI dependency for the prerequisite
          const ass = await createAssessment(assName, [{ gradeComponentId: gc.id, percentage: 100 }]);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gradeComponentId(gc.id);
          gcName = gc.name;
        });

        await test.step('Act: attempt to create second assessment with the same name via UI', async () => {
          await assessmentPage.goto();
          await assessmentPage.openCreateModal();
          await assessmentPage.fillSingleComponentForm(assName, gcName);
          await assessmentPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await assessmentPage.assertInlineFormError();
          await assessmentPage.assertModalOpen();
        });
      },
    );

  });

});
