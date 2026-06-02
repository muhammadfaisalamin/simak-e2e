import { Page, expect } from '@playwright/test';

export class LoginPage {
	readonly page: Page;
	constructor(page: Page) {
		this.page = page;
	}

	async login(email: string, password: string, expectedUrlRegex: RegExp) {
		await this.page.goto('/sign-in');
		await this.page.locator('#username').fill(email);
		await this.page.locator('#password').fill(password);
		await this.page.getByRole('button', { name: /log in/i }).click();
		await expect(this.page).toHaveURL(expectedUrlRegex);
	}

	async logout() {
		await this.page.getByRole('button', { name: /logout/i }).click();
		await expect(this.page).toHaveURL(/\/sign-in/);
	}
}
