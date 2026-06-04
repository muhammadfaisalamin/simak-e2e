import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Assessment (Bentuk Penilaian) management page.
 * URL: /list/courses/assesment
 *
 * The form has a dynamic list of grade components (react-select + percentage input),
 * where total percentage must equal 100 and no duplicate components are allowed.
 */
export class AssessmentPage {
  readonly page: Page;
  static readonly URL = '/list/courses/assesment';

  // ── Page-level elements ────────────────────────────────────────────
  readonly pageHeading: Locator;

  // ── Search ────────────────────────────────────────────────────────
  readonly searchInput: Locator;

  // ── Modal overlay ─────────────────────────────────────────────────
  readonly modalCloseButton: Locator;

  // ── Form fields (visible only when modal is open) ─────────────────
  readonly nameInput: Locator;
  readonly addComponentButton: Locator;
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

    this.pageHeading       = page.getByRole('heading', { name: 'Bentuk Penilaian' });
    this.searchInput       = page.locator('input[type="search"]');
    this.modalCloseButton  = page.locator('div.absolute.top-4.right-4');
    this.nameInput         = page.locator('input[name="name"]');
    // "+ Tambah Komponen" — regex avoids matching plain "Tambah" submit button
    this.addComponentButton = page.getByRole('button', { name: /Tambah Komponen/ });
    this.submitButton      = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });
    this.inlineFormError   = page.locator('form span.text-red-400');
    this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });
    this.deleteWarningText   = page.getByText(/apakah anda yakin ingin menghapus/i);
    this.tableRows         = page.locator('table tbody tr');
  }

  // ── Navigation ────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AssessmentPage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
  }

  async gotoFiltered(query: string): Promise<void> {
    await this.page.goto(
      `${AssessmentPage.URL}?search=${encodeURIComponent(query)}`,
    );
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── Action buttons (located relative to a table row) ─────────────

  createButton(): Locator {
    return this.page.locator('button:has(img[alt="icon-create"])');
  }

  updateButtonInRow(rowName: string): Locator {
    // td:last-child targets only the desktop Actions column — avoids
    // matching the duplicate mobile-view buttons rendered in the first td.
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

  // ── Grade component row controls ──────────────────────────────────

  /**
   * The react-select control for a specific grade component row.
   * react-select renders each dropdown with classNamePrefix="react-select",
   * so controls are queried by the generated .react-select__control class.
   */
  gradeComponentSelect(index: number): Locator {
    return this.page.locator('.react-select__control').nth(index);
  }

  percentageInput(index: number): Locator {
    return this.page.locator(`input[name="gradeComponents.${index}.percentage"]`);
  }

  /**
   * The red "Hapus" button inside the grade component form rows.
   * Uses bg-red-500 class to distinguish from the delete confirmation "Hapus".
   */
  removeComponentButton(index: number): Locator {
    return this.page.locator('button.bg-red-500').nth(index);
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
    await this.modalCloseButton.click();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  // ── Form interactions ─────────────────────────────────────────────

  async fillName(value: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(value);
  }

  /**
   * Select a grade component from the react-select dropdown at the given row index.
   * Clicks the control to open the menu, then clicks the matching option.
   */
  async selectGradeComponent(index: number, optionText: string): Promise<void> {
    await this.gradeComponentSelect(index).click();
    await this.page
      .locator('.react-select__option')
      .filter({ hasText: optionText })
      .click();
  }

  async setPercentage(index: number, value: string): Promise<void> {
    const input = this.percentageInput(index);
    await input.clear();
    await input.fill(value);
  }

  async addComponentRow(): Promise<void> {
    await this.addComponentButton.click();
  }

  async removeComponentRow(index: number): Promise<void> {
    await this.removeComponentButton(index).click();
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  // ── High-level composite actions ──────────────────────────────────

  /**
   * Fill the form with a single grade component (most common case).
   * Percentage defaults to '100' so no additional rows are needed.
   */
  async fillSingleComponentForm(
    name: string,
    gcName: string,
    percentage: string = '100',
  ): Promise<void> {
    await this.fillName(name);
    await this.selectGradeComponent(0, gcName);
    await this.setPercentage(0, percentage);
  }

  /**
   * Fill the form with two grade components (tests multi-component behaviour).
   */
  async fillTwoComponentForm(
    name: string,
    gc1Name: string,
    pct1: string,
    gc2Name: string,
    pct2: string,
  ): Promise<void> {
    await this.fillName(name);
    await this.selectGradeComponent(0, gc1Name);
    await this.setPercentage(0, pct1);
    await this.addComponentRow();
    await this.selectGradeComponent(1, gc2Name);
    await this.setPercentage(1, pct2);
  }

  /**
   * Generic multi-component form fill — works for any number of components.
   * Adds extra rows automatically via "+ Tambah Komponen" for index > 0.
   */
  async fillComponentsForm(
    name: string,
    components: Array<{ gcName: string; percentage: string }>,
  ): Promise<void> {
    await this.fillName(name);
    for (let i = 0; i < components.length; i++) {
      if (i > 0) await this.addComponentRow();
      await this.selectGradeComponent(i, components[i].gcName);
      await this.setPercentage(i, components[i].percentage);
    }
  }

  /**
   * Full create flow — opens modal, fills single-component form, submits, waits for close.
   */
  async createAssessment(
    name: string,
    gcName: string,
    percentage: string = '100',
  ): Promise<void> {
    await this.openCreateModal();
    await this.fillSingleComponentForm(name, gcName, percentage);
    await this.submitForm();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  async deleteAssessment(rowName: string): Promise<void> {
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
    // Use .first() so the assertion passes when the same message appears on
    // multiple rows (e.g. duplicate GC error shown on both affected rows).
    await expect(this.page.getByText(message).first()).toBeVisible();
  }

  async assertInlineFormError(): Promise<void> {
    await expect(this.inlineFormError).toBeVisible();
  }

  async assertTableEmpty(): Promise<void> {
    await expect(this.tableRows).toHaveCount(0);
  }

  /**
   * Assert that the react-select at the given index shows the expected selected value.
   */
  async assertSelectedGradeComponent(index: number, expectedText: string): Promise<void> {
    await expect(
      this.page.locator('.react-select__single-value').nth(index),
    ).toContainText(expectedText);
  }
}
