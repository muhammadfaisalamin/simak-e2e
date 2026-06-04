import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Reregistration (Herregistrasi) management page.
 * URL: /list/reregistrations
 *
 * Covers: create, read (list + search), update (name + active status), and delete.
 *
 * The create/update form has three fields:
 *   - name:               plain text input
 *   - periodId:           react-select (label: "Semester")
 *   - isReregisterActive: checkbox (id: "isReregisterActive")
 */
export class ReregistrationPage {
  readonly page: Page;
  static readonly URL = '/list/reregistrations';

  // ── Page-level elements ────────────────────────────────────────────
  readonly pageHeading: Locator;

  // ── Search ────────────────────────────────────────────────────────
  readonly searchInput: Locator;

  // ── Form fields (visible only when modal is open) ─────────────────
  readonly nameInput: Locator;
  readonly activeCheckbox: Locator;
  readonly submitButton: Locator;

  // ── Inline form error (server-side, bottom of form) ───────────────
  readonly inlineFormError: Locator;

  // ── Delete confirmation ───────────────────────────────────────────
  readonly deleteConfirmButton: Locator;
  readonly deleteWarningText: Locator;

  // ── Table ─────────────────────────────────────────────────────────
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pageHeading   = page.getByRole('heading', { name: 'Daftar Herregistrasi' });
    this.searchInput   = page.locator('input[type="search"]');
    this.nameInput     = page.locator('input[name="name"]');
    this.activeCheckbox = page.locator('#isReregisterActive');
    this.submitButton  = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });
    this.inlineFormError = page.locator('form span.text-red-400');
    this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });
    this.deleteWarningText   = page.getByText(/apakah anda yakin ingin menghapus/i);
    this.tableRows     = page.locator('table tbody tr');
  }

  // ── Navigation ────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(ReregistrationPage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
  }

  async gotoFiltered(query: string): Promise<void> {
    await this.page.goto(
      `${ReregistrationPage.URL}?search=${encodeURIComponent(query)}`,
    );
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── React-select: Period (label "Semester") ───────────────────────

  private periodSelectControl(): Locator {
    return this.page
      .locator('div.flex.flex-col.gap-2')
      .filter({ has: this.page.locator('label:text-is("Semester")') })
      .locator('.react-select__control');
  }

  async selectPeriod(optionText: string): Promise<void> {
    await this.periodSelectControl().click();
    await this.page.locator('.react-select__option').filter({ hasText: optionText }).click();
  }

  async assertSelectedPeriod(expectedText: string): Promise<void> {
    await expect(
      this.page
        .locator('div.flex.flex-col.gap-2')
        .filter({ has: this.page.locator('label:text-is("Semester")') })
        .locator('.react-select__single-value'),
    ).toContainText(expectedText);
  }

  // ── Action buttons (located relative to a table row) ─────────────

  createButton(): Locator {
    return this.page.locator('button:has(img[alt="icon-create"])');
  }

  updateButtonInRow(rowName: string): Locator {
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-update"])');
  }

  deleteButtonInRow(rowName: string): Locator {
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-delete"])');
  }

  rowByName(name: string): Locator {
    return this.page.locator('tr').filter({
      has: this.page.locator(`h3:text-is("${name}")`),
    });
  }

  // ── Modal interactions ────────────────────────────────────────────

  async openCreateModal(): Promise<void> {
    await this.createButton().click();
    await this.nameInput.waitFor({ state: 'visible' });
  }

  async openUpdateModal(rowName: string): Promise<void> {
    await this.updateButtonInRow(rowName).click();
    await this.nameInput.waitFor({ state: 'visible' });
  }

  async openDeleteModal(rowName: string): Promise<void> {
    await this.deleteButtonInRow(rowName).click();
    await this.deleteConfirmButton.waitFor({ state: 'visible' });
  }

  async closeModal(): Promise<void> {
    await this.page.locator('div.absolute.top-4.right-4').click();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  // ── Form interactions ─────────────────────────────────────────────

  async fillName(value: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(value);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  async fillForm(data: { name: string; periodName: string }): Promise<void> {
    await this.fillName(data.name);
    await this.selectPeriod(data.periodName);
  }

  // ── High-level composite actions ──────────────────────────────────

  async updateReregistration(existingName: string, newName: string): Promise<void> {
    await this.openUpdateModal(existingName);
    await this.fillName(newName);
    await this.submitForm();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  async deleteReregistration(rowName: string): Promise<void> {
    await this.openDeleteModal(rowName);
    await this.deleteConfirmButton.click();
    await this.deleteConfirmButton.waitFor({ state: 'hidden' });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Assertion helpers ─────────────────────────────────────────────

  async assertRowVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).toBeVisible();
  }

  async assertRowNotVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).not.toBeVisible();
  }

  async assertModalOpen(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
  }

  async assertModalClosed(): Promise<void> {
    await expect(this.nameInput).not.toBeVisible();
  }

  async assertFieldError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async assertInlineFormError(): Promise<void> {
    await expect(this.inlineFormError).toBeVisible();
  }

  async assertTableEmpty(): Promise<void> {
    await expect(this.tableRows).toHaveCount(0);
  }
}
