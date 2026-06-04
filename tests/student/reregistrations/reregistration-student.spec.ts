import { randomUUID } from 'crypto';
import { test, expect } from '../../fixtures/reregistration-student.fixture';
import { createReregistration } from '../../factories/reregistration.factory';
import { createPeriod } from '../../factories/period.factory';
import { createReregisterDetail } from '../../factories/reregister-detail.factory';
import { getTestStudentId } from '../../factories/student.factory';

/**
 * E2E Test Suite: Reregistration (Herregistrasi) — Student (Mahasiswa) View
 *
 * Covers positive and negative scenarios for the student-facing reregistration page.
 *
 * Prerequisites:
 *  - Student session cookie must be present (.auth/student.json)
 *  - TEST_STUDENT_EMAIL must be set in .env.test
 *  - The test student must have year, majorId, lecturerId set in sb25_students
 *    (required by the Zod schema for disabled fields; form submission fails otherwise)
 *  - Application must be running at TEST_BASE_URL
 *  - DATABASE_URL must be set in .env.test
 *
 * Data isolation strategy:
 *  - Each test resolves the test student's UUID at runtime via getTestStudentId()
 *  - Each test seeds its own unique Reregister + ReregisterDetail via SQL factories
 *  - trackForCleanup removes all rows via SQL after each test, pass or fail
 *  - Teardown order: Reregister first (cascades ReregisterDetail), then Period
 *  - The student page has no working URL search filter; rowByName() is used for targeting
 *  - mode: 'parallel' — tests are fully independent (workers: 1 → runs sequentially)
 */

/** Helper: build a unique period name for student tests. */
function periodName(id: string): string {
  // "S" prefix distinguishes student test periods from admin test periods
  return `Semester Ganjil S${id}`;
}

/** All required editable fields with valid values — used in negative tests. */
const validStudentData = {
  placeOfBirth:   'Jakarta',
  birthday:       '2000-01-01',
  hp:             '081234567890',
  email:          'test@e2e.local',
  domicile:       'Jl. E2E No. 1, Jakarta',
  address:        'Jl. E2E No. 1, Jakarta',
  guardianName:   'E2E Guardian',
  guardianNIK:    '1234567890123456',
  guardianJob:    'Wiraswasta',
  guardianHp:     '081234567890',
  guardianAddress:'Jl. Guardian E2E No. 1',
  motherName:     'E2E Mother',
  motherNIK:      '1234567890123457',
};

