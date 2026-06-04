# Bypass Login dengan Project Dependencies

## Masalah pada Pendekatan `globalSetup`

Pendekatan sebelumnya menggunakan `globalSetup` di `playwright.config.ts`:

```ts
export default defineConfig({
  globalSetup: './tests/auth/global.setup.ts',
  // ...
});
```

`global.setup.ts` selalu login **semua role** tanpa terkecuali:

```ts
async function globalSetup(config: FullConfig) {
  await loginAndSave(adminEmail, adminPassword, ...);    // selalu jalan
  await loginAndSave(lecturerEmail, lecturerPassword, ...); // selalu jalan
  await loginAndSave(studentEmail, studentPassword, ...);   // selalu jalan
}
```

Akibatnya, ketika hanya menjalankan test admin:
```powershell
npx playwright test tests/admin/dashboard.spec.ts
```

Program tetap login ketiga role — membuang waktu dan koneksi ke server.

---

## Solusi: Project Dependencies

Playwright punya fitur **project dependencies** — sebuah project bisa dideklarasikan sebagai prasyarat project lain. Setup login hanya berjalan jika project yang bergantung padanya dijalankan.

---

## Langkah Perubahan

### Langkah 1 — Buat File Setup Terpisah per Role

Sebelumnya satu file `global.setup.ts` menangani semua role. Sekarang dibagi menjadi tiga file terpisah di folder `tests/auth/`:

```
tests/auth/
├── admin.setup.ts      ← baru
├── lecturer.setup.ts   ← baru
├── student.setup.ts    ← baru
└── global.setup.ts     ← lama, sudah tidak dipakai
```

**Perbedaan utama dengan `global.setup.ts`:**

`global.setup.ts` menggunakan pola fungsi biasa yang diekspor:
```ts
// pola lama
async function globalSetup(config: FullConfig) { ... }
export default globalSetup;
```

File setup baru menggunakan `test` dari Playwright (pola test biasa):
```ts
// pola baru
import { test as setup } from '@playwright/test';

setup('login sebagai admin', async ({ page }) => {
  // logika login
});
```

Mengapa pakai `test`? Karena project dependencies hanya bekerja dengan file yang berisi `test()` — Playwright menjalankannya sebagai test biasa, bukan sebagai fungsi setup khusus. Keuntungannya: `page` sudah tersedia sebagai fixture, tidak perlu `chromium.launch()` dan `browser.newContext()` secara manual.

---

#### `tests/auth/admin.setup.ts`

```ts
import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const AUTH_FILE = path.resolve(__dirname, '../../.auth/admin.json');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

setup('login sebagai admin', async ({ page }) => {
  await page.goto(`${BASE_URL}/sign-in`);
  await page.waitForSelector('input#username', { timeout: 10000 });
  await page.fill('input#username', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('input#password', process.env.TEST_ADMIN_PASSWORD!);
  await page.locator('form button').click();

  await page.waitForFunction(
    () => !window.location.pathname.includes('sign-in'),
    { timeout: 15000 },
  );

  await page.context().storageState({ path: AUTH_FILE });
});
```

Hal penting:
- `test as setup` — rename `test` menjadi `setup` agar kode lebih mudah dibaca (ini hanya alias, bukan fungsi berbeda)
- `async ({ page })` — `page` didapat dari fixture Playwright, tidak perlu `chromium.launch()` manual
- `page.context().storageState()` — mengambil context dari `page` yang sudah ada, bukan dari variabel `context` terpisah

File `lecturer.setup.ts` dan `student.setup.ts` mengikuti pola yang sama, hanya beda variabel email, password, dan path file cookie.

---

### Langkah 2 — Ubah `playwright.config.ts`

#### Hapus `globalSetup`

```ts
// SEBELUM
export default defineConfig({
  globalSetup: './tests/auth/global.setup.ts',  // ← hapus baris ini
  // ...
});

// SESUDAH
export default defineConfig({
  // tidak ada globalSetup
  // ...
});
```

