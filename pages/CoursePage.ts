import { Page, expect } from '@playwright/test';

export class CoursePage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async navigate() {
		await this.page.goto('/list/courses');
		await expect(this.page).toHaveURL(/\/list\/courses/);
	}

	// Pendekatan baru: Mencari react-select berdasarkan teks <label> pembungkusnya
	private async fillReactSelect(labelText: string, value: string) {
		// 1. Cari label dengan teks spesifik
		// 2. Gunakan locator('..') untuk naik tepat ke 1 parent div pembungkus
		// 3. Cari input react-select di dalam div pembungkus tersebut
		const input = this.page
			.locator('label', { hasText: new RegExp(labelText, 'i') })
			.locator('..')
			.locator('input.react-select__input');

		// Untuk react-select, kita bisa tambahkan force: true
		// jika inputnya tersembunyi/ditumpuk oleh elemen CSS lain
		await input.fill(value, { force: true });
		await this.page.keyboard.press('Enter');
	}

	async clickCreateButton() {
		await this.page.getByAltText('icon-create').click();
	}

	async clickUpdateButton(keyword: string) {
		const row = this.page.getByRole('row').filter({ hasText: keyword });
		await row
			.locator('button:has(img[alt="icon-update"])')
			.filter({ visible: true })
			.click();
	}

	async fillCourseForm(
		data: {
			code: string;
			sks: string;
			name: string;
			assessment: string;
			major: string;
			category: string;
			isPKL?: boolean;
			isSkripsi?: boolean;
		},
		isUpdate: boolean = false,
	) {
		// Text Inputs
		await this.page.locator('input[name="code"]').fill(data.code);
		await this.page.locator('input[name="sks"]').fill(data.sks);
		await this.page.locator('input[name="name"]').fill(data.name);

		// React-Select Dropdowns (Sekarang menggunakan teks Label, bukan Placeholder)
		await this.fillReactSelect('Bentuk Penilaian', data.assessment);
		await this.fillReactSelect('Program Studi', data.major);
		await this.fillReactSelect('Kategori Matkul', data.category);

		// Checkboxes
		// if (data.isPKL) await this.page.locator('label[for="isPKL"]').click();
		// if (data.isSkripsi)
		//  await this.page.locator('label[for="isSkripsi"]').click();

		const buttonRegex = isUpdate ? /^ubah$/i : /^tambah$/i;
		await this.page.getByRole('button', { name: buttonRegex }).click();
	}

	async searchCourse(keyword: string) {
		const searchInput = this.page.getByPlaceholder(/search/i);
		await searchInput.fill('');
		await searchInput.fill(keyword);
		await searchInput.press('Enter');
	}

	async deleteCourse(keyword: string) {
		const row = this.page.getByRole('row').filter({ hasText: keyword });
		await row
			.locator('button:has(img[alt="icon-delete"])')
			.filter({ visible: true })
			.click();
		const confirmDeleteBtn = this.page
			.getByRole('button', { name: /^hapus$/i })
			.filter({ visible: true });
		await confirmDeleteBtn.click();
	}
}
