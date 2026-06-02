import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Grade Component (Komponen Nilai) management page.
 * URL: /list/courses/grade-component
 *
 * Covers: create, read (list + search), update, and delete operations.
 */
export class GradeComponentPage {
  readonly page: Page;
  static readonly URL = '/list/courses/grade-component';

  // ── Page-level elements ────────────────────────────────────────────
  readonly pageHeading: Locator;

  // ── Search ────────────────────────────────────────────────────────
  readonly searchInput: Locator;

  // ── Modal overlay ─────────────────────────────────────────────────
  readonly modalOverlay: Locator;
  readonly modalCloseButton: Locator;

  // ── Form fields (visible only when modal is open) ─────────────────
  readonly nameInput: Locator;
  readonly acronymInput: Locator;
  readonly submitButton: Locator;

  // ── Inline form error (server-side, bottom of form) ───────────────
  readonly inlineFormError: Locator;

  // ── Delete confirmation ───────────────────────────────────────────
  readonly deleteConfirmButton: Locator;
  readonly deleteWarningText: Locator;

  // ── Table ─────────────────────────────────────────────────────────
  readonly tableBody: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pageHeading      = page.getByRole('heading', { name: 'Komponen Nilai' });
    this.searchInput      = page.locator('input[type="search"]');
    this.modalOverlay     = page.locator('div.fixed');
    this.modalCloseButton = page.locator('div.absolute.top-4.right-4');
    this.nameInput        = page.locator('input[name="name"]');
    this.acronymInput     = page.locator('input[name="acronym"]');
    this.submitButton     = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });
    this.inlineFormError  = page.locator('form span.text-red-400');
    this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });
    this.deleteWarningText   = page.getByText(/apakah anda yakin ingin menghapus/i);
    this.tableBody        = page.locator('table tbody');
    this.tableRows        = page.locator('table tbody tr');
  }

  // ── Navigation ────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(GradeComponentPage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
  }

  /**
   * Navigate to the page with a pre-applied search query.
   * Use this after creating data to avoid pagination issues —
   * the server filters results so the target row is always on page 1.
   */
  async gotoFiltered(query: string): Promise<void> {
    await this.page.goto(
      `${GradeComponentPage.URL}?search=${encodeURIComponent(query)}`,
    );
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── Action buttons (located relative to a table row) ─────────────

  createButton(): Locator {
    return this.page.locator('button:has(img[alt="icon-create"])');
  }

  updateButtonInRow(rowName: string): Locator {
    // Target only the desktop Actions column (last td) to avoid
    // matching the duplicate mobile-view buttons in the first td.
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
    // Use text-is() for exact match to prevent substring collisions
    // between rows that share common words (e.g. "Updated" vs "Tugas Harian Updated").
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
    await this.modalCloseButton.click();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  // ── Form interactions ─────────────────────────────────────────────

  async fillName(value: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(value);
  }

  async fillAcronym(value: string): Promise<void> {
    await this.acronymInput.clear();
    await this.acronymInput.fill(value);
  }

  async fillForm(data: { name: string; acronym: string }): Promise<void> {
    await this.fillName(data.name);
    await this.fillAcronym(data.acronym);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  // ── High-level composite actions ──────────────────────────────────

  async createGradeComponent(name: string, acronym: string): Promise<void> {
    await this.openCreateModal();
    await this.fillForm({ name, acronym });
    await this.submitForm();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  async updateGradeComponent(
    existingName: string,
    newData: { name: string; acronym: string },
  ): Promise<void> {
    await this.openUpdateModal(existingName);
    await this.fillForm(newData);
    await this.submitForm();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  async deleteGradeComponent(rowName: string): Promise<void> {
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
