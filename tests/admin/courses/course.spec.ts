import { test, expect } from '../../fixtures/course.fixture';
import { createCourse } from '../../factories/course.factory';
import { createGradeComponent } from '../../factories/grade-component.factory';
import { createAssessment } from '../../factories/assessment.factory';
import { createMajor } from '../../factories/major.factory';

/**
 * E2E Test Suite: Course (Mata Kuliah) CRUD
 *
 * Covers positive and negative scenarios for creating, reading,
 * updating, and deleting courses via the admin UI.
 *
 * Prerequisites:
 *  - Admin session cookie must be present (.auth/admin.json)
 *  - Application must be running at TEST_BASE_URL
 *  - DATABASE_URL must be set in .env.test
 *
 * Data isolation strategy:
 *  - Each test generates its own unique ID from Date.now()
 *  - CREATE tests: prerequisites (GC, assessment, major) seeded via SQL factory,
 *    course created via UI; cleanup by code via SQL factory
 *  - READ / UPDATE / DELETE tests: all data (GC, assessment, major, course) seeded
 *    directly via SQL factories — no dependency on the Create UI flow
 *  - Negative tests that need dropdowns: prerequisites seeded via SQL, goto()
 *    called after inserts so react-select dropdowns reflect new data
 *  - trackForCleanup removes all rows via SQL after each test, pass or fail
 *  - mode: 'parallel' — tests are fully independent and can run concurrently
 */

/** Seed the three prerequisites every course needs and return their handles. */
async function seedPrerequisites(id: string) {
  const gc  = await createGradeComponent(`GC Crs ${id}`, `GCC${id}`);
  const ass = await createAssessment(`Ass Crs ${id}`, [{ gradeComponentId: gc.id, percentage: 100 }]);
  const maj = await createMajor(`Major Crs ${id}`);
  return { gc, ass, maj };
}

