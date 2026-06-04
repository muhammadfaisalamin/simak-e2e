import { test, expect } from '../fixtures/auth.fixture';

// Grup test untuk dashboard admin
test.describe('Admin Dashboard', () => {
	test('harus bisa akses halaman /admin', async ({ page }) => {
		// Buka halaman admin
		// storageState sudah diset di playwright.config.ts untuk project "admin"
		// jadi tidak perlu login — cookie sudah ada!
		await page.goto('/admin');

		// Pastikan tidak diredirect ke /sign-in
		await expect(page).not.toHaveURL(/sign-in/);

		// Pastikan URL adalah /admin
		await expect(page).toHaveURL(/\/admin/);
	});

	test('harus tampil di halaman admin setelah akses root', async ({ page }) => {
		// Akses root — middleware akan redirect ke dashboard sesuai role
		await page.goto('/');

		// Admin/Operator seharusnya diredirect ke /admin
		await expect(page).toHaveURL(/\/admin/);
	});

	test('harus bisa akses halaman daftar mahasiswa', async ({ page }) => {
		await page.goto('/list/students');

		// Pastikan tidak redirect ke login
		await expect(page).not.toHaveURL(/sign-in/);
	});

	test('harus bisa akses halaman daftar dosen', async ({ page }) => {
		await page.goto('/list/lecturers');

		await expect(page).not.toHaveURL(/sign-in/);
	});

	test('harus bisa akses halaman mata kuliah', async ({ page }) => {
		await page.goto('/list/courses');

		await expect(page).not.toHaveURL(/sign-in/);
	});
});
