import { test as base, expect } from '@playwright/test';
import * as path from 'path';

// Definisikan tipe untuk fixture kita
type AuthFixtures = {
	// Tidak ada fixture tambahan untuk sekarang
	// (storageState sudah diatur di playwright.config.ts per project)
};

// Export `test` dan `expect` yang sudah dikonfigurasi
export const test = base.extend<AuthFixtures>({});
export { expect };

// Helper untuk path cookie
export const AUTH_PATHS = {
	admin: path.resolve(__dirname, '../../.auth/admin.json'),
	lecturer: path.resolve(__dirname, '../../.auth/lecturer.json'),
	student: path.resolve(__dirname, '../../.auth/student.json'),
};
