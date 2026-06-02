# Tutorial: Playwright Testing dengan Bypass Login Multi Role

Tutorial ini akan memandu kamu dari nol hingga bisa menjalankan test otomatis yang melewati proses login berulang, untuk setiap role pengguna (admin/operator, lecturer, student).

---

## Daftar Isi

1. [Apa itu Playwright dan Kenapa Bypass Login?](#1-apa-itu-playwright-dan-kenapa-bypass-login)
2. [Cara Kerja Auth di Proyek Ini](#2-cara-kerja-auth-di-proyek-ini)
3. [Instalasi Playwright](#3-instalasi-playwright)
4. [Struktur Folder Test](#4-struktur-folder-test)
5. [Siapkan Akun Test di Database](#5-siapkan-akun-test-di-database)
6. [Buat File Environment untuk Test](#6-buat-file-environment-untuk-test)
7. [Global Setup: Login Satu Kali per Role](#7-global-setup-login-satu-kali-per-role)
8. [Konfigurasi Playwright (playwright.config.ts)](#8-konfigurasi-playwright-playwrightconfigts)
9. [Buat Auth Fixture](#9-buat-auth-fixture)
10. [Tulis Test untuk Tiap Role](#10-tulis-test-untuk-tiap-role)
11. [Jalankan Test](#11-jalankan-test)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Apa itu Playwright dan Kenapa Bypass Login?

**Playwright** adalah tool untuk testing otomatis aplikasi web. Playwright bisa membuka browser secara otomatis, mengklik tombol, mengisi form, dan memverifikasi tampilan halaman — persis seperti pengguna sungguhan.

### Masalah Tanpa Bypass Login

Bayangkan kamu punya 50 test case. Jika setiap test harus login dulu, berarti ada 50 kali proses login. Ini lambat dan tidak efisien.

### Solusi: Storage State (Bypass Login)

Playwright punya fitur bernama **storageState**. Cara kerjanya:

1. Login satu kali secara nyata (via browser) — ini dilakukan di **global setup**
2. Simpan **cookie session** ke sebuah file JSON
3. Semua test berikutnya tinggal "pakai" cookie itu — tanpa login ulang

Karena aplikasi ini menggunakan cookie bernama `session` untuk autentikasi, kita bisa menyimpan cookie tersebut dan menggunakannya kembali di setiap test.

---

## 2. Cara Kerja Auth di Proyek Ini

Sebelum menulis test, penting memahami bagaimana sistem login bekerja di sini.

### Alur Login

```
User isi form → server action `login()` dipanggil
→ cek email & password di database
→ buat Session di tabel sb25_sessions
→ enkripsi sessionId jadi JWT
→ simpan JWT ke cookie bernama "session"
```

### Alur Proteksi Halaman (middleware.ts)

```
Request masuk → middleware cek: apakah cookie "session" ada?
├── Tidak ada → redirect ke /sign-in
└── Ada → lanjut ke halaman yang diminta
```

### Role dan Dashboard-nya

| RoleType di DB | Dashboard yang dituju |
|---|---|
| `OPERATOR` | `/admin` |
| `LECTURER` | `/lecturer` |
| `ADVISOR` | `/lecturer` |
| `STUDENT` | `/student` |

### Mengapa Pendekatan Storage State Bekerja?

Middleware hanya mengecek **keberadaan** cookie `session`. Jika kita simpan cookie hasil login nyata ke file JSON, dan Playwright "memuatnya" sebelum test, maka middleware menganggap user sudah login — tanpa perlu login ulang.

---

## 3. Instalasi Playwright

Pastikan kamu berada di folder proyek:

```bash
cd C:\Projects\StmikBjbApplication\simak-sb
```

Jalankan perintah instalasi:

```bash
npm init playwright@latest
```

Saat ada pertanyaan interaktif, jawab seperti ini:

```
Where to put your end-to-end tests? › tests
Add a GitHub Actions workflow? › No
Install Playwright browsers? › Yes
```

> **Catatan:** Proses download browser (Chromium, Firefox, WebKit) membutuhkan waktu beberapa menit tergantung kecepatan internet.

Setelah selesai, kamu akan melihat file baru:
- `playwright.config.ts` — konfigurasi utama Playwright
- `tests/` — folder untuk menyimpan file test
- `tests-examples/` — contoh test bawaan (boleh dihapus)

---

## 4. Struktur Folder Test

Kita akan membuat struktur seperti ini:

```
simak-sb/
├── tests/
│   ├── auth/
│   │   └── global.setup.ts       ← login satu kali per role, simpan cookie
│   ├── fixtures/
│   │   └── auth.fixture.ts       ← helper untuk pakai cookie per role
│   ├── admin/
│   │   └── dashboard.spec.ts     ← test untuk role admin/operator
│   ├── lecturer/
│   │   └── dashboard.spec.ts     ← test untuk role lecturer
│   └── student/
│       └── dashboard.spec.ts     ← test untuk role student
├── .auth/                         ← folder untuk menyimpan cookie (dibuat otomatis)
│   ├── admin.json
│   ├── lecturer.json
│   └── student.json
└── playwright.config.ts
```

Buat folder-folder tersebut sekarang:

```bash
mkdir tests\auth
mkdir tests\fixtures
mkdir tests\admin
mkdir tests\lecturer
mkdir tests\student
mkdir .auth
```

---

## 5. Siapkan Akun Test di Database

Kamu perlu memiliki akun test untuk setiap role di database. Ada dua cara:

### Cara A: Gunakan Akun yang Sudah Ada

Cukup catat email dan password dari akun yang sudah ada di database untuk setiap role (OPERATOR, LECTURER, STUDENT).

### Cara B: Buat Akun Test Baru via Script

Buat file `scripts/createTestUsers.ts`:

```typescript
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function createTestUsers() {
  const hashedPassword = await bcrypt.hash('Test@12345', 10);

  // Cari roleId untuk tiap roleType
  const operatorRole = await prisma.role.findFirst({
    where: { roleType: 'OPERATOR' }
  });
  const lecturerRole = await prisma.role.findFirst({
    where: { roleType: 'LECTURER' }
  });
  const studentRole = await prisma.role.findFirst({
    where: { roleType: 'STUDENT' }
  });

  // Buat user operator/admin test
  await prisma.user.upsert({
    where: { email: 'test.admin@stmik.test' },
    update: {},
    create: {
      email: 'test.admin@stmik.test',
      password: hashedPassword,
      isStatus: true,
      roleId: operatorRole!.id,
    }
  });

  // Buat user lecturer test
  await prisma.user.upsert({
    where: { email: 'test.lecturer@stmik.test' },
    update: {},
    create: {
      email: 'test.lecturer@stmik.test',
      password: hashedPassword,
      isStatus: true,
      roleId: lecturerRole!.id,
    }
  });

  // Buat user student test
  await prisma.user.upsert({
    where: { email: 'test.student@stmik.test' },
    update: {},
    create: {
      email: 'test.student@stmik.test',
      password: hashedPassword,
      isStatus: true,
      roleId: studentRole!.id,
    }
  });

  console.log('✅ Test users berhasil dibuat!');
  await prisma.$disconnect();
}

createTestUsers().catch(console.error);
```

Jalankan script:

```bash
npx tsx scripts/createTestUsers.ts
```

> **Penting:** Akun test ini dibuat dengan `isStatus: true` agar bisa login. Jika tanpa itu, login akan gagal karena middleware cek status akun.

---

## 6. Buat File Environment untuk Test

Buat file `.env.test` di root proyek untuk menyimpan kredensial test:

```env
# URL aplikasi yang sedang berjalan (development)
TEST_BASE_URL=http://localhost:3000

# Kredensial akun test — sesuaikan dengan data di database kamu
TEST_ADMIN_EMAIL=test.admin@stmik.test
TEST_ADMIN_PASSWORD=Test@12345

TEST_LECTURER_EMAIL=test.lecturer@stmik.test
TEST_LECTURER_PASSWORD=Test@12345

TEST_STUDENT_EMAIL=test.student@stmik.test
TEST_STUDENT_PASSWORD=Test@12345
```

> **Jangan commit file `.env.test` ke git!** Tambahkan ke `.gitignore`:
> ```
> .env.test
> .auth/
> ```

---

## 7. Global Setup: Login Satu Kali per Role

File ini adalah inti dari "bypass login". Playwright akan menjalankan file ini **satu kali sebelum semua test dimulai**. Di sini kita login secara nyata untuk setiap role, lalu menyimpan cookie ke file JSON.

Buat file `tests/auth/global.setup.ts`:

```typescript
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
  roleName: string
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
  await page.click('button[type="submit"]');

  // Tunggu redirect selesai — tanda login berhasil
  // Kita tunggu URL berubah dari /sign-in ke halaman dashboard
  await page.waitForURL((url) => !url.pathname.includes('sign-in'), {
    timeout: 15000,
  });

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
    'Admin/Operator'
  );

  // Login untuk role Lecturer/Dosen
  await loginAndSave(
    process.env.TEST_LECTURER_EMAIL!,
    process.env.TEST_LECTURER_PASSWORD!,
    LECTURER_AUTH_FILE,
    'Lecturer/Dosen'
  );

  // Login untuk role Student/Mahasiswa
  await loginAndSave(
    process.env.TEST_STUDENT_EMAIL!,
    process.env.TEST_STUDENT_PASSWORD!,
    STUDENT_AUTH_FILE,
    'Student/Mahasiswa'
  );

  console.log('\n🎉 Semua role berhasil login! Test siap dijalankan.\n');
}

export default globalSetup;
```

### Penjelasan Kode Global Setup

| Bagian | Fungsi |
|---|---|
| `dotenv.config(...)` | Membaca file `.env.test` agar email/password tersedia |
| `chromium.launch()` | Membuka browser baru untuk proses login |
| `page.fill(...)` | Mengisi input form login |
| `page.waitForURL(...)` | Menunggu redirect selesai — tanda login berhasil |
| `context.storageState(...)` | Menyimpan cookie session ke file JSON |
| `browser.close()` | Menutup browser setelah selesai |

---

## 8. Konfigurasi Playwright (playwright.config.ts)

Ganti seluruh isi `playwright.config.ts` dengan konfigurasi berikut:

```typescript
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Muat environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Path ke file cookie tiap role
const AUTH_DIR = path.resolve(__dirname, '.auth');

export default defineConfig({
  // Folder tempat semua file test berada
  testDir: './tests',

  // Jalankan global setup sebelum semua test
  globalSetup: './tests/auth/global.setup.ts',

  // Jalankan test secara paralel (antar file)
  fullyParallel: true,

  // Jangan ulangi test yang gagal di CI
  forbidOnly: !!process.env.CI,

  // Jangan coba ulang test yang gagal (set 2 jika ingin retry)
  retries: 0,

  // Laporan hasil test dalam format HTML (bisa dilihat di browser)
  reporter: 'html',

  // Pengaturan global untuk semua test
  use: {
    // URL dasar aplikasi
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

    // Rekam trace saat test gagal (memudahkan debugging)
    trace: 'on-first-retry',

    // Screenshot otomatis saat test gagal
    screenshot: 'only-on-failure',
  },

  // Definisikan project (satu per role)
  projects: [
    // ─── PROJECT ADMIN/OPERATOR ───────────────────────────────
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        // Gunakan cookie hasil login admin
        storageState: path.join(AUTH_DIR, 'admin.json'),
      },
      // Hanya jalankan test di folder tests/admin/
      testMatch: 'tests/admin/**/*.spec.ts',
    },

    // ─── PROJECT LECTURER/DOSEN ───────────────────────────────
    {
      name: 'lecturer',
      use: {
        ...devices['Desktop Chrome'],
        // Gunakan cookie hasil login lecturer
        storageState: path.join(AUTH_DIR, 'lecturer.json'),
      },
      // Hanya jalankan test di folder tests/lecturer/
      testMatch: 'tests/lecturer/**/*.spec.ts',
    },

    // ─── PROJECT STUDENT/MAHASISWA ────────────────────────────
    {
      name: 'student',
      use: {
        ...devices['Desktop Chrome'],
        // Gunakan cookie hasil login student
        storageState: path.join(AUTH_DIR, 'student.json'),
      },
      // Hanya jalankan test di folder tests/student/
      testMatch: 'tests/student/**/*.spec.ts',
    },
  ],
});
```

### Penjelasan Konfigurasi

| Opsi | Artinya |
|---|---|
| `globalSetup` | File yang dijalankan satu kali sebelum semua test — tempat kita login |
| `projects` | Grup test — setiap project punya cookie berbeda (role berbeda) |
| `storageState` | File JSON berisi cookie yang akan dipakai semua test dalam project ini |
| `testMatch` | Pola path — test admin hanya di folder `tests/admin/`, dst. |

---

## 9. Buat Auth Fixture

Fixture adalah helper reusable di Playwright. Kita buat fixture untuk memudahkan penggunaan role di test.

Buat file `tests/fixtures/auth.fixture.ts`:

```typescript
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
```

---

## 10. Tulis Test untuk Tiap Role

### Test untuk Admin/Operator

Buat file `tests/admin/dashboard.spec.ts`:

```typescript
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
```

### Test untuk Lecturer/Dosen

Buat file `tests/lecturer/dashboard.spec.ts`:

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Lecturer Dashboard', () => {

  test('harus bisa akses halaman /lecturer', async ({ page }) => {
    await page.goto('/lecturer');

    // Pastikan tidak redirect ke sign-in
    await expect(page).not.toHaveURL(/sign-in/);

    // Pastikan di halaman lecturer
    await expect(page).toHaveURL(/\/lecturer/);
  });

  test('jika akses /admin, harus diredirect ke /lecturer', async ({ page }) => {
    // Lecturer tidak punya akses ke halaman admin
    // Aplikasi akan redirect ke halaman yang sesuai rolenya
    await page.goto('/admin');

    // Tunggu redirect selesai
    await page.waitForURL(/\/lecturer/, { timeout: 5000 });

    // Sekarang harus di /lecturer
    await expect(page).toHaveURL(/\/lecturer/);
  });

  test('harus bisa akses halaman jadwal', async ({ page }) => {
    await page.goto('/list/schedules');

    await expect(page).not.toHaveURL(/sign-in/);
  });
});
```

### Test untuk Student/Mahasiswa

Buat file `tests/student/dashboard.spec.ts`:

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Student Dashboard', () => {

  test('harus bisa akses halaman /student', async ({ page }) => {
    await page.goto('/student');

    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page).toHaveURL(/\/student/);
  });

  test('jika akses /admin, harus diredirect ke /student', async ({ page }) => {
    // Student tidak boleh di halaman admin
    await page.goto('/admin');

    // Tunggu redirect ke halaman student
    await page.waitForURL(/\/student/, { timeout: 5000 });

    await expect(page).toHaveURL(/\/student/);
  });

  test('harus bisa akses halaman KRS', async ({ page }) => {
    await page.goto('/list/krs');

    await expect(page).not.toHaveURL(/sign-in/);
  });

  test('harus bisa akses halaman KHS', async ({ page }) => {
    await page.goto('/list/khs');

    await expect(page).not.toHaveURL(/sign-in/);
  });
});
```

---

## 11. Jalankan Test

### Langkah 1: Pastikan Aplikasi Sedang Berjalan

Playwright butuh aplikasi berjalan. Buka terminal baru dan jalankan:

```bash
npm run dev
```

Tunggu hingga muncul:
```
▲ Next.js ready on http://localhost:3000
```

### Langkah 2: Jalankan Semua Test

Di terminal lain (tetap di folder proyek), jalankan:

```bash
npx playwright test
```

Output yang kamu lihat kurang lebih seperti ini:

```
🔐 Login sebagai Admin/Operator...
✅ Admin/Operator berhasil login, URL: http://localhost:3000/admin
💾 Cookie Admin/Operator disimpan ke: .../.auth/admin.json

🔐 Login sebagai Lecturer/Dosen...
✅ Lecturer/Dosen berhasil login, URL: http://localhost:3000/lecturer
💾 Cookie Lecturer/Dosen disimpan ke: .../.auth/lecturer.json

🔐 Login sebagai Student/Mahasiswa...
✅ Student/Mahasiswa berhasil login, URL: http://localhost:3000/student
💾 Cookie Student/Mahasiswa disimpan ke: .../.auth/student.json

🎉 Semua role berhasil login! Test siap dijalankan.

Running 10 tests using 3 workers
  ✓ [admin] › admin/dashboard.spec.ts:5 (1.2s)
  ✓ [admin] › admin/dashboard.spec.ts:13 (0.9s)
  ✓ [lecturer] › lecturer/dashboard.spec.ts:5 (1.1s)
  ...
```

### Perintah Test Lainnya

```bash
# Jalankan hanya test untuk admin
npx playwright test --project=admin

# Jalankan hanya test untuk lecturer
npx playwright test --project=lecturer

# Jalankan hanya test untuk student
npx playwright test --project=student

# Jalankan test tertentu berdasarkan nama file
npx playwright test tests/admin/dashboard.spec.ts

# Lihat hasil test di browser (laporan HTML)
npx playwright show-report

# Jalankan test dengan browser terlihat (tidak headless — berguna untuk debug)
npx playwright test --headed

# Jalankan test dalam mode debug interaktif
npx playwright test --debug
```

### Melihat Laporan Hasil Test

Setelah test selesai, jalankan:

```bash
npx playwright show-report
```

Browser akan terbuka otomatis menampilkan laporan detail: test mana yang lulus, gagal, berapa lama, lengkap dengan screenshot jika ada yang gagal.

---

## 12. Troubleshooting

### ❌ Error: "No tests were found"

**Penyebab:** Path file test tidak cocok dengan `testMatch` di config.

**Solusi:** Pastikan file test ada di folder yang benar:
- Admin → `tests/admin/*.spec.ts`
- Lecturer → `tests/lecturer/*.spec.ts`
- Student → `tests/student/*.spec.ts`

---

### ❌ Error: "username dan password salah" saat global setup

**Penyebab:** Email atau password di `.env.test` tidak sesuai dengan data di database.

**Solusi:**
1. Buka database dan cek tabel `sb25_users`
2. Pastikan email akun test ada dan `isStatus = true`
3. Cek apakah password sudah di-hash dengan bcrypt
4. Sesuaikan `.env.test` dengan data yang benar

---

### ❌ Error: "akun user tidak aktif"

**Penyebab:** Field `isStatus` di tabel `sb25_users` bernilai `false`.

**Solusi:** Update data di database:
```sql
UPDATE sb25_users SET "isStatus" = true WHERE email = 'test.admin@stmik.test';
```

---

### ❌ Test gagal dengan "Timeout waiting for URL"

**Penyebab:** Redirect setelah login tidak terjadi dalam waktu 15 detik — kemungkinan server lambat atau ada error.

**Solusi:**
1. Pastikan `npm run dev` berjalan dan tidak ada error
2. Buka `http://localhost:3000/sign-in` di browser manual, coba login
3. Jika login manual berhasil, coba naikkan timeout di global setup

---

### ❌ Error: "Cannot find module 'dotenv'"

**Penyebab:** Package `dotenv` belum terinstall.

**Solusi:**
```bash
npm install dotenv --save-dev
```

---

### ❌ File `.auth/admin.json` tidak terbuat

**Penyebab:** Folder `.auth/` belum ada.

**Solusi:**
```bash
mkdir .auth
```

---

### ❌ Test student mengakses `/admin` tapi tidak redirect ke `/student`

**Penyebab:** Aplikasi membutuhkan waktu untuk memproses redirect setelah cek session di database.

**Solusi:** Gunakan `waitForURL` dengan timeout yang cukup:
```typescript
await page.waitForURL(/\/student/, { timeout: 10000 }); // 10 detik
```

---

## Rangkuman Alur Kerja

```
npm run dev              ← jalankan aplikasi (terminal 1)
        ↓
npx playwright test      ← jalankan test (terminal 2)
        ↓
global.setup.ts dijalankan → login 3x (admin, lecturer, student)
        ↓
cookie disimpan ke .auth/admin.json, .auth/lecturer.json, .auth/student.json
        ↓
test berjalan TANPA login ulang — pakai cookie yang sudah ada
        ↓
laporan hasil test tersedia
```

---

## Tips Tambahan

### Perbarui Cookie Jika Expired

Cookie login berlaku 2 hari (sesuai `createSession` di `session.ts`). Jika sudah lebih dari 2 hari, jalankan ulang test agar global setup login ulang dan memperbarui cookie.

### Tambah Test Baru

Cukup buat file `.spec.ts` baru di folder role yang sesuai. Playwright akan otomatis menemukannya dan menggunakan cookie yang sudah tersimpan.

### Jalankan Test Tanpa Global Setup Ulang

Jika cookie belum expired dan kamu hanya ingin jalankan test (tanpa login ulang), kamu bisa skip global setup dengan cara menghapus sementara baris `globalSetup` di config. Tapi lebih baik biarkan apa adanya — jika cookie masih valid, Playwright tetap cepat.
