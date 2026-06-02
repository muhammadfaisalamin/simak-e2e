import { test, expect } from '@playwright/test';

// test('Admin sukses login dan diarahkan ke dashboard admin', async ({
// 	page,
// }) => {
// 	// 1. Navigasi
// 	await page.goto('http://localhost:3000/sign-in');

// 	// 2. Isi Form (Gunakan locator ID agar presisi)
// 	// Kita hapus .click() karena .fill() sudah otomatis fokus ke elemen
// 	await page.locator('#username').fill('admin1@stmik.com');
// 	await page.locator('#password').fill('admin');

// 	// 3. Klik Login
// 	// Pastikan teksnya persis "Log in" (case sensitive jika tidak pakai regex)
// 	await page.getByRole('button', { name: 'Log in' }).click();

// 	// 4. Verifikasi URL (Krusial untuk aplikasi akademik)
// 	// Kita beri toleransi waktu lebih lama (10 detik) karena Next.js
// 	// mungkin butuh waktu fetch data saat pertama kali masuk dashboard.
// 	await expect(page).toHaveURL('http://localhost:3000/admin', {
// 		timeout: 10000,
// 	});

// 	// 5. Verifikasi Elemen Dashboard
// 	// Gunakan filter agar lebih spesifik mencari link dengan teks 'logo SIMAK'
// 	const logo = page.getByRole('link', { name: /logo simak/i });
// 	await expect(logo).toBeVisible();
// });

test('Admin sukses login dan diarahkan ke dashboard admin', async ({
	page,
}) => {
	// 1. Navigasi
	await page.goto('/sign-in');

	// 2. Isi Form menggunakan ID langsung (Paling Stabil untuk Case kamu)
	// Kita hapus .click() karena .fill() sudah mencakup fokus ke elemen
	await page.locator('#username').fill('admin1@stmik.com');
	await page.locator('#password').fill('admin');

	// 3. Klik Login
	await page.getByRole('button', { name: /log in/i }).click();

	// 4. Verifikasi Navigasi
	// Menunggu URL berubah menjadi /admin (Next.js routing)
	await expect(page).toHaveURL(/.*\/admin/, { timeout: 10000 });

	// 5. Verifikasi Elemen di Dashboard
	// Memastikan logo muncul sebagai tanda dashboard sudah render sempurna
	const logo = page.getByRole('link', { name: /logo simak/i });
	await expect(logo).toBeVisible();
});