---

#### Tambah Setup Projects dan `dependencies`

```ts
// SEBELUM
projects: [
  {
    name: 'admin',
    use: {
      ...devices['Desktop Chrome'],
      storageState: path.join(AUTH_DIR, 'admin.json'),
    },
    testMatch: 'tests/admin/**/*.spec.ts',
    // tidak ada dependencies
  },
  // ...
]

// SESUDAH
projects: [
  // ── BAGIAN 1: Setup projects (login per role) ──
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

  // ── BAGIAN 2: Test projects (bergantung pada setup) ──
  {
    name: 'admin',
    use: {
      ...devices['Desktop Chrome'],
      storageState: path.join(AUTH_DIR, 'admin.json'),
    },
    testMatch: 'tests/admin/**/*.spec.ts',
    dependencies: ['setup-admin'],  // ← jalankan setup-admin dulu
  },
  {
    name: 'lecturer',
    use: {
      ...devices['Desktop Chrome'],
      storageState: path.join(AUTH_DIR, 'lecturer.json'),
    },
    testMatch: 'tests/lecturer/**/*.spec.ts',
    dependencies: ['setup-lecturer'],
  },
  {
    name: 'student',
    use: {
      ...devices['Desktop Chrome'],
      storageState: path.join(AUTH_DIR, 'student.json'),
    },
    testMatch: 'tests/student/**/*.spec.ts',
    dependencies: ['setup-student'],
  },
]
```

---

## Bagaimana `dependencies` Bekerja

```
npx playwright test tests/admin/dashboard.spec.ts
         │
         ▼
Playwright baca config → project 'admin' cocok dengan file ini
         │
         ▼
Cek dependencies: ['setup-admin']
         │
         ▼
Jalankan setup-admin (admin.setup.ts) → login admin → simpan admin.json
         │
         ▼
Jalankan test admin dengan storageState: admin.json
```

`setup-lecturer` dan `setup-student` **tidak dijalankan** karena tidak ada project yang bergantung padanya dalam skenario ini.

---

## Perbandingan Perilaku

| Perintah | globalSetup (lama) | Project Dependencies (baru) |
|---|---|---|
| `npx playwright test tests/admin/` | Login admin + lecturer + student | Login admin saja |
| `npx playwright test tests/lecturer/` | Login admin + lecturer + student | Login lecturer saja |
| `npx playwright test tests/student/` | Login admin + lecturer + student | Login student saja |
| `npx playwright test` (semua) | Login admin + lecturer + student | Login admin + lecturer + student |

---

## Struktur File Akhir

```
simak-e2e/
├── playwright.config.ts          ← diubah: hapus globalSetup, tambah setup projects + dependencies
├── .env.test                     ← tidak berubah
├── .auth/
│   ├── admin.json
│   ├── lecturer.json
│   └── student.json
└── tests/
    ├── auth/
    │   ├── admin.setup.ts        ← baru: setup login admin
    │   ├── lecturer.setup.ts     ← baru: setup login lecturer
    │   ├── student.setup.ts      ← baru: setup login student
    │   └── global.setup.ts       ← lama: tidak dipakai lagi
    ├── fixtures/
    │   └── auth.fixture.ts       ← tidak berubah
    ├── admin/
    │   └── dashboard.spec.ts     ← tidak berubah
    ├── lecturer/
    └── student/
```

---

## Catatan Penting

**`global.setup.ts` tidak dihapus** — dibiarkan sebagai referensi. Playwright tidak akan menjalankannya karena sudah tidak ada `globalSetup` di config dan tidak ada project yang `testMatch` ke file tersebut.

**Setup project tidak muncul di laporan HTML sebagai "test gagal"** — Playwright memperlakukan setup project secara terpisah. Jika setup gagal (login gagal), test yang bergantung padanya otomatis di-skip dengan keterangan "setup failed".
