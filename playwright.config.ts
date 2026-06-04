import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Muat environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Path ke file cookie tiap role
const AUTH_DIR = path.resolve(__dirname, '.auth');

export default defineConfig({
	testDir: './tests',

	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	// workers: process.env.CI ? 1 : undefined,
	workers: 3,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		[
			'html',
			{
				// Buka otomatis di browser hanya saat development lokal.
				// Di CI (GITHUB_ACTIONS / CI=true) jangan buka browser.
				open: process.env.CI ? 'never' : 'always',
				// Folder output laporan. Bisa di-override lewat env var:
				//   PLAYWRIGHT_HTML_OUTPUT_FOLDER=playwright-report-api npm run test:api
				outputFolder:
					process.env.PLAYWRIGHT_HTML_OUTPUT_FOLDER ?? 'playwright-report',
			},
		],
		['list'],
	],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('')`. */
		baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000',
		headless: !!process.env.CI,
		launchOptions: {
			slowMo: process.env.CI ? 0 : 1000,
		},

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		/* Ambil trace dan screenshot HANYA jika test gagal */
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},

	/* Configure projects for major browsers */
	projects: [
		// ─── SETUP PROJECT (login per role) ──────────────────────
		{
			name: 'setup-admin',
			testMatch: 'tests/auth/admin.setup.ts',
		},
		{
			name: 'setup-lecturer',
			testMatch: 'tests/auth/lecturer.setup.ts',
		},
		{
			name: 'setup-student',
			testMatch: 'tests/auth/student.setup.ts',
		},

		// ─── PROJECT ADMIN/OPERATOR ───────────────────────────────
		{
			name: 'admin',
			use: {
				...devices['Desktop Chrome'],
				storageState: path.join(AUTH_DIR, 'admin.json'),
			},
			testMatch: 'tests/admin/**/*.spec.ts',
			dependencies: ['setup-admin'],
		},

		// ─── PROJECT LECTURER/DOSEN ───────────────────────────────
		{
			name: 'lecturer',
			use: {
				...devices['Desktop Chrome'],
				storageState: path.join(AUTH_DIR, 'lecturer.json'),
			},
			testMatch: 'tests/lecturer/**/*.spec.ts',
			dependencies: ['setup-lecturer'],
		},

		// ─── PROJECT STUDENT/MAHASISWA ────────────────────────────
		{
			name: 'student',
			use: {
				...devices['Desktop Chrome'],
				storageState: path.join(AUTH_DIR, 'student.json'),
			},
			testMatch: 'tests/student/**/*.spec.ts',
			dependencies: ['setup-student'],
		},

		// ─── SETUP & TEARDOWN DATA API ───────────────────────────
		{
			name: 'setup-api-data',
			testMatch: 'tests/api/global.setup.ts',
			teardown: 'teardown-api-data',
			dependencies: ['setup-admin'],
		},
		{
			name: 'teardown-api-data',
			testMatch: 'tests/api/global.teardown.ts',
		},

		// ─── PROJECT API (headless, admin session) ────────────────
		{
			name: 'api',
			use: {
				baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000',
				storageState: path.join(AUTH_DIR, 'admin.json'),
				launchOptions: { slowMo: 0 },
				headless: true,
			},
			testMatch: 'tests/api/**/*.api.spec.ts',
			dependencies: ['setup-admin', 'setup-api-data'],
		},
		// {
		// 	name: 'firefox',
		// 	use: { ...devices['Desktop Firefox'] },
		// },

		// {
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] },
		// },

		/* Test against mobile viewports. */
		// {
		//   name: 'Mobile Chrome',
		//   use: { ...devices['Pixel 5'] },
		// },
		// {
		//   name: 'Mobile Safari',
		//   use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	],

	/* Run your local dev server before starting the tests */
	// webServer: {
	//   command: 'npm run start',
	//   url: 'http://localhost:3000',
	//   reuseExistingServer: !process.env.CI,
	// },
});
