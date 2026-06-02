import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const AUTH_FILE = path.resolve(__dirname, '../../.auth/lecturer.json');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

setup('login sebagai lecturer', async ({ page }) => {
	console.log('🔐 Login sebagai Lecturer/Dosen...');

	await page.goto(`${BASE_URL}/sign-in`);
	await page.waitForSelector('input#username', { timeout: 10000 });
	await page.fill('input#username', process.env.TEST_LECTURER_EMAIL!);
	await page.fill('input#password', process.env.TEST_LECTURER_PASSWORD!);
	await page.locator('form button').click();

	await page.waitForFunction(
		() => !window.location.pathname.includes('sign-in'),
		{ timeout: 15000 },
	);

	console.log(`✅ Lecturer berhasil login, URL: ${page.url()}`);

	await page.context().storageState({ path: AUTH_FILE });

	console.log(`💾 Cookie Lecturer disimpan ke: ${AUTH_FILE}`);
});
