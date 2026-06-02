// pages/RoleDetailPage.ts
import { Page, expect } from '@playwright/test';

export class RoleDetailPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto(roleId: string) {
		await this.page.goto(`/list/roles/${roleId}`);
		await expect(this.page).toHaveURL(new RegExp(`/list/roles/${roleId}`));
	}

	// EN: Encapsulates the logic to search and toggle a permission ON
	// ID: Membungkus logika mencari dan menyalakan toggle permission
	async enablePermission(keyword: string, inputId: string) {
		const searchInput = this.page.getByPlaceholder(/search/i);
		await searchInput.fill('');
		await searchInput.fill(keyword);
		await searchInput.press('Enter');

		const input = this.page.locator(`input[id="${inputId}"]`);
		const isChecked = await input.evaluate(
			(el: HTMLInputElement) => el.checked,
		);

		if (!isChecked) {
			await this.page.locator(`label[for="${inputId}"]`).click();
			await expect(input).toBeChecked();
		}
	}

	// EN: Encapsulates the reset logic for teardown
	// ID: Membungkus logika reset untuk proses cleanup
	async resetPermissionOff(keyword: string, inputId: string) {
		const searchInput = this.page.getByPlaceholder(/search/i);
		await searchInput.fill('');
		await searchInput.fill(keyword);
		await searchInput.press('Enter');

		const input = this.page.locator(`input[id="${inputId}"]`);
		const label = this.page.locator(`label[for="${inputId}"]`);

		const isChecked = await input.evaluate(
			(el: HTMLInputElement) => el.checked,
		);
		if (isChecked) {
			await label.click();
			await expect(input).not.toBeChecked();
		}
	}
}
