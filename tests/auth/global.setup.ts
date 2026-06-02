import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Muat environment variables dari .env.test
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Lokasi file penyimpanan cookie untuk tiap role
const AUTH_DIR = path.resolve(__dirname, '../../.auth');
const ADMIN_AUTH_FILE = path.join(AUTH_DIR, 'admin.json');
const LECTURER_AUTH_FILE = path.join(AUTH_DIR, 'lecturer.json');
const STUDENT_AUTH_FILE = path.join(AUTH_DIR, 'student.json');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Fungsi helper: lakukan login dan simpan cookie ke file
async function loginAndSave(
	email: string,
	password: string,
	authFile: string,
	roleName: string,
) {
	// Buka browser baru (tidak berbagi state dengan test lain)
	const browser = await chromium.launch();
	const context = await browser.newContext();
	const page = await context.newPage();

	console.log(`🔐 Login sebagai ${roleName}...`);

	// Buka halaman login
	await page.goto(`${BASE_URL}/sign-in`);

	// Tunggu form login muncul
	await page.waitForSelector('input#username', { timeout: 10000 });

	// Isi form login
	await page.fill('input#username', email);
	await page.fill('input#password', password);

	// Klik tombol login
	await page.locator('form button').click();

	// Tunggu redirect selesai — gunakan waitForFunction karena Next.js pakai client-side navigation
	await page.waitForFunction(
		() => !window.location.pathname.includes('sign-in'),
		{ timeout: 15000 },
	);

	console.log(`✅ ${roleName} berhasil login, URL: ${page.url()}`);

	// Simpan seluruh state browser (termasuk cookie "session") ke file
	await context.storageState({ path: authFile });

	console.log(`💾 Cookie ${roleName} disimpan ke: ${authFile}`);

	await browser.close();
}

// Fungsi utama — dipanggil otomatis oleh Playwright
async function globalSetup(config: FullConfig) {
	// Login untuk role Admin/Operator
	await loginAndSave(
		process.env.TEST_ADMIN_EMAIL!,
		process.env.TEST_ADMIN_PASSWORD!,
		ADMIN_AUTH_FILE,
		'Admin/Operator',
	);

	// Login untuk role Lecturer/Dosen
	await loginAndSave(
		process.env.TEST_LECTURER_EMAIL!,
		process.env.TEST_LECTURER_PASSWORD!,
		LECTURER_AUTH_FILE,
		'Lecturer/Dosen',
	);

	// Login untuk role Student/Mahasiswa
	await loginAndSave(
		process.env.TEST_STUDENT_EMAIL!,
		process.env.TEST_STUDENT_PASSWORD!,
		STUDENT_AUTH_FILE,
		'Student/Mahasiswa',
	);

	console.log('\n🎉 Semua role berhasil login! Test siap dijalankan.\n');
}

export default globalSetup;
