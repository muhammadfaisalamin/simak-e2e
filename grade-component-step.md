# Tutorial Lengkap: grade-component.spec.ts dengan test.step()

Tutorial ini menjelaskan secara **bottom-up** (dari lapisan paling bawah ke atas)
dan **top-down** (dari perintah `npx playwright test` sampai assertion) bagaimana
membangun seluruh infrastruktur E2E test untuk fitur Grade Component (Komponen Nilai).

Versi ini mencakup pola **AAA (Arrange / Act / Assert)** menggunakan `test.step()`.

---

## Daftar Isi

1. [Peta File dan Hubungannya](#1-peta-file-dan-hubungannya)
2. [Bottom-Up: Bangun dari Lapisan Paling Bawah](#2-bottom-up-bangun-dari-lapisan-paling-bawah)
   - [Layer 0 – .env.test](#layer-0--envtest)
   - [Layer 1 – playwright.config.ts](#layer-1--playwrightconfigts)
   - [Layer 2 – db.ts](#layer-2--dbts)
   - [Layer 3 – grade-component.factory.ts](#layer-3--grade-componentfactoryts)
   - [Layer 4 – admin.setup.ts (Login Script)](#layer-4--adminsetupts-login-script)
   - [Layer 5 – auth.fixture.ts](#layer-5--authfixturets)
   - [Layer 6 – GradeComponentPage.ts (Page Object Model)](#layer-6--gradecomponentpagets-page-object-model)
   - [Layer 7 – grade-component.fixture.ts](#layer-7--grade-componentfixturets)
   - [Layer 8 – grade-component.spec.ts](#layer-8--grade-componentspects)
3. [Top-Down: Alur Eksekusi Lengkap](#3-top-down-alur-eksekusi-lengkap)
4. [Pola AAA dengan test.step()](#4-pola-aaa-dengan-teststep)
5. [Strategi Isolasi Data](#5-strategi-isolasi-data)
6. [Strategi Teardown (Pembersihan)](#6-strategi-teardown-pembersihan)
7. [Panduan Mengetik Ulang dari Awal](#7-panduan-mengetik-ulang-dari-awal)

---

## 1. Peta File dan Hubungannya

```
npx playwright test grade-component.spec.ts
        │
        ▼
playwright.config.ts          ← konfigurasi global (workers, slowMo, projects)
        │
        ├── tests/auth/admin.setup.ts     ← login sekali, simpan cookie ke .auth/admin.json
        │         │
        │         └── .env.test           ← TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, DATABASE_URL
        │
        └── tests/admin/courses/
                grade-component.spec.ts   ← file yang kita tulis (18 tests)
                        │
                        ├── tests/fixtures/grade-component.fixture.ts
                        │         │
                        │         ├── tests/fixtures/auth.fixture.ts
                        │         │         └── @playwright/test  (base)
                        │         │
                        │         ├── tests/admin/pages/GradeComponentPage.ts
                        │         │
                        │         └── tests/factories/grade-component.factory.ts
                        │                   │
                        │                   └── tests/factories/db.ts
                        │                             └── .env.test (DATABASE_URL)
                        │
                        └── tests/factories/grade-component.factory.ts  (createGradeComponent)
```

**Dependency order (ketika kamu mengetik ulang):**
1. `.env.test`
2. `playwright.config.ts`
3. `tests/factories/db.ts`
4. `tests/factories/grade-component.factory.ts`
5. `tests/auth/admin.setup.ts`
6. `tests/fixtures/auth.fixture.ts`
7. `tests/admin/pages/GradeComponentPage.ts`
8. `tests/fixtures/grade-component.fixture.ts`
9. `tests/admin/courses/grade-component.spec.ts`

---

## 2. Bottom-Up: Bangun dari Lapisan Paling Bawah

---

### Layer 0 – .env.test

**Lokasi:** `simak-e2e/.env.test`

File ini menyimpan semua konfigurasi sensitif yang tidak boleh di-commit ke Git.
Dua komponen yang membutuhkannya:
- `admin.setup.ts` → email & password untuk login
- `db.ts` → connection string PostgreSQL

```env
# URL aplikasi yang sedang berjalan
TEST_BASE_URL=http://localhost:3000

# Kredensial admin untuk login di browser
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=rahasia123

# Koneksi PostgreSQL untuk SQL factory (tanpa ORM)
DATABASE_URL=postgresql://user:password@localhost:5432/simak_db
```

**Mengapa dipisah dari `.env`?**
Karena test environment bisa berbeda dari development. Di CI/CD, nilai-nilai ini
diisi dari secret manager, bukan dari file.

---

### Layer 1 – playwright.config.ts

**Lokasi:** `simak-e2e/playwright.config.ts`

File ini adalah "otaknya" Playwright. Dibaca pertama kali setiap `npx playwright test` dijalankan.

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Muat .env.test ke process.env sebelum config dibaca
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const AUTH_DIR = path.resolve(__dirname, '.auth');

export default defineConfig({
  testDir: './tests',

  fullyParallel: true,    // file-file spec boleh berjalan serentak
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,             // hanya 1 browser instance sekaligus (karena slowMo)

  reporter: [
    ['html', { open: 'always' }],  // buka laporan HTML otomatis setelah selesai
    ['list'],                       // tampilkan progress di terminal
  ],

  use: {
    baseURL: 'http://localhost:3000',
    headless: false,       // tampilkan browser saat test berjalan
    launchOptions: {
      slowMo: 1000,        // setiap aksi diperlambat 1 detik (mudah diamati)
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // ── SETUP: login dulu sebelum test admin berjalan ──────────────
    {
      name: 'setup-admin',
      testMatch: 'tests/auth/admin.setup.ts',  // jalankan file ini dulu
    },

    // ── TEST PROJECT: semua spec di tests/admin/**  ────────────────
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(AUTH_DIR, 'admin.json'),  // inject cookie
      },
      testMatch: 'tests/admin/**/*.spec.ts',
      dependencies: ['setup-admin'],  // tunggu setup-admin selesai dulu
    },
  ],
});
```

**Konsep penting: `storageState`**

Ketika `admin` project berjalan, setiap browser page yang dibuka sudah dalam kondisi
*logged in* karena Playwright menginjeksi cookie dari `.auth/admin.json`. Kamu tidak
perlu login di setiap test.

**Konsep penting: `dependencies`**

`dependencies: ['setup-admin']` berarti project `admin` tidak akan mulai sebelum
`setup-admin` selesai. Ini menjamin cookie tersedia sebelum test-test berjalan.

---

### Layer 2 – db.ts

**Lokasi:** `tests/factories/db.ts`

Satu connection pool PostgreSQL yang dipakai bersama oleh semua factory.
Menggunakan library `pg` (bukan Prisma/ORM).

```typescript
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// db.ts berada di tests/factories/, sehingga .env.test ada 2 level di atas
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

/**
 * Shared pg connection pool untuk semua data factory.
 * Satu pool per worker process — Node.js bersihkan koneksi saat proses selesai.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

**Mengapa tidak pakai Prisma?**

Akses langsung ke DB via `pg` lebih cocok untuk test teardown karena:
- Tidak terikat skema Prisma yang mungkin berubah
- DELETE statement bisa menarget tabel secara eksplisit tanpa side effect ORM
- Tidak ada validasi middleware yang bisa menghalangi penghapusan data test
- Lebih deterministik — kamu tahu persis SQL apa yang dijalankan

**Install dependency:**
```bash
npm install pg
npm install --save-dev @types/pg
```

---

### Layer 3 – grade-component.factory.ts

**Lokasi:** `tests/factories/grade-component.factory.ts`

Factory berisi fungsi-fungsi untuk **membuat** dan **menghapus** data GradeComponent
langsung via SQL — tanpa melalui UI.

```typescript
import { randomUUID } from 'crypto';  // Node.js built-in, generate UUID v4
import { pool } from './db';

// Tipe return value, agar TypeScript mengetahui bentuk data
export type GradeComponentRecord = {
  id: string;
  name: string;
  acronym: string;
};

/**
 * INSERT satu baris ke sb25_grade_components.
 * Mengembalikan record lengkap termasuk ID yang baru dibuat.
 */
export async function createGradeComponent(
  name: string,
  acronym: string,
): Promise<GradeComponentRecord> {
  const id = randomUUID();  // generate UUID di sisi Node, bukan DB
  await pool.query(
    'INSERT INTO sb25_grade_components (id, name, acronym) VALUES ($1, $2, $3)',
    [id, name, acronym],
  );
  return { id, name, acronym };
}

/**
 * INSERT beberapa baris sekaligus.
 * Dipakai di assessment tests (beberapa GC sebagai komponen penilaian).
 */
export async function createGradeComponents(
  count: number,
  namePrefix: string,
  acronymPrefix: string,
): Promise<GradeComponentRecord[]> {
  const records: GradeComponentRecord[] = [];
  for (let i = 1; i <= count; i++) {
    records.push(await createGradeComponent(`${namePrefix} ${i}`, `${acronymPrefix}${i}`));
  }
  return records;
}

/**
 * Hapus GC berdasarkan nama.
 * Dipakai untuk membersihkan data yang dibuat melalui UI (ID tidak diketahui).
 * Harus hapus AssessmentDetail dulu (FK Restrict).
 */
export async function deleteGradeComponentByName(name: string): Promise<void> {
  await pool.query(
    'DELETE FROM sb25_assessments_details WHERE "gradeId" = (SELECT id FROM sb25_grade_components WHERE name = $1)',
    [name],
  );
  await pool.query(
    'DELETE FROM sb25_grade_components WHERE name = $1',
    [name],
  );
}

/**
 * Hapus GC berdasarkan ID (primary key).
 * Dipakai untuk membersihkan data yang dibuat via factory (ID diketahui).
 */
export async function deleteGradeComponentById(id: string): Promise<void> {
  await pool.query(
    'DELETE FROM sb25_assessments_details WHERE "gradeId" = $1',
    [id],
  );
  await pool.query(
    'DELETE FROM sb25_grade_components WHERE id = $1',
    [id],
  );
}
```

**Mengapa dua fungsi delete?**

| Situasi | Fungsi delete |
|---------|--------------|
| Data dibuat via **UI** (Create test) | `deleteByName` — hanya nama yang diketahui saat form diisi |
| Data dibuat via **factory** (DB-seeded tests) | `deleteById` — ID di-return oleh `createGradeComponent()` |

**Mengapa hapus AssessmentDetail dulu?**

Skema database punya constraint `FK Restrict` antara `sb25_assessments_details.gradeId`
dan `sb25_grade_components.id`. Jika ada baris AssessmentDetail yang masih mereferensi
GC, PostgreSQL akan menolak DELETE pada GC tersebut. Kita hapus child row dulu.

---

### Layer 4 – admin.setup.ts (Login Script)

**Lokasi:** `tests/auth/admin.setup.ts`

Script ini hanya dijalankan **sekali** sebelum semua test admin. Ia membuka browser,
mengisi form login, dan menyimpan cookie sesi ke file JSON.

```typescript
import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Muat .env.test — file ini berada di tests/auth/, jadi 2 level ke atas
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Path tempat cookie akan disimpan
const AUTH_FILE = path.resolve(__dirname, '../../.auth/admin.json');
const BASE_URL   = process.env.TEST_BASE_URL || 'http://localhost:3000';

setup('login sebagai admin', async ({ page }) => {
  console.log('🔐 Login sebagai Admin/Operator...');

  // 1. Buka halaman login
  await page.goto(`${BASE_URL}/sign-in`);

  // 2. Tunggu form muncul
  await page.waitForSelector('input#username', { timeout: 10000 });

  // 3. Isi kredensial dari .env.test
  await page.fill('input#username', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('input#password', process.env.TEST_ADMIN_PASSWORD!);

  // 4. Klik tombol submit
  await page.locator('form button').click();

  // 5. Tunggu redirect (URL tidak lagi mengandung 'sign-in')
  await page.waitForFunction(
    () => !window.location.pathname.includes('sign-in'),
    { timeout: 15000 },
  );

  console.log(`✅ Admin berhasil login, URL: ${page.url()}`);

  // 6. Simpan seluruh state browser (cookie + localStorage) ke file JSON
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`💾 Cookie Admin disimpan ke: ${AUTH_FILE}`);
});
```

**Apa itu storageState?**

`page.context().storageState({ path })` mengekspor semua cookie dan localStorage
dari browser session saat ini ke file JSON. Isinya kira-kira:

```json
{
  "cookies": [
    {
      "name": "next-auth.session-token",
      "value": "eyJhbGci...",
      "domain": "localhost",
      "path": "/"
    }
  ],
  "origins": []
}
```

Ketika test berjalan berikutnya, Playwright membaca file ini dan memasukkan cookie
tersebut ke browser baru — seolah browser sudah login sejak awal.

**Folder `.auth/` harus di `.gitignore`:**
```
.auth/
```

---

### Layer 5 – auth.fixture.ts

**Lokasi:** `tests/fixtures/auth.fixture.ts`

Lapisan tipis yang hanya memperpanjang `base` Playwright. Saat ini belum menambahkan
fixture baru, tetapi menjadi **titik ekstensi** yang dipakai fixture-fixture lain.

```typescript
import { test as base, expect } from '@playwright/test';
import * as path from 'path';

type AuthFixtures = {
  // Kosong saat ini — storageState sudah diatur di playwright.config.ts
};

// Export test yang sudah diperluas (meski belum ada tambahan)
export const test = base.extend<AuthFixtures>({});
export { expect };

// Helper path untuk file cookie tiap role
export const AUTH_PATHS = {
  admin:    path.resolve(__dirname, '../../.auth/admin.json'),
  lecturer: path.resolve(__dirname, '../../.auth/lecturer.json'),
  student:  path.resolve(__dirname, '../../.auth/student.json'),
};
```

**Mengapa ada file ini jika kosong?**

Untuk **separation of concerns**. Di masa depan, jika perlu menambahkan helper
autentikasi (misalnya fungsi `loginAs(role)`), kamu cukup menambahkan di sini
tanpa mengubah semua fixture yang sudah ada. Semua fixture auth-aware mengimpor
dari sini, bukan langsung dari `@playwright/test`.

---

### Layer 6 – GradeComponentPage.ts (Page Object Model)

**Lokasi:** `tests/admin/pages/GradeComponentPage.ts`

**Page Object Model (POM)** adalah design pattern di mana semua interaksi dengan
halaman web dikapsulasi dalam sebuah class. Test tidak berinteraksi dengan HTML
secara langsung — mereka memanggil method di class ini.

**Manfaat POM:**
- Jika selector berubah (misal class CSS berubah), kamu hanya ubah di satu tempat
- Test lebih mudah dibaca: `gcPage.openCreateModal()` vs `page.locator('button:has(img[alt="icon-create"])').click()`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class GradeComponentPage {
  readonly page: Page;

  // URL statis — lebih aman daripada hard-code di setiap test
  static readonly URL = '/list/courses/grade-component';

  // ── Deklarasi semua locator sebagai property ──────────────────────────
  // Dideklarasikan di constructor agar TypeScript tahu tipenya.
  // Locator di Playwright bersifat lazy — tidak mencari elemen sampai dipakai.

  readonly pageHeading:      Locator;   // heading "Komponen Nilai"
  readonly searchInput:      Locator;   // input pencarian
  readonly modalOverlay:     Locator;   // container modal (div.fixed)
  readonly modalCloseButton: Locator;   // tombol × di pojok modal
  readonly nameInput:        Locator;   // input[name="name"] di dalam modal
  readonly acronymInput:     Locator;   // input[name="acronym"]
  readonly submitButton:     Locator;   // tombol Tambah / Ubah
  readonly inlineFormError:  Locator;   // pesan error server (form span.text-red-400)
  readonly deleteConfirmButton: Locator;
  readonly deleteWarningText:   Locator;
  readonly tableBody:        Locator;
  readonly tableRows:        Locator;

  constructor(page: Page) {
    this.page = page;

    // getByRole lebih tahan terhadap perubahan bahasa daripada locator teks
    this.pageHeading = page.getByRole('heading', { name: 'Komponen Nilai' });
    this.searchInput = page.locator('input[type="search"]');

    // div.fixed adalah container modal (full-screen overlay)
    this.modalOverlay     = page.locator('div.fixed');
    this.modalCloseButton = page.locator('div.absolute.top-4.right-4');

    // Selector berbasis atribut name — stabil karena terikat ke nama field form
    this.nameInput    = page.locator('input[name="name"]');
    this.acronymInput = page.locator('input[name="acronym"]');

    // Regex /^(Tambah|Ubah)$/ cocok untuk tombol create DAN update
    this.submitButton = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });

    // Error server-side muncul sebagai <span class="text-red-400"> di dalam <form>
    this.inlineFormError = page.locator('form span.text-red-400');

    this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });
    this.deleteWarningText   = page.getByText(/apakah anda yakin ingin menghapus/i);

    this.tableBody = page.locator('table tbody');
    this.tableRows = page.locator('table tbody tr');
  }

  // ── Navigation ────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(GradeComponentPage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
  }

  /**
   * Navigasi dengan query search yang sudah terisi di URL.
   * Dipakai setelah menyisipkan data via factory, agar row target selalu
   * ada di halaman 1 — menghindari masalah pagination.
   */
  async gotoFiltered(query: string): Promise<void> {
    await this.page.goto(
      `${GradeComponentPage.URL}?search=${encodeURIComponent(query)}`,
    );
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── Action buttons (dicari relatif terhadap baris tabel) ──────────────

  createButton(): Locator {
    return this.page.locator('button:has(img[alt="icon-create"])');
  }

  updateButtonInRow(rowName: string): Locator {
    // filter({ hasText }) memilih <tr> yang mengandung teks nama
    // locator('td:last-child ...') memastikan kita ambil tombol di kolom Actions
    // (bukan tombol duplikat di mobile-view kolom pertama)
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-update"])');
  }

  deleteButtonInRow(rowName: string): Locator {
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-delete"])');
  }

  rowByName(name: string): Locator {
    // text-is() = exact match — mencegah substring collision
    // Contoh: "Updated 123" tidak salah match dengan "Original Updated 123"
    return this.page.locator('tr').filter({
      has: this.page.locator(`h3:text-is("${name}")`),
    });
  }

  // ── Modal interactions ────────────────────────────────────────────────

  async openCreateModal(): Promise<void> {
    await this.createButton().click();
    // Tunggu nameInput muncul = modal sudah terbuka sepenuhnya
    await this.nameInput.waitFor({ state: 'visible' });
  }

  async openUpdateModal(rowName: string): Promise<void> {
    await this.updateButtonInRow(rowName).click();
    await this.nameInput.waitFor({ state: 'visible' });
  }

  async openDeleteModal(rowName: string): Promise<void> {
    await this.deleteButtonInRow(rowName).click();
    await this.deleteConfirmButton.waitFor({ state: 'visible' });
  }

  async closeModal(): Promise<void> {
    await this.modalCloseButton.click();
    // Tunggu nameInput hilang = modal sudah tertutup sepenuhnya
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  // ── Form interactions ─────────────────────────────────────────────────

  async fillName(value: string): Promise<void> {
    await this.nameInput.clear();   // bersihkan nilai lama dulu
    await this.nameInput.fill(value);
  }

  async fillAcronym(value: string): Promise<void> {
    await this.acronymInput.clear();
    await this.acronymInput.fill(value);
  }

  async fillForm(data: { name: string; acronym: string }): Promise<void> {
    await this.fillName(data.name);
    await this.fillAcronym(data.acronym);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  // ── High-level composite actions (dipakai oleh test yang lebih kompleks) ──

  async createGradeComponent(name: string, acronym: string): Promise<void> {
    await this.openCreateModal();
    await this.fillForm({ name, acronym });
    await this.submitForm();
    await this.nameInput.waitFor({ state: 'hidden' });  // tunggu modal tutup
  }

  async updateGradeComponent(
    existingName: string,
    newData: { name: string; acronym: string },
  ): Promise<void> {
    await this.openUpdateModal(existingName);
    await this.fillForm(newData);
    await this.submitForm();
    await this.nameInput.waitFor({ state: 'hidden' });
  }

  async deleteGradeComponent(rowName: string): Promise<void> {
    await this.openDeleteModal(rowName);
    await this.deleteConfirmButton.click();
    await this.deleteConfirmButton.waitFor({ state: 'hidden' });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');  // tunggu hasil muncul
  }

  // ── Assertion helpers (membungkus expect agar test lebih ekspresif) ───

  async assertRowVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).toBeVisible();
  }

  async assertRowNotVisible(name: string): Promise<void> {
    await expect(this.rowByName(name)).not.toBeVisible();
  }

  async assertModalOpen(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
  }

  async assertModalClosed(): Promise<void> {
    await expect(this.nameInput).not.toBeVisible();
  }

  async assertFieldError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async assertInlineFormError(): Promise<void> {
    await expect(this.inlineFormError).toBeVisible();
  }

  async assertTableEmpty(): Promise<void> {
    await expect(this.tableRows).toHaveCount(0);
  }
}
```

---

### Layer 7 – grade-component.fixture.ts

**Lokasi:** `tests/fixtures/grade-component.fixture.ts`

Fixture adalah **setup & teardown otomatis** yang disuntikkan ke test functions.
Playwright fixture bekerja seperti Jest `beforeEach`/`afterEach`, tetapi berbentuk
parameter fungsi — tidak perlu memanggil setup secara eksplisit.

```typescript
import { test as authTest, expect } from './auth.fixture';
import { GradeComponentPage } from '../admin/pages/GradeComponentPage';
import {
  deleteGradeComponentByName,
  deleteGradeComponentById,
} from '../factories/grade-component.factory';

/**
 * CleanupTracker: dua registry terpisah
 *
 * gcName → untuk data dibuat via UI (create form). Hanya nama yang diketahui.
 * gcId   → untuk data dibuat via factory (DB insert). ID stable, tidak berubah
 *          meski nama/akronim diupdate.
 */
type CleanupTracker = {
  gcName: (name: string) => void;
  gcId:   (id: string)   => void;
};

// Tipe yang mendefinisikan fixtures apa yang tersedia di test
type GcFixtures = {
  gcPage:          GradeComponentPage;
  trackForCleanup: CleanupTracker;
};

// authTest.extend<GcFixtures> = tambahkan fixture baru ke atas auth fixture
export const test = authTest.extend<GcFixtures>({

  // ── Fixture: gcPage ───────────────────────────────────────────────────
  // Dipanggil otomatis setiap kali test mendeklarasikan { gcPage } sebagai param
  gcPage: async ({ page }, use) => {
    const gcPage = new GradeComponentPage(page);
    await gcPage.goto();   // navigasi ke halaman sebelum test dimulai
    await use(gcPage);     // ← TITIK TEST BERJALAN (kode di bawah = teardown)
    // (tidak ada teardown untuk gcPage — hanya navigation)
  },

  // ── Fixture: trackForCleanup ──────────────────────────────────────────
  // Dipanggil otomatis setiap kali test mendeklarasikan { trackForCleanup }
  trackForCleanup: async ({}, use) => {
    const gcNames: string[] = [];  // akumulasi nama yang perlu dihapus
    const gcIds:   string[] = [];  // akumulasi ID yang perlu dihapus

    // Berikan objek tracker ke test
    await use({
      gcName: (name: string) => gcNames.push(name),
      gcId:   (id: string)   => gcIds.push(id),
    });

    // ── TEARDOWN: berjalan setelah test selesai (pass ATAU fail) ──────
    // SQL-only: tidak ada browser dependency, tidak terpengaruh slowMo
    for (const name of gcNames) {
      try { await deleteGradeComponentByName(name); } catch { /* sudah dihapus */ }
    }
    for (const id of gcIds) {
      try { await deleteGradeComponentById(id); } catch { /* sudah dihapus */ }
    }
  },
});

export { expect };
```

**Cara kerja `await use()`:**

```
Fixture mulai
    │
    ├── setup (kode SEBELUM use)
    │
    ▼
await use(value)  ← TEST BERJALAN DI SINI
    │
    ▼
teardown (kode SETELAH use)
```

Ini analog dengan:
```typescript
// Versi tanpa fixture (lebih verbose):
beforeEach(async () => { await gcPage.goto(); });
afterEach(async () => { await deleteGradeComponentById(id); });
```

**Mengapa `{}` sebagai parameter pertama di `trackForCleanup`?**

`async ({}, use)` — kurung kurawal kosong berarti fixture ini tidak bergantung
pada fixture lain (tidak butuh `page`, `browser`, dll). Playwright hanya
menyediakan `use` sebagai callback.

---

### Layer 8 – grade-component.spec.ts

**Lokasi:** `tests/admin/courses/grade-component.spec.ts`

File utama berisi 18 test case. Setiap test menggunakan pola **AAA** yang
dinyatakan eksplisit dengan `test.step()`.

```typescript
import { test, expect } from '../../fixtures/grade-component.fixture';
import { createGradeComponent } from '../../factories/grade-component.factory';

/**
 * E2E Test Suite: Grade Component (Komponen Nilai) CRUD
 *
 * Covers positive and negative scenarios.
 *
 * Data isolation strategy:
 *  - Setiap test menghasilkan ID unik dari Date.now()
 *  - CREATE tests: data diisi via UI; cleanup by name via SQL factory
 *  - READ / UPDATE / DELETE tests: data disisipkan langsung via SQL factory
 *  - trackForCleanup menghapus semua baris via SQL setelah tiap test
 *  - mode: 'parallel' — test-test sepenuhnya independen
 */

test.describe('Grade Component Management', () => {
  test.describe.configure({ mode: 'parallel' });

  // ─────────────────────────────────────────────────────────────────────────
  // POSITIVE SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Kategori 1: Page-level checks (tidak butuh data) ─────────────────

    test('should load the grade component page with the correct heading',
      async ({ gcPage }) => {
        // TIDAK ADA test.step() di sini — hanya 2 assertion, fixture sudah
        // memanggil goto(). Menambahkan step untuk test trivial seperti ini
        // menambah boilerplate tanpa manfaat.
        await expect(gcPage.pageHeading).toBeVisible();
        await expect(gcPage.page).toHaveURL(/grade-component/);
      },
    );

    test('should open the create modal with the correct form title',
      async ({ gcPage }) => {
        // Tidak ada DB seed → hanya 2 step: Act + Assert
        await test.step('Act: open create modal', async () => {
          await gcPage.openCreateModal();
        });

        await test.step('Assert: modal shows correct title and required fields', async () => {
          await expect(gcPage.page.getByText('Tambah data komponen nilai baru')).toBeVisible();
          await expect(gcPage.nameInput).toBeVisible();
          await expect(gcPage.acronymInput).toBeVisible();
          await expect(gcPage.submitButton).toBeVisible();
        });
      },
    );

    // ── Kategori 2: CREATE test (UI-driven) ───────────────────────────────

    test('should create a new grade component with valid name and acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);  // "847392" (6 digit unik)
        const name    = `Daily Task ${id}`;
        const acronym = `DT${id}`;

        // Tiga step AAA: Arrange + Act + Assert
        await test.step('Act: fill and submit create form', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name, acronym });
          await gcPage.submitForm();
          // Daftarkan untuk cleanup di sini (dalam step Act) karena ID tidak
          // diketahui — data dibuat via UI, bukan factory
          trackForCleanup.gcName(name);
        });

        await test.step('Assert: modal closes and row appears in table', async () => {
          await gcPage.assertModalClosed();
          await gcPage.gotoFiltered(name);
          await gcPage.assertRowVisible(name);
        });
      },
    );

    // ── Kategori 3: READ tests (DB-seeded) ────────────────────────────────

    test('should display the new grade component with the correct acronym in the table',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Display Test ${id}`;
        const acronym = `DP${id}`;

        // Tiga step AAA — data disisipkan via factory di Arrange
        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
          // gc.id didaftarkan di sini (dalam step) karena hanya dibutuhkan untuk cleanup
        });

        await test.step('Assert: row visible with correct name and acronym', async () => {
          await gcPage.gotoFiltered(name);
          const row = gcPage.rowByName(name);
          await expect(row).toBeVisible();
          await expect(row).toContainText(acronym);
        });
      },
    );

    test('should find a grade component when searching by name',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Weekly Quiz ${id}`;
        const acronym = `WQ${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: search by name via search box', async () => {
          await gcPage.goto();
          await gcPage.search(name);
        });

        await test.step('Assert: row appears in search results', async () => {
          await gcPage.assertRowVisible(name);
        });
      },
    );

    test('should open the update modal pre-filled with existing data',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Pre Update ${id}`;
        const acronym = `PU${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: open update modal for the seeded row', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.openUpdateModal(name);
        });

        await test.step('Assert: modal pre-filled with correct name and acronym', async () => {
          await expect(gcPage.page.getByText('Ubah data komponen nilai')).toBeVisible();
          await expect(gcPage.nameInput).toHaveValue(name);
          await expect(gcPage.acronymInput).toHaveValue(acronym);
        });
      },
    );

    // ── Kategori 4: UPDATE test (DB-seeded) ───────────────────────────────

    test('should update an existing grade component name and acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id       = Date.now().toString().slice(-6);
        const original = { name: `Original ${id}`, acronym: `ORI${id}` };
        const updated  = { name: `Updated ${id}`,  acronym: `UPD${id}` };

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(original.name, original.acronym);
          // Track by ID — stabil bahkan setelah nama diubah
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: open update modal and submit changes', async () => {
          await gcPage.gotoFiltered(original.name);
          await gcPage.updateGradeComponent(original.name, updated);
        });

        await test.step('Assert: updated name visible and original name gone', async () => {
          await gcPage.gotoFiltered(updated.name);
          await gcPage.assertRowVisible(updated.name);

          await gcPage.gotoFiltered(original.name);
          await gcPage.assertRowNotVisible(original.name);
        });
      },
    );

    // ── Kategori 5: DELETE tests (DB-seeded) ──────────────────────────────

    test('should open the delete confirmation modal with a warning message',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Del Modal ${id}`;
        const acronym = `DM${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: open delete confirmation modal', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.openDeleteModal(name);
        });

        await test.step('Assert: warning message and confirm button visible', async () => {
          await expect(gcPage.deleteWarningText).toBeVisible();
          await expect(gcPage.deleteConfirmButton).toBeVisible();
        });
      },
    );

    test('should delete a grade component and remove it from the table',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `To Delete ${id}`;
        const acronym = `TD${id}`;

        await test.step('Arrange: seed grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          // Didaftarkan sebagai safety net — SQL DELETE tidak menghasilkan error
          // jika baris sudah dihapus oleh UI (DELETE WHERE id = x AND x tidak ada = 0 rows)
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: delete grade component via UI', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.deleteGradeComponent(name);
        });

        await test.step('Assert: row no longer appears in table', async () => {
          await gcPage.gotoFiltered(name);
          await gcPage.assertRowNotVisible(name);
        });
      },
    );

    // ── Kategori 6: Modal & search (tidak butuh data) ─────────────────────

    test('should close the modal without saving when the close button is clicked',
      async ({ gcPage }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Close Modal ${id}`;
        const acronym = `CM${id}`;

        await test.step('Act: fill form then close modal without submitting', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name, acronym });
          await gcPage.closeModal();
        });

        await test.step('Assert: modal closed and data not saved to table', async () => {
          await gcPage.assertModalClosed();
          await gcPage.assertRowNotVisible(name);
        });
      },
    );

    test('should return empty search results for a non-matching query',
      async ({ gcPage }) => {
        await test.step('Act: search with a non-matching query', async () => {
          await gcPage.search('XXXXXXXXXNONEXISTENT99999');
        });

        await test.step('Assert: table shows no results', async () => {
          await gcPage.assertTableEmpty();
        });
      },
    );

  });

  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    // ── Kategori 1: Validation errors (tidak butuh data) ─────────────────

    test('should show a validation error when the name field is empty',
      async ({ gcPage }) => {
        await test.step('Act: submit form with name left empty', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillAcronym('TST');
          await gcPage.submitForm();
        });

        await test.step('Assert: name validation error shown and modal stays open', async () => {
          await gcPage.assertFieldError('Nama komponen nilai harus diisi');
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should show a validation error when the acronym field is empty',
      async ({ gcPage }) => {
        await test.step('Act: submit form with acronym left empty', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillName('Test Grade Component');
          await gcPage.submitForm();
        });

        await test.step('Assert: acronym validation error shown and modal stays open', async () => {
          await gcPage.assertFieldError('Akronim komponen nilai harus diisi');
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should show validation errors when both name and acronym fields are empty',
      async ({ gcPage }) => {
        await test.step('Act: submit form without filling any fields', async () => {
          await gcPage.openCreateModal();
          await gcPage.submitForm();
        });

        await test.step('Assert: both validation errors shown and modal stays open', async () => {
          await gcPage.assertFieldError('Nama komponen nilai harus diisi');
          await gcPage.assertFieldError('Akronim komponen nilai harus diisi');
          await gcPage.assertModalOpen();
        });
      },
    );

    // ── Kategori 2: Duplicate / conflict checks (butuh data awal) ─────────

    test('should reject a duplicate grade component name',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Duplicate Name ${id}`;
        const acronym = `DN${id}`;

        await test.step('Arrange: seed existing grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: attempt to create second entry with the same name', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name, acronym: `DNA${id}` });
          await gcPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await gcPage.assertInlineFormError();
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should reject a duplicate grade component acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Duplicate Acronym ${id}`;
        const acronym = `DA${id}`;

        await test.step('Arrange: seed existing grade component via DB factory', async () => {
          const gc = await createGradeComponent(name, acronym);
          trackForCleanup.gcId(gc.id);
        });

        await test.step('Act: attempt to create second entry with the same acronym', async () => {
          await gcPage.openCreateModal();
          await gcPage.fillForm({ name: `Duplicate Acronym Alt ${id}`, acronym });
          await gcPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await gcPage.assertInlineFormError();
          await gcPage.assertModalOpen();
        });
      },
    );

    test('should not update a grade component to a name that already exists',
      async ({ gcPage, trackForCleanup }) => {
        const id    = Date.now().toString().slice(-6);
        const nameA = `Conflict A ${id}`;
        const nameB = `Conflict B ${id}`;

        await test.step('Arrange: seed two grade components via DB factory', async () => {
          const gcA = await createGradeComponent(nameA, `CA${id}`);
          const gcB = await createGradeComponent(nameB, `CB${id}`);
          trackForCleanup.gcId(gcA.id);
          trackForCleanup.gcId(gcB.id);
        });

        await test.step('Act: attempt to rename B to A\'s existing name', async () => {
          await gcPage.gotoFiltered(nameB);
          await gcPage.openUpdateModal(nameB);
          await gcPage.fillName(nameA);
          await gcPage.submitForm();
        });

        await test.step('Assert: server rejects with inline error and modal stays open', async () => {
          await gcPage.assertInlineFormError();
          await gcPage.assertModalOpen();
        });
      },
    );

  });

});
```

---

## 3. Top-Down: Alur Eksekusi Lengkap

Berikut adalah urutan lengkap dari perintah terminal sampai assertion terakhir,
untuk satu test: `should update an existing grade component name and acronym`.

```
npx playwright test grade-component.spec.ts
          │
          ▼
1. playwright.config.ts dibaca
   - workers: 1
   - slowMo: 1000ms
   - storageState: .auth/admin.json
   - dependencies: ['setup-admin']
          │
          ▼
2. setup-admin dijalankan dulu (admin.setup.ts)
   - Buka Chrome → http://localhost:3000/sign-in
   - Fill input#username = TEST_ADMIN_EMAIL
   - Fill input#password = TEST_ADMIN_PASSWORD
   - Klik form button
   - Tunggu URL tidak ada 'sign-in'
   - Simpan cookie → .auth/admin.json
          │
          ▼
3. Project 'admin' mulai
   - Setiap test mendapat browser context baru
   - Context diinisialisasi dengan cookie dari .auth/admin.json
   - Semua halaman yang dibuka sudah dalam kondisi logged in
          │
          ▼
4. Test runner menemukan test di grade-component.spec.ts
   - test.describe.configure({ mode: 'parallel' }) → test boleh overlap
   - Tapi workers: 1 → tetap sequential dalam praktiknya
          │
          ▼
5. Test dipilih: "should update an existing grade component name and acronym"
          │
          ▼
6. Fixture resolution (Playwright menyiapkan semua fixture yang dibutuhkan test)
   
   a. trackForCleanup fixture:
      - gcNames = []  ← array kosong
      - gcIds   = []  ← array kosong
      - Buat objek { gcName: fn, gcId: fn }
      - await use(objek tersebut)  ← BERHENTI, tunggu test selesai
   
   b. gcPage fixture:
      - Ambil `page` dari Playwright (browser tab baru)
      - Browser sudah logged in (storageState di-inject)
      - new GradeComponentPage(page)  ← buat POM instance
      - await gcPage.goto()
           → page.goto('/list/courses/grade-component')
           → pageHeading.waitFor({ state: 'visible' })
      - await use(gcPage)  ← BERHENTI, tunggu test selesai
          │
          ▼
7. Test function dipanggil dengan { gcPage, trackForCleanup }

   const id           = Date.now().toString().slice(-6);  // "847392"
   const originalName = `Original 847392`;
   const updatedName  = `Updated 847392`;
          │
          ▼
8. test.step('Arrange: seed grade component via DB factory')
   
   - createGradeComponent('Original 847392', 'ORI847392')
       → randomUUID() → "a1b2c3d4-..."
       → pool.query('INSERT INTO sb25_grade_components ...')
           Koneksi ke PostgreSQL via DATABASE_URL
           INSERT INTO sb25_grade_components
             (id, name, acronym)
           VALUES
             ('a1b2c3d4-...', 'Original 847392', 'ORI847392')
       → return { id: 'a1b2c3d4-...', name: '...', acronym: '...' }
   
   - trackForCleanup.gcId('a1b2c3d4-...')
       → gcIds.push('a1b2c3d4-...')
       → gcIds = ['a1b2c3d4-...']  ← terdaftar untuk cleanup
          │
          ▼
9. test.step('Act: open update modal and submit changes')

   - gcPage.gotoFiltered('Original 847392')
       → page.goto('/list/courses/grade-component?search=Original%20847392')
       → pageHeading.waitFor({ state: 'visible' })
       → page.waitForLoadState('networkidle')
         Server merender tabel hanya dengan row 'Original 847392'
   
   - gcPage.updateGradeComponent('Original 847392', { name: 'Updated 847392', acronym: 'UPD847392' })
       → openUpdateModal('Original 847392')
            → updateButtonInRow('Original 847392').click()
                 Playwright: cari <tr> yang mengandung teks 'Original 847392',
                 lalu cari td:last-child button[img alt="icon-update"]
                 slowMo: tunda 1000ms sebelum klik
            → nameInput.waitFor({ state: 'visible' })
                 Tunggu modal muncul
       → fillForm({ name: 'Updated 847392', acronym: 'UPD847392' })
            → nameInput.clear()
            → nameInput.fill('Updated 847392')
            → acronymInput.clear()
            → acronymInput.fill('UPD847392')
       → submitForm()
            → submitButton.click()
                 Browser: submit PUT /api/grade-components/a1b2c3d4-...
                 Server: UPDATE sb25_grade_components SET name=..., acronym=... WHERE id=...
       → nameInput.waitFor({ state: 'hidden' })
                 Tunggu modal tutup (konfirmasi submit berhasil)
          │
          ▼
10. test.step('Assert: updated name visible and original name gone')

    - gcPage.gotoFiltered('Updated 847392')
        → halaman difilter, hanya row 'Updated 847392' yang muncul
    
    - gcPage.assertRowVisible('Updated 847392')
        → expect(rowByName('Updated 847392')).toBeVisible()
            rowByName mencari: locator('tr').filter({ has: locator('h3:text-is("Updated 847392")') })
            PASS ✓
    
    - gcPage.gotoFiltered('Original 847392')
        → halaman difilter dengan nama lama
    
    - gcPage.assertRowNotVisible('Original 847392')
        → expect(rowByName('Original 847392')).not.toBeVisible()
            Row tidak ada (sudah di-rename)
            PASS ✓
          │
          ▼
11. Test function selesai → Playwright kembali ke fixture teardown

    gcPage fixture teardown:
    - (tidak ada) — hanya use() yang berhenti
    
    trackForCleanup fixture teardown:
    - gcIds = ['a1b2c3d4-...']
    - deleteGradeComponentById('a1b2c3d4-...')
        → pool.query('DELETE FROM sb25_assessments_details WHERE "gradeId" = $1', [id])
        → pool.query('DELETE FROM sb25_grade_components WHERE id = $1', [id])
    - Database kembali bersih ✓
          │
          ▼
12. Test selesai: ✓ PASSED
```

---

## 4. Pola AAA dengan test.step()

### Apa itu AAA?

AAA adalah konvensi penamaan yang memisahkan sebuah test menjadi tiga bagian:

| Bagian | Tujuan | Contoh |
|--------|--------|--------|
| **Arrange** | Siapkan data prerequisite | Seed GC ke DB via factory |
| **Act** | Lakukan aksi yang sedang diuji | Klik tombol, isi form, submit |
| **Assert** | Verifikasi hasil yang diharapkan | Cek row muncul/hilang di tabel |

### Apa itu test.step()?

`test.step(label, fn)` mengelompokkan serangkaian aksi menjadi satu unit bernama.
Setiap step muncul sebagai node terpisah di laporan HTML Playwright.

**Tanpa step.step():**
```
✓ should update an existing grade component  (11.1s)
```

**Dengan test.step():**
```
✓ should update an existing grade component  (11.1s)
  ✓ Arrange: seed grade component via DB factory  (0.1s)
  ✓ Act: open update modal and submit changes  (8.9s)
  ✓ Assert: updated name visible and original name gone  (2.1s)
```

Ketika test **gagal**, Playwright menunjukkan tepat di step mana kegagalan terjadi —
sangat membantu untuk debugging tanpa harus membaca seluruh test.

### Aturan jumlah step

| Kondisi | Jumlah step | Contoh |
|---------|-------------|--------|
| Test trivial (≤ 2 assertion, tanpa data) | 0 step | `should load page` |
| Tidak ada DB seed | 2 step (Act + Assert) | validation error tests |
| Ada DB seed | 3 step (Arrange + Act + Assert) | semua DB-seeded tests |
| Arrange dan Act tidak bisa dipisah | 2 step (Act + Assert) | UI-only create test |

### Cross-step variables

Ketika data dari Arrange dibutuhkan di Act atau Assert, deklarasikan variabel
di luar step agar scope-nya mencakup semua step:

```typescript
test('...', async ({ gcPage, trackForCleanup }) => {
  const id  = Date.now().toString().slice(-6);
  let gcId  = '';   // ← deklarasi di outer scope
  const name = `Test ${id}`;

  await test.step('Arrange', async () => {
    const gc = await createGradeComponent(name, `TST${id}`);
    gcId = gc.id;                    // ← assign dari dalam step
    trackForCleanup.gcId(gcId);
  });

  await test.step('Act', async () => {
    // gcId bisa diakses di sini karena di-declare di outer scope
    console.log(`Working with ${gcId}`);
  });
});
```

**Prinsip:** Jika variabel hanya dipakai dalam satu step (misal `id` untuk cleanup),
deklarasikan di **dalam** step tersebut. Jika dipakai di step lain, deklarasikan
di **luar** semua step dengan nilai default yang aman (`''`, `[]`, dll).

---

## 5. Strategi Isolasi Data

### Problem: test pollution

Jika test A membuat data "Test GC", dan test B mencari "Test GC", hasil test B
bergantung pada test A. Ini disebut **test pollution** dan membuat test tidak reliable.

### Solusi: per-test unique ID

```typescript
const id = Date.now().toString().slice(-6);
// Date.now() = 1716789847392 (Unix timestamp dalam ms)
// .slice(-6)  = "847392"  (6 digit terakhir)

const name    = `Daily Task ${id}`;   // "Daily Task 847392"
const acronym = `DT${id}`;            // "DT847392"
```

Karena setiap test berjalan pada millisecond yang berbeda, ID-nya selalu unik.
Dua test yang berjalan di waktu yang sangat berdekatan bisa mendapat ID yang sama
jika waktu persis sama, tapi dengan `workers: 1` ini sangat kecil kemungkinannya.

### DB-seeded vs UI-created

| Strategi | Kapan dipakai | Kelebihan |
|----------|--------------|-----------|
| **UI-created** | Test CREATE | Menguji flow form secara end-to-end |
| **DB-seeded** | Test READ/UPDATE/DELETE | Cepat, tidak bergantung pada test lain |

Test READ/UPDATE/DELETE tidak perlu melalui UI create karena yang diuji adalah
fungsi read/update/delete itu sendiri, bukan create. Menyisipkan data via SQL
membuatnya **independent** — test bisa jalan meski UI create sedang broken.

---

## 6. Strategi Teardown (Pembersihan)

### Mengapa teardown penting?

Tanpa teardown, setiap test run meninggalkan data sisa di database. Setelah 100x
run, akan ada ratusan row "Daily Task 847392" yang mengotori tabel.

### Dua registry terpisah

```
trackForCleanup.gcName(name)  ← untuk data UI-created
trackForCleanup.gcId(id)      ← untuk data DB-factory-created
```

**Mengapa dipisah?**

- Data UI-created: kita hanya tahu **nama** (yang kita isi di form). ID tidak
  diketahui karena server yang menggenerate UUID.
- Data DB-factory-created: kita tahu **ID** karena factory me-return-nya.
  ID tidak berubah meski nama diupdate — lebih stabil untuk cleanup.

### Urutan teardown

```
Test selesai (pass atau fail)
        │
        ▼
for name of gcNames:
    deleteGradeComponentByName(name)
    → DELETE FROM sb25_assessments_details WHERE gradeId = (SELECT id ... WHERE name = $1)
    → DELETE FROM sb25_grade_components WHERE name = $1
        │
        ▼
for id of gcIds:
    deleteGradeComponentById(id)
    → DELETE FROM sb25_assessments_details WHERE gradeId = $1
    → DELETE FROM sb25_grade_components WHERE id = $1
```

### try/catch di teardown

```typescript
try { await deleteGradeComponentById(id); } catch { /* already gone */ }
```

`try/catch` penting karena:
- Test DELETE yang berhasil → baris sudah hilang → teardown SQL mengembalikan 0 rows → tidak error
- Test yang gagal di tengah jalan → baris mungkin sudah ada atau tidak → catch menangani kedua kasus
- Tanpa try/catch, satu teardown yang gagal akan membatalkan teardown baris-baris lain

---

## 7. Panduan Mengetik Ulang dari Awal

### Urutan pembuatan file

Ikuti urutan ini agar setiap file yang dibuat sudah memiliki dependensinya:

```
1. simak-e2e/.env.test
2. simak-e2e/playwright.config.ts
3. simak-e2e/tests/factories/db.ts
4. simak-e2e/tests/factories/grade-component.factory.ts
5. simak-e2e/tests/auth/admin.setup.ts
6. simak-e2e/tests/fixtures/auth.fixture.ts
7. simak-e2e/tests/admin/pages/GradeComponentPage.ts
8. simak-e2e/tests/fixtures/grade-component.fixture.ts
9. simak-e2e/tests/admin/courses/grade-component.spec.ts
```

### Install dependencies

```bash
npm init -y
npm install --save-dev @playwright/test
npm install pg
npm install --save-dev @types/pg
npm install dotenv
npm install --save-dev @types/node
npx playwright install chromium
```

### Buat folder struktur

```
simak-e2e/
├── .auth/               ← dibuat otomatis oleh admin.setup.ts (ada di .gitignore)
├── .env.test            ← isi kredensial
├── playwright.config.ts
├── package.json
└── tests/
    ├── admin/
    │   ├── courses/
    │   │   └── grade-component.spec.ts
    │   └── pages/
    │       └── GradeComponentPage.ts
    ├── auth/
    │   └── admin.setup.ts
    ├── factories/
    │   ├── db.ts
    │   └── grade-component.factory.ts
    └── fixtures/
        ├── auth.fixture.ts
        └── grade-component.fixture.ts
```

### .gitignore

```
.auth/
.env.test
node_modules/
playwright-report/
test-results/
```

### Menjalankan test

```bash
# Jalankan semua test
npx playwright test

# Jalankan hanya grade-component
npx playwright test tests/admin/courses/grade-component.spec.ts

# Jalankan dengan UI Playwright (mode interaktif)
npx playwright test --ui

# Lihat laporan HTML dari run terakhir
npx playwright show-report
```

### Checklist verifikasi per file

Sebelum lanjut ke file berikutnya, pastikan:

**db.ts:**
- [ ] `DATABASE_URL` ada di `.env.test`
- [ ] `npm install pg && npm install --save-dev @types/pg` sudah dijalankan
- [ ] Bisa terkoneksi: jalankan `node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT 1').then(()=>console.log('OK'))"`

**admin.setup.ts:**
- [ ] `TEST_ADMIN_EMAIL` dan `TEST_ADMIN_PASSWORD` ada di `.env.test`
- [ ] `selector input#username` sesuai dengan form login aplikasi
- [ ] Folder `.auth/` sudah ada atau dibuat otomatis

**GradeComponentPage.ts:**
- [ ] `static readonly URL` menunjuk ke URL yang benar
- [ ] Semua selector diverifikasi via browser DevTools

**grade-component.spec.ts:**
- [ ] Import path dari `../../fixtures/grade-component.fixture` sudah benar
- [ ] Import `createGradeComponent` dari `../../factories/grade-component.factory`

---

*Dibuat untuk proyek SIMAK STMIK BJB. Tutorial ini mencakup versi dengan `test.step()` (pola AAA).*
