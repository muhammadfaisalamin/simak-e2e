import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the student Reregistration (Herregistrasi Mahasiswa) page.
 * URL: /list/reregistrations  (student session renders the @student slot)
 *
 * The table shows all ReregisterDetail rows for the logged-in student.
 * There is no working URL-based search filter — tests use rowByName() for row targeting.
 *
 * Action buttons (desktop only, inside hidden md:flex wrapper in the last <td>):
 *   - update button (icon-update): paymentStatus === "LUNAS" && !isStatusForm
 *   - PDF link     (icon-print*):  paymentStatus === "LUNAS" && isStatusForm
 *
 * The student form fields:
 *   - Disabled (pre-filled from DB): nim, name, year, semester, major, campusType, lecturerId
 *   - Required editable: placeOfBirth, birthday, hp, email, domicile, address,
 *                        guardianName, guardianNIK, guardianJob, guardianHp, guardianAddress,
 *                        motherName, motherNIK
 */
export class ReregistrationStudentPage {
  readonly page: Page;
  static readonly URL = '/list/reregistrations';

  readonly pageHeading: Locator;
  readonly placeOfBirthInput: Locator;
  readonly submitButton: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading   = page.getByRole('heading', { name: 'Herregistrasi Mahasiswa' });
    this.placeOfBirthInput = page.locator('input[name="placeOfBirth"]');
    this.submitButton  = page.getByRole('button', { name: 'Kirim Data' });
    this.tableRows     = page.locator('table tbody tr');
  }

  // ── Navigation ────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(ReregistrationStudentPage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── Row targeting ─────────────────────────────────────────────────

  rowByName(name: string): Locator {
    return this.page.locator('tr').filter({
      has: this.page.locator(`h3:text-is("${name}")`),
    });
  }

  // ── Action buttons (desktop only — in last <td>, hidden md:flex) ──

  updateButtonInRow(rowName: string): Locator {
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-update"])');
  }

  pdfLinkInRow(rowName: string): Locator {
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child a:has(img[alt*="icon-print"])');
  }

  // ── Modal interactions ────────────────────────────────────────────

  async openUpdateModal(rowName: string): Promise<void> {
    await this.updateButtonInRow(rowName).click();
    await this.placeOfBirthInput.waitFor({ state: 'visible' });
  }

  async closeModal(): Promise<void> {
    await this.page.locator('div.absolute.top-4.right-4').click();
    await this.placeOfBirthInput.waitFor({ state: 'hidden' });
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  // ── Form interactions ─────────────────────────────────────────────

  async fillStudentForm(data: {
    placeOfBirth?: string;
    birthday?: string;
    hp?: string;
    email?: string;
    domicile?: string;
    address?: string;
    guardianName?: string;
    guardianNIK?: string;
    guardianJob?: string;
    guardianHp?: string;
    guardianAddress?: string;
    motherName?: string;
    motherNIK?: string;
  }): Promise<void> {
    if (data.placeOfBirth !== undefined) {
      await this.page.locator('input[name="placeOfBirth"]').fill(data.placeOfBirth);
    }
    if (data.birthday !== undefined) {
      await this.page.locator('input[name="birthday"]').fill(data.birthday);
    }
    if (data.hp !== undefined) {
      await this.page.locator('input[name="hp"]').fill(data.hp);
    }
    if (data.email !== undefined) {
      await this.page.locator('input[name="email"]').fill(data.email);
    }
    if (data.domicile !== undefined) {
      await this.page.locator('textarea[name="domicile"]').fill(data.domicile);
    }
    if (data.address !== undefined) {
      await this.page.locator('textarea[name="address"]').fill(data.address);
    }
    if (data.guardianName !== undefined) {
      await this.page.locator('input[name="guardianName"]').fill(data.guardianName);
    }
    if (data.guardianNIK !== undefined) {
      await this.page.locator('input[name="guardianNIK"]').fill(data.guardianNIK);
    }
    if (data.guardianJob !== undefined) {
      await this.page.locator('input[name="guardianJob"]').fill(data.guardianJob);
    }
    if (data.guardianHp !== undefined) {
      await this.page.locator('input[name="guardianHp"]').fill(data.guardianHp);
    }
    if (data.guardianAddress !== undefined) {
      await this.page.locator('textarea[name="guardianAddress"]').fill(data.guardianAddress);
    }
    if (data.motherName !== undefined) {
      await this.page.locator('input[name="motherName"]').fill(data.motherName);
    }
    if (data.motherNIK !== undefined) {
      await this.page.locator('input[name="motherNIK"]').fill(data.motherNIK);
    }
  }

  // ── Assertion helpers ─────────────────────────────────────────────

  async assertRowVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).toBeVisible();
  }

  async assertRowNotVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).not.toBeVisible();
  }

  async assertModalOpen(): Promise<void> {
    await expect(this.placeOfBirthInput).toBeVisible();
  }

  async assertModalClosed(): Promise<void> {
    await expect(this.placeOfBirthInput).not.toBeVisible();
  }

  async assertFieldError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async assertTableEmpty(): Promise<void> {
    await expect(this.tableRows).toHaveCount(0);
  }
}