test.describe('Reregistration Student Management', () => {
  test.describe.configure({ mode: 'parallel', timeout: 90000 });

  // ── POSITIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Page-level check (no data required) ───────────────────────────────

    test('should load the student reregistration page with the correct heading',
      async ({ reregistrationStudentPage }) => {
        await expect(reregistrationStudentPage.pageHeading).toBeVisible();
        await expect(reregistrationStudentPage.page).toHaveURL(/reregistrations/);
      },
    );

    // ── READ tests (DB-seeded) ─────────────────────────────────────────────

    test('should display a reregistration entry for the student',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std Display ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed period, reregistration, and detail via DB factory', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS' });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: row is visible in the table', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.assertRowVisible(name);
        });
      },
    );

    test('should show BELUM_LUNAS badge for an unpaid entry',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std BelumLunas ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with paymentStatus: BELUM_LUNAS', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'BELUM_LUNAS' });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: row shows BELUM_LUNAS badge', async () => {
          await reregistrationStudentPage.goto();
          await expect(reregistrationStudentPage.rowByName(name)).toContainText('BELUM_LUNAS');
        });
      },
    );

    test('should show LUNAS badge for a paid entry',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std Lunas ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with paymentStatus: LUNAS', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS' });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: row shows LUNAS badge', async () => {
          await reregistrationStudentPage.goto();
          await expect(reregistrationStudentPage.rowByName(name)).toContainText('LUNAS');
        });
      },
    );

    test('should show update button when payment is LUNAS and form not yet submitted',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std ShowBtn ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: update button is visible', async () => {
          await reregistrationStudentPage.goto();
          await expect(reregistrationStudentPage.updateButtonInRow(name)).toBeVisible();
        });
      },
    );

    test('should not show update button when payment is BELUM_LUNAS',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std NoBtn ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with BELUM_LUNAS', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'BELUM_LUNAS' });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: update button is not visible', async () => {
          await reregistrationStudentPage.goto();
          await expect(reregistrationStudentPage.updateButtonInRow(name)).not.toBeVisible();
        });
      },
    );

    // ── Modal and form tests ───────────────────────────────────────────────

    test('should open the student form modal',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std OpenModal ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: click update button to open modal', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.openUpdateModal(name);
        });

        await test.step('Assert: form modal is open', async () => {
          await reregistrationStudentPage.assertModalOpen();
          await expect(reregistrationStudentPage.submitButton).toBeVisible();
        });
      },
    );

    test('should submit the student form successfully',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std Submit ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open modal, fill all required fields, and submit', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.openUpdateModal(name);
          await reregistrationStudentPage.fillStudentForm(validStudentData);
          await reregistrationStudentPage.submitForm();
        });

        await test.step('Assert: modal closes after successful submission', async () => {
          await reregistrationStudentPage.assertModalClosed();
        });
      },
    );

    test('should show PDF link and hide update button when form is already submitted',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std PDF ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: true', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: true });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Assert: PDF link visible and update button absent', async () => {
          await reregistrationStudentPage.goto();
          await expect(reregistrationStudentPage.pdfLinkInRow(name)).toBeVisible();
          await expect(reregistrationStudentPage.updateButtonInRow(name)).not.toBeVisible();
        });
      },
    );

    test('should close the student form modal without saving',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std CloseModal ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open modal then close without submitting', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.openUpdateModal(name);
          await reregistrationStudentPage.closeModal();
        });

        await test.step('Assert: modal is closed', async () => {
          await reregistrationStudentPage.assertModalClosed();
        });
      },
    );

  });

  // ── NEGATIVE SCENARIOS ──────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    test('should show a validation error when placeOfBirth is empty',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std NoBirth ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open modal, fill all fields, clear placeOfBirth, and submit', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.openUpdateModal(name);
          await reregistrationStudentPage.fillStudentForm(validStudentData);
          await reregistrationStudentPage.page.locator('input[name="placeOfBirth"]').fill('');
          await reregistrationStudentPage.submitForm();
        });

        await test.step('Assert: placeOfBirth error shown and modal stays open', async () => {
          await reregistrationStudentPage.assertFieldError('Tempat lahir harus diisi');
          await reregistrationStudentPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when guardianName is empty',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std NoGuardian ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open modal, fill all fields, clear guardianName, and submit', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.openUpdateModal(name);
          await reregistrationStudentPage.fillStudentForm(validStudentData);
          await reregistrationStudentPage.page.locator('input[name="guardianName"]').fill('');
          await reregistrationStudentPage.submitForm();
        });

        await test.step('Assert: guardianName error shown and modal stays open', async () => {
          await reregistrationStudentPage.assertFieldError('nama orang tua/wali harus diisi');
          await reregistrationStudentPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when motherName is empty',
      async ({ reregistrationStudentPage, trackForCleanup }) => {
        const id        = randomUUID().slice(0, 8);
        const name      = `Herregistrasi Std NoMother ${id}`;
        const studentId = await getTestStudentId();

        await test.step('Arrange: seed detail with LUNAS + isStatusForm: false', async () => {
          const period = await createPeriod(2025, 'GANJIL', periodName(id));
          const rr     = await createReregistration(name, period.id);
          await createReregisterDetail(rr.id, studentId, { paymentStatus: 'LUNAS', isStatusForm: false });
          trackForCleanup.reregistrationId(rr.id);
          trackForCleanup.periodId(period.id);
        });

        await test.step('Act: open modal, fill all fields, clear motherName, and submit', async () => {
          await reregistrationStudentPage.goto();
          await reregistrationStudentPage.openUpdateModal(name);
          await reregistrationStudentPage.fillStudentForm(validStudentData);
          await reregistrationStudentPage.page.locator('input[name="motherName"]').fill('');
          await reregistrationStudentPage.submitForm();
        });

        await test.step('Assert: motherName error shown and modal stays open', async () => {
          await reregistrationStudentPage.assertFieldError('nama gadis ibu kandung harus diisi');
          await reregistrationStudentPage.assertModalOpen();
        });
      },
    );

  });

});
