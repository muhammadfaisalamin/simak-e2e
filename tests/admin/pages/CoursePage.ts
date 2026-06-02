import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Course (Mata Kuliah) management page.
 * URL: /list/courses/course
 *
 * The form has four react-select dropdowns (assessment, major, predecessor, courseType)
 * and three plain text inputs (code, name, sks).
 */
export class CoursePage {
  readonly page: Page;
  static readonly URL = '/list/courses/course';

  // ── Page-level elements ────────────────────────────────────────────
  readonly pageHeading: Locator;

  // ── Search ────────────────────────────────────────────────────────
  readonly searchInput: Locator;

  // ── Modal overlay ─────────────────────────────────────────────────
  readonly modalCloseButton: Locator;

  // ── Form fields (visible only when modal is open) ─────────────────
  readonly codeInput: Locator;
  readonly nameInput: Locator;
  readonly sksInput:  Locator;
  readonly submitButton: Locator;

  // ── Inline form error (server-side, bottom of form) ───────────────
  readonly inlineFormError: Locator;

  // ── Delete confirmation ───────────────────────────────────────────
  readonly deleteConfirmButton: Locator;
  readonly deleteWarningText:   Locator;

  // ── Table ─────────────────────────────────────────────────────────
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pageHeading        = page.getByRole('heading', { name: 'Data Mata Kuliah' });
    this.searchInput        = page.locator('input[type="search"]');
    this.modalCloseButton   = page.locator('div.absolute.top-4.right-4');
    this.codeInput          = page.locator('input[name="code"]');
    this.nameInput          = page.locator('input[name="name"]');
    this.sksInput           = page.locator('input[name="sks"]');
    this.submitButton       = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });
    this.inlineFormError    = page.locator('form span.text-red-400');
    this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });
    this.deleteWarningText   = page.getByText(/apakah anda yakin ingin menghapus/i);
    this.tableRows           = page.locator('table tbody tr');
  }

  // ── Navigation ────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(CoursePage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
  }

  async gotoFiltered(query: string): Promise<void> {
    await this.page.goto(
      `${CoursePage.URL}?search=${encodeURIComponent(query)}`,
    );
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── Row / button locators ─────────────────────────────────────────

  rowByName(name: string): Locator {
    return this.page.locator('tr').filter({
      has: this.page.locator(`h3:text-is("${name}")`),
    });
  }

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

  // ── React-select helpers ──────────────────────────────────────────

  /**
   * Locate the react-select control that belongs to a specific form field
   * by finding its sibling label. Works for all four dropdowns in CourseForm.
   */
  private reactSelectByLabel(labelText: string): Locator {
    return this.page
      .locator('div.flex.flex-col.gap-2')
      .filter({ has: this.page.locator(`label:text-is("${labelText}")`) })
      .locator('.react-select__control');
  }

  private async selectOption(labelText: string, optionText: string): Promise<void> {
    await this.reactSelectByLabel(labelText).click();
    await this.page
      .locator('.react-select__option')
      .filter({ hasText: optionText })
      .click();
  }

  async selectAssessment(optionText: string): Promise<void> {
    await this.selectOption('Bentuk Penilaian', optionText);
  }

  async selectMajor(optionText: string): Promise<void> {
    await this.selectOption('Program Studi', optionText);
  }

  async selectCourseType(optionText: string): Promise<void> {
    await this.selectOption('Kategori Matkul', optionText);
  }

  async assertSelectedOption(labelText: string, expectedText: string): Promise<void> {
    await expect(
      this.page
        .locator('div.flex.flex-col.gap-2')
        .filter({ has: this.page.locator(`label:text-is("${labelText}")`) })
        .locator('.react-select__single-value'),
    ).toContainText(expectedText);
  }

  // ── Modal interactions ────────────────────────────────────────────

  async openCreateModal(): Promise<void> {
    await this.createButton().click();
    await this.codeInput.waitFor({ state: 'visible' });
  }

  async openUpdateModal(rowName: string): Promise<void> {
    await this.updateButtonInRow(rowName).click();
    await this.codeInput.waitFor({ state: 'visible' });
  }

  async openDeleteModal(rowName: string): Promise<void> {
    await this.deleteButtonInRow(rowName).click();
    await this.deleteConfirmButton.waitFor({ state: 'visible' });
  }

  async closeModal(): Promise<void> {
    await this.modalCloseButton.click();
    await this.codeInput.waitFor({ state: 'hidden' });
  }

  // ── Form interactions ─────────────────────────────────────────────

  async fillCode(value: string): Promise<void> {
    await this.codeInput.clear();
    await this.codeInput.fill(value);
  }

  async fillName(value: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(value);
  }

  async fillSks(value: string): Promise<void> {
    await this.sksInput.clear();
    await this.sksInput.fill(value);
  }

  async fillCourseForm(opts: {
    code: string;
    name: string;
    sks: string;
    assessmentName: string;
    majorName: string;
    courseType: string;
  }): Promise<void> {
    await this.fillCode(opts.code);
    await this.fillSks(opts.sks);
    await this.fillName(opts.name);
    await this.selectAssessment(opts.assessmentName);
    await this.selectMajor(opts.majorName);
    await this.selectCourseType(opts.courseType);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  async deleteCourse(rowName: string): Promise<void> {
    await this.openDeleteModal(rowName);
    await this.deleteConfirmButton.click();
    await this.deleteConfirmButton.waitFor({ state: 'hidden' });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Assertions ────────────────────────────────────────────────────

  async assertRowVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).toBeVisible();
  }

  async assertRowNotVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).not.toBeVisible();
  }

  async assertModalOpen(): Promise<void> {
    await expect(this.codeInput).toBeVisible();
  }

  async assertModalClosed(): Promise<void> {
    await expect(this.codeInput).not.toBeVisible();
  }

  async assertFieldError(message: string): Promise<void> {
    await expect(this.page.getByText(message).first()).toBeVisible();
  }

  async assertInlineFormError(): Promise<void> {
    await expect(this.inlineFormError).toBeVisible();
  }

  async assertTableEmpty(): Promise<void> {
    await expect(this.tableRows).toHaveCount(0);
  }
}
