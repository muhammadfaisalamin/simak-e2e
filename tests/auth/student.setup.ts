import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const AUTH_FILE = path.resolve(__dirname, '../../.auth/student.json');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

setup('login sebagai student', async ({ page }) => {
	console.log('🔐 Login sebagai Student/Mahasiswa...');

	await page.goto(`${BASE_URL}/sign-in`);
	await page.waitForSelector('input#username', { timeout: 10000 });
	await page.fill('input#username', process.env.TEST_STUDENT_EMAIL!);
	await page.fill('input#password', process.env.TEST_STUDENT_PASSWORD!);
	await page.locator('form button').click();

	await page.waitForFunction(
		() => !window.location.pathname.includes('sign-in'),
		{ timeout: 15000 },
	);

	console.log(`✅ Student berhasil login, URL: ${page.url()}`);

	await page.context().storageState({ path: AUTH_FILE });

	console.log(`💾 Cookie Student disimpan ke: ${AUTH_FILE}`);
});