test.describe('Course Management', () => {
  test.describe.configure({ mode: 'parallel', timeout: 90000 });

  // ── POSITIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Page-level checks (no data) ────────────────────────────────────────

    test('should load the course page with the correct heading',
      async ({ coursePage }) => {
        // Trivially short — fixture already called goto(); no steps needed
        await expect(coursePage.pageHeading).toBeVisible();
        await expect(coursePage.page).toHaveURL(/course/);
      },
    );

    test('should open the create modal with the correct form title',
      async ({ coursePage }) => {
        await test.step('Act: open create modal', async () => {
          await coursePage.openCreateModal();
        });

        await test.step('Assert: modal shows correct title and required fields', async () => {
          await expect(coursePage.page.getByText('Tambah data mata kuliah baru')).toBeVisible();
          await expect(coursePage.codeInput).toBeVisible();
          await expect(coursePage.nameInput).toBeVisible();
          await expect(coursePage.sksInput).toBeVisible();
          await expect(coursePage.submitButton).toBeVisible();
        });
      },
    );

    // ── CREATE test (UI-driven: exercises the create form itself) ───────────

    test('should create a new course via UI',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRC${id}`;
        const name = `Course Create ${id}`;
        let assName = '', majName = '';

        await test.step('Arrange: seed prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.majorId(maj.id);
          assName = ass.name;
          majName = maj.name;
        });

        await test.step('Act: fill create form and submit', async () => {
          await coursePage.goto();
          await coursePage.openCreateModal();
          await coursePage.fillCourseForm({
            code,
            name,
            sks: '3',
            assessmentName: assName,
            majorName:      majName,
            courseType:     'WAJIB',
          });
          await coursePage.submitForm();
          trackForCleanup.courseCode(code);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await coursePage.assertModalClosed();
          await coursePage.gotoFiltered(name);
          await coursePage.assertRowVisible(name);
        });
      },
    );

    // ── READ tests (DB-seeded: no dependency on the Create UI flow) ─────────

    test('should display the new course in the table',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRD${id}`;
        const name = `Course Display ${id}`;

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
        });

        await test.step('Assert: row visible in table', async () => {
          await coursePage.gotoFiltered(name);
          await expect(coursePage.rowByName(name)).toBeVisible();
        });
      },
    );

    test('should find a course when searching by name',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRS${id}`;
        const name = `Course Search ${id}`;

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
        });

        await test.step('Act: search by name via search box', async () => {
          await coursePage.goto();
          await coursePage.search(name);
        });

        await test.step('Assert: row appears in search results', async () => {
          await coursePage.assertRowVisible(name);
        });
      },
    );

    test('should find a course when searching by code',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRK${id}`;
        const name = `Course Code ${id}`;

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
        });

        await test.step('Act: search by code via search box', async () => {
          await coursePage.goto();
          await coursePage.search(code);
        });

        await test.step('Assert: row appears in search results', async () => {
          await coursePage.assertRowVisible(name);
        });
      },
    );

    test('should open the update modal pre-filled with existing data',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRP${id}`;
        const name = `Course PreFill ${id}`;
        let assName = '', majName = '';

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
          assName = ass.name;
          majName = maj.name;
        });

        await test.step('Act: open update modal for the seeded row', async () => {
          await coursePage.gotoFiltered(name);
          await coursePage.openUpdateModal(name);
        });

        await test.step('Assert: modal pre-filled with correct values', async () => {
          await expect(coursePage.page.getByText('Ubah data mata kuliah')).toBeVisible();
          await expect(coursePage.codeInput).toHaveValue(code);
          await expect(coursePage.nameInput).toHaveValue(name);
          await coursePage.assertSelectedOption('Bentuk Penilaian', assName);
          await coursePage.assertSelectedOption('Program Studi', majName);
        });
      },
    );

    // ── UPDATE test (DB-seeded) ─────────────────────────────────────────────

    test('should update an existing course name',
      async ({ coursePage, trackForCleanup }) => {
        const id           = Date.now().toString().slice(-6);
        const code         = `CRU${id}`;
        const originalName = `Course Original ${id}`;
        const updatedName  = `Course Updated ${id}`;

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name: originalName, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          // Track by ID — stable even after the name changes
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
        });

        await test.step('Act: open update modal and submit new name', async () => {
          await coursePage.gotoFiltered(originalName);
          await coursePage.openUpdateModal(originalName);
          await coursePage.fillName(updatedName);
          await coursePage.submitForm();
          await coursePage.assertModalClosed();
        });

        await test.step('Assert: updated name visible and original name gone', async () => {
          await coursePage.gotoFiltered(updatedName);
          await coursePage.assertRowVisible(updatedName);

          await coursePage.gotoFiltered(originalName);
          await coursePage.assertRowNotVisible(originalName);
        });
      },
    );

    // ── DELETE tests (DB-seeded) ────────────────────────────────────────────

    test('should open the delete confirmation modal with a warning message',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRDM${id}`;
        const name = `Course DelModal ${id}`;

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
        });

        await test.step('Act: open delete confirmation modal', async () => {
          await coursePage.gotoFiltered(name);
          await coursePage.openDeleteModal(name);
        });

        await test.step('Assert: warning message and confirm button visible', async () => {
          await expect(coursePage.deleteWarningText).toBeVisible();
          await expect(coursePage.deleteConfirmButton).toBeVisible();
        });
      },
    );

    test('should delete a course and remove it from the table',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRDL${id}`;
        const name = `Course Delete ${id}`;

        await test.step('Arrange: seed course and prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          // Registered as safety net; SQL DELETE is a no-op if the UI delete succeeded
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
        });

        await test.step('Act: delete course via UI', async () => {
          await coursePage.gotoFiltered(name);
          await coursePage.deleteCourse(name);
        });

        await test.step('Assert: row no longer appears in table', async () => {
          await coursePage.gotoFiltered(name);
          await coursePage.assertRowNotVisible(name);
        });
      },
    );

    // ── Modal close / empty search (no data) ───────────────────────────────

    test('should close the modal without saving when the close button is clicked',
      async ({ coursePage }) => {
        const id = Date.now().toString().slice(-6);

        await test.step('Act: fill form then close modal without submitting', async () => {
          await coursePage.openCreateModal();
          await coursePage.fillCode(`CRX${id}`);
          await coursePage.fillName(`Course Close ${id}`);
          await coursePage.closeModal();
        });

        await test.step('Assert: modal is closed', async () => {
          await coursePage.assertModalClosed();
        });
      },
    );

    test('should return empty search results for a non-matching query',
      async ({ coursePage }) => {
        await test.step('Act: search with a non-matching query', async () => {
          await coursePage.search('XXXXXXXXXNONEXISTENT99999');
        });

        await test.step('Assert: table shows no results', async () => {
          await coursePage.assertTableEmpty();
        });
      },
    );

  });

  // ── NEGATIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    // ── Client-side validation (no DB prerequisites needed) ────────────────

    test('should show a validation error when the code field is empty',
      async ({ coursePage }) => {
        await test.step('Act: submit form with code left empty', async () => {
          await coursePage.openCreateModal();
          await coursePage.fillName('Test Course');
          await coursePage.fillSks('3');
          await coursePage.submitForm();
        });

        await test.step('Assert: code validation error shown and modal stays open', async () => {
          await coursePage.assertFieldError('kode mata kuliah harus diisi');
          await coursePage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when the name field is empty',
      async ({ coursePage }) => {
        await test.step('Act: submit form with name left empty', async () => {
          await coursePage.openCreateModal();
          await coursePage.fillCode('TST-EMPTY-NAME');
          await coursePage.fillSks('3');
          await coursePage.submitForm();
        });

        await test.step('Assert: name validation error shown and modal stays open', async () => {
          await coursePage.assertFieldError('nama mata kuliah harus diisi');
          await coursePage.assertModalOpen();
        });
      },
    );

    // ── React-select validation (DB prerequisites needed for dropdown options) ─

    test('should show a validation error when no assessment is selected',
      async ({ coursePage, trackForCleanup }) => {
        const id = Date.now().toString().slice(-6);
        let majName = '';

        await test.step('Arrange: seed major via DB factory', async () => {
          const maj = await createMajor(`Major NoAss ${id}`);
          trackForCleanup.majorId(maj.id);
          majName = maj.name;
        });

        await test.step('Act: fill form without selecting assessment and submit', async () => {
          await coursePage.goto();
          await coursePage.openCreateModal();
          await coursePage.fillCode(`CRNA${id}`);
          await coursePage.fillName('Test Course');
          await coursePage.fillSks('3');
          await coursePage.selectMajor(majName);
          await coursePage.selectCourseType('WAJIB');
          await coursePage.submitForm();
        });

        await test.step('Assert: assessment validation error shown and modal stays open', async () => {
          // assessmentId value is `undefined` (never touched) — Zod type check fires before
          // the custom min(1) message, so the rendered error is the Zod default "Required"
          await coursePage.assertFieldError('Required');
          await coursePage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when no major is selected',
      async ({ coursePage, trackForCleanup }) => {
        const id = Date.now().toString().slice(-6);
        let assName = '';

        await test.step('Arrange: seed grade component and assessment via DB factory', async () => {
          const gc  = await createGradeComponent(`GC NoMaj ${id}`, `GNM${id}`);
          const ass = await createAssessment(`Ass NoMaj ${id}`, [{ gradeComponentId: gc.id, percentage: 100 }]);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.assessmentId(ass.id);
          assName = ass.name;
        });

        await test.step('Act: fill form without selecting major and submit', async () => {
          await coursePage.goto();
          await coursePage.openCreateModal();
          await coursePage.fillCode(`CRNM${id}`);
          await coursePage.fillName('Test Course');
          await coursePage.fillSks('3');
          await coursePage.selectAssessment(assName);
          await coursePage.selectCourseType('WAJIB');
          await coursePage.submitForm();
        });

        await test.step('Assert: major validation error shown and modal stays open', async () => {
          await coursePage.assertFieldError('Pilih Program Studi');
          await coursePage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when no course type is selected',
      async ({ coursePage, trackForCleanup }) => {
        const id = Date.now().toString().slice(-6);
        let assName = '', majName = '';

        await test.step('Arrange: seed all prerequisites via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.majorId(maj.id);
          assName = ass.name;
          majName = maj.name;
        });

        await test.step('Act: fill form without selecting course type and submit', async () => {
          await coursePage.goto();
          await coursePage.openCreateModal();
          await coursePage.fillCode(`CRNT${id}`);
          await coursePage.fillName('Test Course');
          await coursePage.fillSks('3');
          await coursePage.selectAssessment(assName);
          await coursePage.selectMajor(majName);
          await coursePage.submitForm();
        });

        await test.step('Assert: course type validation error shown and modal stays open', async () => {
          // courseType value is `undefined` (never touched) — same Zod behaviour as assessmentId
          await coursePage.assertFieldError('Required');
          await coursePage.assertModalOpen();
        });
      },
    );

    // ── Server-side conflict checks (DB-seeded prerequisite) ───────────────

    test('should reject a duplicate course code',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRDC${id}`;
        const name = `Course Dup Code ${id}`;
        let assName = '', majName = '';

        await test.step('Arrange: seed prerequisites and course via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
          assName = ass.name;
          majName = maj.name;
        });

        await test.step('Act: attempt to create second course with the same code', async () => {
          await coursePage.goto();
          await coursePage.openCreateModal();
          await coursePage.fillCourseForm({
            code,
            name:           `Course Dup Code Alt ${id}`,
            sks:            '3',
            assessmentName: assName,
            majorName:      majName,
            courseType:     'WAJIB',
          });
          await coursePage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await coursePage.assertInlineFormError();
          await coursePage.assertModalOpen();
        });
      },
    );

    test('should reject a duplicate name-sks-major combination',
      async ({ coursePage, trackForCleanup }) => {
        const id   = Date.now().toString().slice(-6);
        const code = `CRDN${id}`;
        const name = `Course Dup Combo ${id}`;
        let assName = '', majName = '';

        await test.step('Arrange: seed prerequisites and course via DB factory', async () => {
          const { gc, ass, maj } = await seedPrerequisites(id);
          const course = await createCourse({ name, code, sks: 3, majorId: maj.id, assessmentId: ass.id, courseType: 'WAJIB' });
          trackForCleanup.courseId(course.id);
          trackForCleanup.assessmentId(ass.id);
          trackForCleanup.gcId(gc.id);
          trackForCleanup.majorId(maj.id);
          assName = ass.name;
          majName = maj.name;
        });

        await test.step('Act: attempt to create course with same name, sks, and major', async () => {
          await coursePage.goto();
          await coursePage.openCreateModal();
          await coursePage.fillCourseForm({
            code:           `CRDN2${id}`,
            name,
            sks:            '3',
            assessmentName: assName,
            majorName:      majName,
            courseType:     'WAJIB',
          });
          await coursePage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await coursePage.assertInlineFormError();
          await coursePage.assertModalOpen();
        });
      },
    );

  });

});
