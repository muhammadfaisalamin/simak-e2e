# Tutorial: Membangun `grade-component.spec.ts` dari Nol

> Panduan ini menjelaskan **seluruh lapisan** sistem Playwright E2E — mulai dari  
> proses login, konfigurasi, database factory, fixture, Page Object Model,  
> hingga spec file — dengan pendekatan **top-down** (gambaran besar dulu)  
> sekaligus **bottom-up** (membangun dari fondasi ke atas).

---

## Daftar Isi

1. [Gambaran Besar (Top-Down)](#1-gambaran-besar-top-down)
2. [Struktur File dan Ketergantungan](#2-struktur-file-dan-ketergantungan)
3. [Cara Playwright Menjalankan Test (Alur Eksekusi)](#3-cara-playwright-menjalankan-test-alur-eksekusi)
4. [Bottom-Up: Membangun Lapis per Lapis](#4-bottom-up-membangun-lapis-per-lapis)
   - [Lapis 0 — Inisialisasi Proyek](#lapis-0--inisialisasi-proyek)
   - [Lapis 1 — Konfigurasi Lingkungan](#lapis-1--konfigurasi-lingkungan)
   - [Lapis 2 — Konfigurasi Playwright](#lapis-2--konfigurasi-playwright)
   - [Lapis 3 — Koneksi Database (db.ts)](#lapis-3--koneksi-database-dbts)
   - [Lapis 4 — Data Factory](#lapis-4--data-factory)
   - [Lapis 5 — Login Setup](#lapis-5--login-setup)
   - [Lapis 6 — Auth Fixture](#lapis-6--auth-fixture)
   - [Lapis 7 — Grade Component Fixture](#lapis-7--grade-component-fixture)
   - [Lapis 8 — Page Object Model](#lapis-8--page-object-model)
   - [Lapis 9 — Spec File (Test Cases)](#lapis-9--spec-file-test-cases)
5. [Menjalankan Test](#5-menjalankan-test)
6. [Konsep Kunci dan Pola Desain](#6-konsep-kunci-dan-pola-desain)
7. [Ringkasan Alur Data per Test](#7-ringkasan-alur-data-per-test)

---

## 1. Gambaran Besar (Top-Down)

Ketika kamu menjalankan perintah:

```bash
npx playwright test tests/admin/courses/grade-component.spec.ts
```

Playwright melakukan hal-hal ini **secara berurutan**:

```
┌─────────────────────────────────────────────────────────┐
│                   playwright.config.ts                   │
│  (mendefinisikan projects, baseURL, workers, slowMo)    │
└────────────────┬────────────────────────────────────────┘
                 │ project "admin" depends on "setup-admin"
                 ▼
┌─────────────────────────────────────────────────────────┐
│              tests/auth/admin.setup.ts                   │
│  (buka browser, buka /sign-in, isi username+password,   │
│   klik tombol login, tunggu redirect, simpan cookie     │
│   ke .auth/admin.json)                                   │
└────────────────┬────────────────────────────────────────┘
                 │ cookie sudah tersimpan
                 ▼
┌─────────────────────────────────────────────────────────┐
│         tests/admin/courses/grade-component.spec.ts      │
│  (18 test case, tiap test memanggil fixture)            │
└────────────────┬────────────────────────────────────────┘
                 │ import fixture
                 ▼
┌─────────────────────────────────────────────────────────┐
│         tests/fixtures/grade-component.fixture.ts        │
│  (menyediakan gcPage + trackForCleanup per test,        │
│   serta teardown otomatis via SQL setelah tiap test)    │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│  auth.fixture.ts     │   │  grade-component.factory.ts  │
│  (inject storageState│   │  (INSERT / DELETE SQL ke DB) │
│   = cookie admin)    │   └──────────────┬───────────────┘
└──────────────────────┘                  │
                                          ▼
                               ┌──────────────────┐
                               │     db.ts         │
                               │  (pg Pool,        │
                               │   koneksi ke DB)  │
                               └──────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│           tests/admin/pages/GradeComponentPage.ts         │
│  (Page Object Model: semua interaksi UI dikapsulasi di   │
│   sini — goto, klik tombol, isi form, assert hasil)      │
└──────────────────────────────────────────────────────────┘
```

**Tiga lapisan utama yang harus dipahami:**

| Lapisan | File | Tanggung Jawab |
|---------|------|----------------|
| **Infrastruktur** | `playwright.config.ts`, `.env.test`, `admin.setup.ts` | Konfigurasi dan login |
| **Data** | `db.ts`, `grade-component.factory.ts`, `grade-component.fixture.ts` | Seed + teardown data test |
| **UI** | `GradeComponentPage.ts`, `grade-component.spec.ts` | Interaksi browser + assertion |

---

## 2. Struktur File dan Ketergantungan

```
simak-e2e/
│
├── playwright.config.ts              ← Konfigurasi utama Playwright
├── .env.test                         ← Variabel lingkungan (URL, DB, kredensial)
│
├── .auth/
│   └── admin.json                    ← Cookie sesi admin (dibuat saat setup)
│
└── tests/
    ├── auth/
    │   └── admin.setup.ts            ← Script login admin (berjalan sekali)
    │
    ├── fixtures/
    │   ├── auth.fixture.ts           ← Fixture dasar (re-export test dengan cookie)
    │   └── grade-component.fixture.ts← Fixture spesifik GC (gcPage + cleanup)
    │
    ├── factories/
    │   ├── db.ts                     ← Pool koneksi PostgreSQL
    │   └── grade-component.factory.ts← Fungsi INSERT/DELETE langsung ke DB
    │
    └── admin/
        ├── pages/
        │   └── GradeComponentPage.ts ← Page Object Model (semua interaksi UI)
        └── courses/
            └── grade-component.spec.ts ← Test cases (18 test)
```

**Rantai `import` (siapa memanggil siapa):**

```
grade-component.spec.ts
    └── import dari grade-component.fixture.ts
            └── import dari auth.fixture.ts
            └── import dari GradeComponentPage.ts
            └── import dari grade-component.factory.ts
                    └── import dari db.ts
```

---

## 3. Cara Playwright Menjalankan Test (Alur Eksekusi)

### Fase 1: Setup (Berjalan Sekali)

```
npx playwright test
    ↓
Playwright membaca playwright.config.ts
    ↓
Project "admin" memiliki dependencies: ["setup-admin"]
    ↓
Playwright menjalankan admin.setup.ts DULU
    ↓
admin.setup.ts: buka browser → buka /sign-in → isi form → klik submit
    ↓
Tunggu URL bukan /sign-in lagi (redirect ke /admin)
    ↓
Simpan seluruh storage state (cookies, localStorage) ke .auth/admin.json
```

### Fase 2: Test Execution (Per Test)

Untuk **setiap test** di grade-component.spec.ts:

```
Playwright buat konteks browser baru
    ↓
Load storageState dari .auth/admin.json (inject cookie)
    ↓
Jalankan fixture "trackForCleanup":
    → Buat array kosong: gcNames[], gcIds[]
    → Panggil await use({gcName, gcId}) — test MULAI di sini
        ↓
    [TEST BERJALAN]
        ↓
    → Kode setelah use() dijalankan (TEARDOWN):
        → Hapus semua GC via SQL (deleteGradeComponentByName / deleteGradeComponentById)
    ↓
Jalankan fixture "gcPage":
    → Buat instance GradeComponentPage(page)
    → Panggil await gcPage.goto() — navigasi ke halaman
    → Panggil await use(gcPage) — test memakai gcPage
    ↓
Browser ditutup
```

### Kenapa Cookie Sudah Ada?

Karena `storageState: path.join(AUTH_DIR, 'admin.json')` di config membuat Playwright
**menyuntikkan cookie** ke browser baru sebelum test berjalan. Jadi halaman
`/list/courses/grade-component` langsung terbuka tanpa perlu login ulang.

---

## 4. Bottom-Up: Membangun Lapis per Lapis

---

### Lapis 0 — Inisialisasi Proyek

**Buat folder dan inisialisasi npm:**

```bash
mkdir simak-e2e
cd simak-e2e
npm init -y
```

**Install dependensi:**

```bash
npm install --save-dev @playwright/test @types/node @types/pg dotenv tsx
npm install pg
npx playwright install chromium
```

**Buat folder struktur:**

```bash
mkdir -p tests/auth tests/fixtures tests/factories tests/admin/pages tests/admin/courses .auth
```

---

### Lapis 1 — Konfigurasi Lingkungan

**File: `.env.test`**

File ini menyimpan semua nilai yang **berbeda antar lingkungan** (development vs production).
Jangan pernah commit file ini ke git jika berisi password asli.

```dotenv
# URL aplikasi yang sedang berjalan (development)
TEST_BASE_URL=http://localhost:3000

# Koneksi database langsung — dipakai oleh data factory (bukan melalui UI)
DATABASE_URL=postgresql://user:password@localhost:5433/simakdb

# Kredensial akun test — sesuaikan dengan data di database kamu
TEST_ADMIN_EMAIL=admin1@stmik.com
TEST_ADMIN_PASSWORD=admin
```

**Mengapa butuh `DATABASE_URL`?**

Karena kita akan menulis data factory yang berkomunikasi **langsung ke PostgreSQL**
(bukan melalui UI). Ini membuat test lebih cepat dan teardown lebih andal — tidak
terpengaruh oleh `slowMo` atau timing UI.

---

### Lapis 2 — Konfigurasi Playwright

**File: `playwright.config.ts`**

Ini adalah otak dari keseluruhan sistem. Playwright membaca file ini pertama kali.

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Muat .env.test agar process.env.* tersedia
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const AUTH_DIR = path.resolve(__dirname, '.auth');

export default defineConfig({
  testDir: './tests',

  // Semua spec file berjalan parallel (antar file)
  fullyParallel: true,

  // Hanya 1 worker — test di-queue satu per satu di level worker
  workers: 1,

  reporter: [
    ['html', { open: 'always' }], // Buka laporan HTML setelah selesai
    ['list'],                      // Progress di terminal
  ],

  use: {
    baseURL: 'http://localhost:3000',
    headless: false,               // Tampilkan browser (set true untuk CI)
    launchOptions: {
      slowMo: 1000,                // Perlambat 1 detik tiap aksi (mudah dipantau)
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // ── Setup Projects: berjalan SEBELUM project utama ─────────────
    {
      name: 'setup-admin',
      testMatch: 'tests/auth/admin.setup.ts',
    },

    // ── Project Utama: berjalan SETELAH setup-admin ─────────────────
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        // Ini yang membuat browser langsung "sudah login":
        // Playwright inject cookie dari admin.json ke browser baru
        storageState: path.join(AUTH_DIR, 'admin.json'),
      },
      testMatch: 'tests/admin/**/*.spec.ts',
      dependencies: ['setup-admin'], // ← Tunggu setup-admin selesai dulu
    },
  ],
});
```

**Poin kritis di sini:**

- `dependencies: ['setup-admin']` — project admin tidak berjalan sampai `setup-admin` selesai
- `storageState: path.join(AUTH_DIR, 'admin.json')` — setiap test dapat sesi login tanpa login manual
- `workers: 1` — meski `mode: 'parallel'` di spec, semua test di-queue ke 1 worker (browser instance)

---

### Lapis 3 — Koneksi Database (db.ts)

**File: `tests/factories/db.ts`**

Ini adalah satu-satunya tempat kita membuat koneksi ke PostgreSQL.
Semua factory berbagi pool koneksi yang sama.

```typescript
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Pastikan .env.test dimuat meski file ini dipanggil dari path berbeda
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

/**
 * Shared pg connection pool untuk semua data factory.
 * Satu pool per worker process — Node.js membersihkan koneksi saat proses keluar.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

**Mengapa pakai `Pool` dan bukan `Client`?**

`Pool` mengelola banyak koneksi sekaligus dan dapat di-reuse antar query.
Dalam skenario parallel, banyak test bisa query bersamaan — `Pool` handles ini
secara otomatis.

**Mengapa `dotenv.config` dipanggil lagi di sini?**

Karena `db.ts` bisa dipanggil dari file yang berbeda-beda. Memanggil `dotenv.config`
berkali-kali aman (tidak menimpa nilai yang sudah ada).

---

### Lapis 4 — Data Factory

**File: `tests/factories/grade-component.factory.ts`**

Factory adalah kumpulan fungsi yang berinteraksi **langsung dengan database** untuk:
- Membuat data prasyarat sebelum test UI berjalan
- Menghapus data setelah test selesai (teardown)

```typescript
import { randomUUID } from 'crypto';
import { pool } from './db';

// ── Tipe data ──────────────────────────────────────────────────────────────

export type GradeComponentRecord = {
  id: string;
  name: string;
  acronym: string;
};

// ── CREATE ─────────────────────────────────────────────────────────────────

/**
 * Sisipkan satu GradeComponent langsung ke database.
 * Mengembalikan record termasuk UUID yang dibuat agar pemanggil bisa
 * menyimpannya untuk teardown via deleteGradeComponentById.
 */
export async function createGradeComponent(
  name: string,
  acronym: string,
): Promise<GradeComponentRecord> {
  const id = randomUUID();    // buat UUID sendiri — tidak bergantung DB default
  await pool.query(
    'INSERT INTO sb25_grade_components (id, name, acronym) VALUES ($1, $2, $3)',
    [id, name, acronym],
  );
  return { id, name, acronym };
}

/**
 * Sisipkan N GradeComponent sekaligus. Berguna untuk test multi-komponen.
 * Nama: "${namePrefix} 1", "${namePrefix} 2", …
 * Akronim: "${acronymPrefix}1", "${acronymPrefix}2", …
 */
export async function createGradeComponents(
  count: number,
  namePrefix: string,
  acronymPrefix: string,
): Promise<GradeComponentRecord[]> {
  const records: GradeComponentRecord[] = [];
  for (let i = 1; i <= count; i++) {
    records.push(
      await createGradeComponent(`${namePrefix} ${i}`, `${acronymPrefix}${i}`),
    );
  }
  return records;
}

// ── DELETE ─────────────────────────────────────────────────────────────────

/**
 * Hapus GradeComponent berdasarkan nama.
 * Dipakai untuk GC yang dibuat melalui UI (hanya nama yang diketahui saat cleanup).
 *
 * PENTING: sb25_assessments_details.gradeId punya onDelete: Restrict,
 * jadi detail assessment yang merujuk GC ini harus dihapus dulu.
 */
export async function deleteGradeComponentByName(name: string): Promise<void> {
  await pool.query(
    `DELETE FROM sb25_assessments_details
     WHERE "gradeId" = (SELECT id FROM sb25_grade_components WHERE name = $1)`,
    [name],
  );
  await pool.query(
    'DELETE FROM sb25_grade_components WHERE name = $1',
    [name],
  );
}

/**
 * Hapus GradeComponent berdasarkan ID-nya.
 * Lebih stabil untuk GC yang dibuat via factory — ID tidak berubah meski name diupdate.
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

**Pola penting di sini:**

1. **Buat UUID sendiri** (`randomUUID()`) — bukan `DEFAULT gen_random_uuid()`.
   Ini agar kita tahu ID-nya sebelum INSERT selesai, langsung bisa dikembalikan.

2. **Hapus detail dulu, baru induk** — karena `onDelete: Restrict` di foreign key.
   Kalau urutan terbalik, PostgreSQL akan error "violates foreign key constraint".

3. **Dua varian delete** — `ByName` untuk data yang dibuat UI (kita hanya tahu nama),
   `ById` untuk data yang dibuat factory (kita tahu ID-nya).

---

### Lapis 5 — Login Setup

**File: `tests/auth/admin.setup.ts`**

File ini **bukan spec test** — ini adalah "setup project" yang berjalan sekali
sebelum semua test admin. Tujuannya: login dan simpan cookie.

```typescript
import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Path tempat cookie akan disimpan
const AUTH_FILE = path.resolve(__dirname, '../../.auth/admin.json');
const BASE_URL  = process.env.TEST_BASE_URL || 'http://localhost:3000';

setup('login sebagai admin', async ({ page }) => {
  console.log('🔐 Login sebagai Admin/Operator...');

  // 1. Buka halaman login
  await page.goto(`${BASE_URL}/sign-in`);

  // 2. Tunggu form muncul (timeout 10 detik)
  await page.waitForSelector('input#username', { timeout: 10000 });

  // 3. Isi form login
  await page.fill('input#username', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('input#password', process.env.TEST_ADMIN_PASSWORD!);

  // 4. Klik tombol submit
  await page.locator('form button').click();

  // 5. Tunggu redirect keluar dari /sign-in (max 15 detik)
  await page.waitForFunction(
    () => !window.location.pathname.includes('sign-in'),
    { timeout: 15000 },
  );

  console.log(`✅ Admin berhasil login, URL: ${page.url()}`);

  // 6. Simpan seluruh storage state (cookies + localStorage) ke file JSON
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`💾 Cookie Admin disimpan ke: ${AUTH_FILE}`);
});
```

**Isi `.auth/admin.json` setelah setup:**

```json
{
  "cookies": [
    {
      "name": "session",
      "value": "eyJhbGci...",
      "domain": "localhost",
      "path": "/",
      ...
    }
  ],
  "origins": []
}
```

**Mengapa tidak login di setiap test?**

Login via UI memakan waktu 3-5 detik. Dengan 18 test, total waktu ekstra = 54-90 detik.
Dengan menyimpan cookie sekali, semua test bisa langsung memakai sesi yang sama.

---

### Lapis 6 — Auth Fixture

**File: `tests/fixtures/auth.fixture.ts`**

File ini adalah jembatan antara `@playwright/test` standar dan sistem fixture kita.
Saat ini belum menambah fixture baru, tapi menjadi base untuk fixture-fixture lain.

```typescript
import { test as base, expect } from '@playwright/test';
import * as path from 'path';

type AuthFixtures = {
  // Akan diisi fixture tambahan di masa depan
};

// Export `test` yang sudah dikonfigurasi sebagai basis
export const test = base.extend<AuthFixtures>({});
export { expect };

// Path helper untuk cookie tiap role
export const AUTH_PATHS = {
  admin:    path.resolve(__dirname, '../../.auth/admin.json'),
  lecturer: path.resolve(__dirname, '../../.auth/lecturer.json'),
  student:  path.resolve(__dirname, '../../.auth/student.json'),
};
```

**Mengapa ada file ini jika hampir kosong?**

Ini adalah titik ekstensi. Fixture lain akan meng-`extend` dari `authTest` ini,
bukan dari `base` langsung. Jika suatu saat kita perlu menambah logic di level auth
(misalnya re-login otomatis jika sesi expired), cukup ubah file ini — semua fixture
turunannya otomatis mendapat fitur baru.

---

### Lapis 7 — Grade Component Fixture

**File: `tests/fixtures/grade-component.fixture.ts`**

Ini adalah komponen terpenting dalam arsitektur ini. Fixture menyediakan
dua hal per test:
1. `gcPage` — instance `GradeComponentPage` yang sudah di-goto
2. `trackForCleanup` — objek untuk mendaftarkan data yang perlu dihapus

```typescript
import { test as authTest, expect } from './auth.fixture';
import { GradeComponentPage } from '../admin/pages/GradeComponentPage';
import {
  deleteGradeComponentByName,
  deleteGradeComponentById,
} from '../factories/grade-component.factory';

// ── Tipe CleanupTracker ────────────────────────────────────────────────────

/**
 * Dua registry terpisah:
 *   gcName → untuk GC yang dibuat via UI (hanya nama yang diketahui saat cleanup)
 *   gcId   → untuk GC yang dibuat via DB factory (ID lebih stabil dari nama)
 */
type CleanupTracker = {
  gcName: (name: string) => void;
  gcId:   (id: string)   => void;
};

type GCFixtures = {
  gcPage:          GradeComponentPage;
  trackForCleanup: CleanupTracker;
};

// ── Ekstensi fixture ───────────────────────────────────────────────────────

export const test = authTest.extend<GCFixtures>({

  // Fixture "gcPage": buat halaman, navigasi, serahkan ke test, lalu tutup
  gcPage: async ({ page }, use) => {
    const gcPage = new GradeComponentPage(page);
    await gcPage.goto();   // navigasi ke /list/courses/grade-component
    await use(gcPage);     // ← test berjalan di sini
    // tidak ada teardown untuk gcPage — browser ditutup oleh Playwright
  },

  // Fixture "trackForCleanup": daftar data, serahkan ke test, hapus semua setelah test
  trackForCleanup: async ({}, use) => {  // {} = tidak butuh fixture lain
    const gcNames: string[] = [];  // nama GC yang dibuat via UI
    const gcIds:   string[] = [];  // ID GC yang dibuat via factory

    // Serahkan objek tracker ke test
    await use({
      gcName: (name: string) => gcNames.push(name),
      gcId:   (id: string)   => gcIds.push(id),
    });

    // ── Teardown: kode DI BAWAH use() berjalan setelah test selesai ──────
    // (baik test pass MAUPUN fail — ini yang membuat data selalu bersih)

    // Hapus GC yang dibuat via UI (by name)
    for (const name of gcNames) {
      try {
        await deleteGradeComponentByName(name);
      } catch {
        // sudah terhapus — tidak apa-apa
      }
    }

    // Hapus GC yang dibuat via factory (by ID)
    for (const id of gcIds) {
      try {
        await deleteGradeComponentById(id);
      } catch {
        // sudah terhapus — tidak apa-apa
      }
    }
  },
});

export { expect };
```

**Pola `await use(...)` — Inilah Inti Fixture Playwright:**

```
fixture berjalan
    │
    ├── setup (sebelum use)
    │       gcPage = new GradeComponentPage(page)
    │       gcPage.goto()
    │
    ├── await use(gcPage)  ← TEST BERJALAN DI SINI
    │       (test memakai gcPage)
    │
    └── teardown (setelah use)
            (tidak ada untuk gcPage)
```

```
fixture berjalan
    │
    ├── setup (sebelum use)
    │       gcNames = []
    │       gcIds   = []
    │
    ├── await use({ gcName, gcId })  ← TEST BERJALAN DI SINI
    │       test.gcName('Daily Task 123') → push ke gcNames
    │       test.gcId('uuid-xxx')        → push ke gcIds
    │
    └── teardown (setelah use)
            for name of gcNames: deleteGradeComponentByName(name)
            for id   of gcIds:   deleteGradeComponentById(id)
```

**Mengapa teardown via SQL bukan via UI?**

`playwright.config.ts` menggunakan `slowMo: 1000` — setiap aksi diperlambat 1 detik.
Teardown via UI berarti: buka halaman + search + klik hapus = ~10 aksi = 10+ detik **per test**.
Jika test gagal di tengah jalan, UI bisa dalam keadaan tak terduga dan teardown UI gagal silently.

SQL teardown: satu `pool.query()` = selesai dalam millisecond, tidak terpengaruh UI sama sekali.

---

### Lapis 8 — Page Object Model

**File: `tests/admin/pages/GradeComponentPage.ts`**

Page Object Model (POM) adalah pola desain yang **mengkapsulasi semua interaksi
dengan satu halaman UI** ke dalam satu kelas. Spec file tidak boleh tahu detail
selector HTML — semuanya ada di sini.

```typescript
import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model untuk halaman manajemen Grade Component (Komponen Nilai).
 * URL: /list/courses/grade-component
 *
 * Semua locator dan metode interaksi UI dikumpulkan di sini.
 * Spec file hanya memanggil method seperti gcPage.openCreateModal(),
 * tidak perlu tahu selector-nya.
 */
export class GradeComponentPage {
  readonly page: Page;
  static readonly URL = '/list/courses/grade-component';

  // ── Locator: elemen yang sering dipakai ──────────────────────────────────
  readonly pageHeading:         Locator;
  readonly searchInput:         Locator;
  readonly modalCloseButton:    Locator;
  readonly nameInput:           Locator;
  readonly acronymInput:        Locator;
  readonly submitButton:        Locator;
  readonly inlineFormError:     Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteWarningText:   Locator;
  readonly tableRows:           Locator;

  constructor(page: Page) {
    this.page = page;

    // Heading halaman
    this.pageHeading         = page.getByRole('heading', { name: 'Komponen Nilai' });

    // Input pencarian
    this.searchInput         = page.locator('input[type="search"]');

    // Tombol X penutup modal (pojok kanan atas modal)
    this.modalCloseButton    = page.locator('div.absolute.top-4.right-4');

    // Input di form (hanya muncul saat modal terbuka)
    this.nameInput           = page.locator('input[name="name"]');
    this.acronymInput        = page.locator('input[name="acronym"]');

    // Tombol submit form — regex: tepat "Tambah" atau "Ubah" saja
    this.submitButton        = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });

    // Error inline dari server (bawah form)
    this.inlineFormError     = page.locator('form span.text-red-400');

    // Konfirmasi hapus
    this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });
    this.deleteWarningText   = page.getByText(/apakah anda yakin ingin menghapus/i);

    // Baris tabel (untuk mengecek jumlah baris)
    this.tableRows           = page.locator('table tbody tr');
  }

  // ── Navigasi ───────────────────────────────────────────────────────────────

  /** Buka halaman, tunggu heading muncul */
  async goto(): Promise<void> {
    await this.page.goto(GradeComponentPage.URL);
    await this.pageHeading.waitFor({ state: 'visible' });
  }

  /**
   * Buka halaman dengan search query sudah terisi di URL.
   * Lebih cepat dari goto() + search() karena tidak menunggu loading penuh.
   */
  async gotoFiltered(query: string): Promise<void> {
    await this.page.goto(
      `${GradeComponentPage.URL}?search=${encodeURIComponent(query)}`,
    );
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  // ── Locator dinamis (bergantung pada parameter) ───────────────────────────

  /** Baris tabel yang mengandung nama tertentu (via h3 element) */
  rowByName(name: string): Locator {
    return this.page.locator('tr').filter({
      has: this.page.locator(`h3:text-is("${name}")`),
    });
  }

  /** Tombol buat (ikon +) */
  createButton(): Locator {
    return this.page.locator('button:has(img[alt="icon-create"])');
  }

  /** Tombol edit di kolom Actions baris tertentu */
  updateButtonInRow(rowName: string): Locator {
    // td:last-child — cegah klik tombol mobile-view yang ada di td pertama
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-update"])');
  }

  /** Tombol hapus di kolom Actions baris tertentu */
  deleteButtonInRow(rowName: string): Locator {
    return this.page
      .locator('tr')
      .filter({ hasText: rowName })
      .locator('td:last-child button:has(img[alt="icon-delete"])');
  }

  // ── Interaksi Modal ───────────────────────────────────────────────────────

  async openCreateModal(): Promise<void> {
    await this.createButton().click();
    await this.nameInput.waitFor({ state: 'visible' }); // tunggu modal terbuka
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
    await this.nameInput.waitFor({ state: 'hidden' }); // tunggu modal benar-benar tutup
  }

  // ── Interaksi Form ────────────────────────────────────────────────────────

  async fillName(value: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(value);
  }

  async fillAcronym(value: string): Promise<void> {
    await this.acronymInput.clear();
    await this.acronymInput.fill(value);
  }

  async fillForm(opts: { name: string; acronym: string }): Promise<void> {
    await this.fillName(opts.name);
    await this.fillAcronym(opts.acronym);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  // ── Aksi Komposit (gabungan beberapa langkah) ─────────────────────────────

  async updateGradeComponent(
    rowName: string,
    updated: { name: string; acronym: string },
  ): Promise<void> {
    await this.openUpdateModal(rowName);
    await this.fillForm(updated);
    await this.submitForm();
    await this.assertModalClosed();
  }

  async deleteGradeComponent(rowName: string): Promise<void> {
    await this.openDeleteModal(rowName);
    await this.deleteConfirmButton.click();
    await this.deleteConfirmButton.waitFor({ state: 'hidden' });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Assertions ────────────────────────────────────────────────────────────

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

  /**
   * Cari pesan error field-level. Pakai .first() agar tidak gagal
   * ketika pesan yang sama muncul lebih dari sekali.
   */
  async assertFieldError(message: string): Promise<void> {
    await expect(this.page.getByText(message).first()).toBeVisible();
  }

  async assertInlineFormError(): Promise<void> {
    await expect(this.inlineFormError).toBeVisible();
  }

  async assertTableEmpty(): Promise<void> {
    await expect(this.tableRows).toHaveCount(0);
  }
}
```

**Mengapa semua locator didefinisikan di constructor?**

Locator di Playwright bersifat *lazy* — mereka tidak mencari elemen DOM sampai
dipanggil `.click()`, `.fill()`, `expect().toBeVisible()`, dll. Mendefinisikan
di constructor hanya mencatat "seperti apa elemen yang dicari", bukan mencarinya.

Manfaat: jika selector berubah (misalnya class CSS diubah), kamu hanya perlu
mengubah satu tempat di constructor, bukan di setiap test case.

---

### Lapis 9 — Spec File (Test Cases)

**File: `tests/admin/courses/grade-component.spec.ts`**

Ini adalah layer paling atas — tempat semua lapisan bawah dipakai bersama.

```typescript
import { test, expect } from '../../fixtures/grade-component.fixture';
import { createGradeComponent } from '../../factories/grade-component.factory';

/**
 * E2E Test Suite: Grade Component (Komponen Nilai) CRUD
 *
 * Strategi isolasi data:
 *  - Setiap test membuat ID unik dari Date.now()
 *  - CREATE: input via UI, cleanup by name via SQL
 *  - READ / UPDATE / DELETE: data di-insert langsung via SQL factory
 *  - trackForCleanup menghapus semua data via SQL setelah tiap test
 *  - mode: 'parallel' — test tidak saling bergantung
 */
test.describe('Grade Component Management', () => {

  // Semua test di dalam describe ini berjalan paralel (tidak bergantung satu sama lain)
  test.describe.configure({ mode: 'parallel' });

  // ── POSITIVE SCENARIOS ────────────────────────────────────────────────────

  test.describe('Positive Scenarios', () => {

    // ── Page-level (tidak butuh data) ──────────────────────────────────────

    test('should load the grade component page with the correct heading',
      async ({ gcPage }) => {
        // gcPage sudah di-goto oleh fixture
        await expect(gcPage.pageHeading).toBeVisible();
        await expect(gcPage.page).toHaveURL(/grade-component/);
      },
    );

    test('should open the create modal with the correct form title',
      async ({ gcPage }) => {
        await gcPage.openCreateModal();

        await expect(gcPage.page.getByText('Tambah data komponen nilai baru')).toBeVisible();
        await expect(gcPage.nameInput).toBeVisible();
        await expect(gcPage.acronymInput).toBeVisible();
        await expect(gcPage.submitButton).toBeVisible();
      },
    );

    // ── CREATE (UI-driven) ─────────────────────────────────────────────────
    // Test ini memverifikasi form create itu sendiri — data diinput via UI

    test('should create a new grade component with valid name and acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6); // 6 digit unik per test
        const name    = `Daily Task ${id}`;
        const acronym = `DT${id}`;

        await gcPage.openCreateModal();
        await gcPage.fillForm({ name, acronym });
        await gcPage.submitForm();
        trackForCleanup.gcName(name); // daftarkan untuk dihapus setelah test

        await gcPage.assertModalClosed();

        await gcPage.gotoFiltered(name); // reload dengan search query
        await gcPage.assertRowVisible(name);
      },
    );

    // ── READ (DB-seeded) ────────────────────────────────────────────────────
    // Test ini tidak bergantung pada Create UI — data sudah ada via factory

    test('should display the new grade component with the correct acronym in the table',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Display Test ${id}`;
        const acronym = `DP${id}`;

        // INSERT langsung ke DB — lebih cepat, tidak terpengaruh bug di UI create
        const gc = await createGradeComponent(name, acronym);
        trackForCleanup.gcId(gc.id); // simpan ID untuk teardown by ID

        await gcPage.gotoFiltered(name);

        const row = gcPage.rowByName(name);
        await expect(row).toBeVisible();
        await expect(row).toContainText(acronym); // pastikan akronim juga tampil
      },
    );

    test('should find a grade component when searching by name',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Weekly Quiz ${id}`;
        const acronym = `WQ${id}`;

        const gc = await createGradeComponent(name, acronym);
        trackForCleanup.gcId(gc.id);

        await gcPage.goto();          // buka halaman tanpa filter
        await gcPage.search(name);    // ketik di search box + Enter

        await gcPage.assertRowVisible(name);
      },
    );

    test('should open the update modal pre-filled with existing data',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Pre Update ${id}`;
        const acronym = `PU${id}`;

        const gc = await createGradeComponent(name, acronym);
        trackForCleanup.gcId(gc.id);

        await gcPage.gotoFiltered(name);
        await gcPage.openUpdateModal(name);

        // Verifikasi judul modal update (bukan create)
        await expect(gcPage.page.getByText('Ubah data komponen nilai')).toBeVisible();
        // Verifikasi form pre-filled dengan data yang benar
        await expect(gcPage.nameInput).toHaveValue(name);
        await expect(gcPage.acronymInput).toHaveValue(acronym);
      },
    );

    // ── UPDATE (DB-seeded) ─────────────────────────────────────────────────

    test('should update an existing grade component name and acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id       = Date.now().toString().slice(-6);
        const original = { name: `Original ${id}`, acronym: `ORI${id}` };
        const updated  = { name: `Updated ${id}`,  acronym: `UPD${id}` };

        const gc = await createGradeComponent(original.name, original.acronym);
        // Track by ID — stabil meski nama berubah setelah update
        trackForCleanup.gcId(gc.id);

        await gcPage.gotoFiltered(original.name);
        await gcPage.updateGradeComponent(original.name, updated);

        // Verifikasi nama baru muncul
        await gcPage.gotoFiltered(updated.name);
        await gcPage.assertRowVisible(updated.name);

        // Verifikasi nama lama tidak ada
        await gcPage.gotoFiltered(original.name);
        await gcPage.assertRowNotVisible(original.name);
      },
    );

    // ── DELETE (DB-seeded) ─────────────────────────────────────────────────

    test('should open the delete confirmation modal with a warning message',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Del Modal ${id}`;
        const acronym = `DM${id}`;

        const gc = await createGradeComponent(name, acronym);
        trackForCleanup.gcId(gc.id);

        await gcPage.gotoFiltered(name);
        await gcPage.openDeleteModal(name);

        await expect(gcPage.deleteWarningText).toBeVisible();
        await expect(gcPage.deleteConfirmButton).toBeVisible();
      },
    );

    test('should delete a grade component and remove it from the table',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `To Delete ${id}`;
        const acronym = `TD${id}`;

        const gc = await createGradeComponent(name, acronym);
        // Daftarkan sebagai safety net — SQL DELETE no-op jika UI delete berhasil
        trackForCleanup.gcId(gc.id);

        await gcPage.gotoFiltered(name);
        await gcPage.deleteGradeComponent(name);

        await gcPage.gotoFiltered(name);
        await gcPage.assertRowNotVisible(name);
      },
    );

    // ── Modal / Search (tidak butuh data) ──────────────────────────────────

    test('should close the modal without saving when the close button is clicked',
      async ({ gcPage }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Close Modal ${id}`;
        const acronym = `CM${id}`;

        await gcPage.openCreateModal();
        await gcPage.fillForm({ name, acronym }); // isi tapi tidak submit

        await gcPage.closeModal();

        await gcPage.assertModalClosed();
        await gcPage.assertRowNotVisible(name); // pastikan tidak tersimpan
      },
    );

    test('should return empty search results for a non-matching query',
      async ({ gcPage }) => {
        await gcPage.search('XXXXXXXXXNONEXISTENT99999');

        await gcPage.assertTableEmpty();
      },
    );

  });

  // ── NEGATIVE SCENARIOS ────────────────────────────────────────────────────

  test.describe('Negative Scenarios', () => {

    // ── Validasi field kosong (tidak butuh data) ───────────────────────────

    test('should show a validation error when the name field is empty',
      async ({ gcPage }) => {
        await gcPage.openCreateModal();
        await gcPage.fillAcronym('TST'); // isi akronim, nama dibiarkan kosong
        await gcPage.submitForm();

        await gcPage.assertFieldError('Nama komponen nilai harus diisi');
        await gcPage.assertModalOpen(); // modal tidak boleh tertutup
      },
    );

    test('should show a validation error when the acronym field is empty',
      async ({ gcPage }) => {
        await gcPage.openCreateModal();
        await gcPage.fillName('Test Grade Component'); // isi nama, akronim dikosongkan
        await gcPage.submitForm();

        await gcPage.assertFieldError('Akronim komponen nilai harus diisi');
        await gcPage.assertModalOpen();
      },
    );

    test('should show validation errors when both name and acronym fields are empty',
      async ({ gcPage }) => {
        await gcPage.openCreateModal();
        await gcPage.submitForm(); // submit tanpa isi apapun

        // Dua error harus muncul bersamaan
        await gcPage.assertFieldError('Nama komponen nilai harus diisi');
        await gcPage.assertFieldError('Akronim komponen nilai harus diisi');
        await gcPage.assertModalOpen();
      },
    );

    // ── Duplicate / conflict (butuh DB prerequisite) ───────────────────────

    test('should reject a duplicate grade component name',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Duplicate Name ${id}`;
        const acronym = `DN${id}`;

        // Seed data pertama langsung via DB
        const gc = await createGradeComponent(name, acronym);
        trackForCleanup.gcId(gc.id);

        // Coba buat entri kedua dengan nama sama tapi akronim berbeda via UI
        await gcPage.openCreateModal();
        await gcPage.fillForm({ name, acronym: `DNA${id}` });
        await gcPage.submitForm();

        // Server harus menolak — tampilkan error inline
        await gcPage.assertInlineFormError();
        await gcPage.assertModalOpen();
      },
    );

    test('should reject a duplicate grade component acronym',
      async ({ gcPage, trackForCleanup }) => {
        const id      = Date.now().toString().slice(-6);
        const name    = `Duplicate Acronym ${id}`;
        const acronym = `DA${id}`;

        const gc = await createGradeComponent(name, acronym);
        trackForCleanup.gcId(gc.id);

        // Coba buat dengan nama berbeda tapi akronim sama
        await gcPage.openCreateModal();
        await gcPage.fillForm({ name: `Duplicate Acronym Alt ${id}`, acronym });
        await gcPage.submitForm();

        await gcPage.assertInlineFormError();
        await gcPage.assertModalOpen();
      },
    );

    test('should not update a grade component to a name that already exists',
      async ({ gcPage, trackForCleanup }) => {
        const id    = Date.now().toString().slice(-6);
        const nameA = `Conflict A ${id}`;
        const nameB = `Conflict B ${id}`;

        const gcA = await createGradeComponent(nameA, `CA${id}`);
        const gcB = await createGradeComponent(nameB, `CB${id}`);
        trackForCleanup.gcId(gcA.id);
        trackForCleanup.gcId(gcB.id);

        // Coba rename B ke nama A yang sudah ada — server harus menolak
        await gcPage.gotoFiltered(nameB);
        await gcPage.openUpdateModal(nameB);
        await gcPage.fillName(nameA);
        await gcPage.submitForm();

        await gcPage.assertInlineFormError();
        await gcPage.assertModalOpen();
      },
    );

  });

});
```

---

## 5. Menjalankan Test

### Jalankan hanya grade-component:

```bash
# Dari folder simak-e2e
npx playwright test tests/admin/courses/grade-component.spec.ts
```

### Jalankan dengan reporter list (output terminal lebih lengkap):

```bash
npx playwright test tests/admin/courses/grade-component.spec.ts --reporter=list
```

### Jalankan semua test admin:

```bash
npx playwright test tests/admin/
```

### Jalankan satu test case tertentu:

```bash
npx playwright test -g "should create a new grade component"
```

### Jalankan dalam mode headed (tampilkan browser):

```bash
npx playwright test tests/admin/courses/grade-component.spec.ts --headed
```

### Lihat laporan HTML:

```bash
npx playwright show-report
```

---

## 6. Konsep Kunci dan Pola Desain

### 6.1 Pola Isolasi Data

Setiap test harus **benar-benar independen** dari test lain. Ini dicapai dengan:

```
┌─────────────────────────────────────────────────────────┐
│  SEBELUM test: seed data unik via SQL factory           │
│  (tidak bergantung pada hasil test lain)                │
│                                                          │
│  SELAMA test: interaksi UI menggunakan data itu         │
│                                                          │
│  SETELAH test: hapus semua data via SQL (teardown)      │
│  (berjalan meski test gagal)                            │
└─────────────────────────────────────────────────────────┘
```

**Kenapa `Date.now().toString().slice(-6)`?**

Menghasilkan 6 digit terakhir dari Unix timestamp (millisecond).
Contoh: `Date.now()` = `1748348123456` → `slice(-6)` = `"123456"`.

Dengan workers: 1 (sequential), setiap test berjalan di momen berbeda,
sehingga 6 digit ini berbeda antar test. Hasilnya: nama data per test unik.

### 6.2 Track by Name vs Track by ID

| Kondisi | Cara track | Kenapa |
|---------|-----------|--------|
| Data dibuat via UI | `gcName(name)` → `deleteByName` | Kita hanya tahu nama, tidak dapat ID |
| Data dibuat via factory | `gcId(id)` → `deleteById` | ID lebih stabil — tidak berubah walau nama diupdate |

Contoh: test update mengubah nama dari "Original" ke "Updated". Jika kita track by name "Original", setelah update nama itu tidak ada lagi → teardown by name gagal silently. Track by ID selalu benar.

### 6.3 Paralel vs Serial

```typescript
// SERIAL — test berjalan berurutan, BOLEH saling bergantung
test.describe.configure({ mode: 'serial' });

// PARALLEL — tiap test independen, bisa berjalan bersama (jika workers > 1)
test.describe.configure({ mode: 'parallel' });
```

Dengan `workers: 1` (config saat ini), parallel di sini berarti "tidak ada
dependency antar test" — bukan "berjalan bersamaan di thread berbeda". Efeknya:
jika satu test gagal, test lain tetap berjalan (berbeda dengan serial di mana
kegagalan satu test menghentikan test berikutnya).

### 6.4 `gotoFiltered` vs `goto` + `search`

```typescript
// Cara 1: goto + search (2 langkah via UI)
await gcPage.goto();
await gcPage.search(name);  // ← slowMo 1 detik di sini

// Cara 2: gotoFiltered (1 langkah, langsung via URL)
await gcPage.gotoFiltered(name);  // URL: /list/courses/grade-component?search=...
```

`gotoFiltered` lebih cepat karena melewati langkah `search` via UI.
Dipakai di test yang hanya ingin **menemukan data**, bukan memverifikasi fitur search.
Test khusus search ("should find...") tetap pakai `goto` + `search` untuk memverifikasi
fitur search itu sendiri.

### 6.5 `td:last-child` di Locator Tombol

```typescript
updateButtonInRow(rowName: string): Locator {
  return this.page
    .locator('tr')
    .filter({ hasText: rowName })
    .locator('td:last-child button:has(img[alt="icon-update"])');
//           ^^^^^^^^^^^^^^^^^^^
}
```

Ini mencegah klik tombol yang tampil di kolom mobile (tersembunyi di `td:first-child`
tapi masih ada di DOM). Tanpa `td:last-child`, `locator.click()` bisa gagal karena
menemukan dua elemen matching (desktop + mobile button).

### 6.6 `assertInlineFormError` vs `assertFieldError`

```typescript
// assertFieldError: error validasi dari react-hook-form/Zod (client-side)
// Contoh: "Nama komponen nilai harus diisi"
await gcPage.assertFieldError('Nama komponen nilai harus diisi');

// assertInlineFormError: error dari server (Prisma unique constraint, dll.)
// Ditampilkan sebagai <span class="text-red-400"> di bawah form
// Tidak tahu pesan pastinya — hanya cek keberadaan elemen error
await gcPage.assertInlineFormError();
```

---

## 7. Ringkasan Alur Data per Test

### Test CREATE (UI-driven)

```
[test dimulai]
    │
    ├── fixture gcPage.goto() → browser buka /list/courses/grade-component
    │
    ├── gcPage.openCreateModal() → klik tombol +
    ├── gcPage.fillForm({name, acronym}) → isi input
    ├── gcPage.submitForm() → klik Tambah
    │       (server menyimpan ke DB via Next.js server action)
    │
    ├── trackForCleanup.gcName(name) → daftarkan name untuk cleanup
    │
    ├── gcPage.assertModalClosed() → pastikan modal menutup
    ├── gcPage.gotoFiltered(name) → buka halaman dengan search query
    ├── gcPage.assertRowVisible(name) → assert baris ada di tabel
    │
[test selesai]
    │
    └── TEARDOWN:
        deleteGradeComponentByName(name)
            → DELETE FROM sb25_assessments_details WHERE gradeId = ...
            → DELETE FROM sb25_grade_components WHERE name = ...
```

### Test READ (DB-seeded)

```
[test dimulai]
    │
    ├── createGradeComponent(name, acronym)
    │       → INSERT INTO sb25_grade_components (id, name, acronym)
    │       → returns { id, name, acronym }
    │
    ├── trackForCleanup.gcId(gc.id) → daftarkan ID untuk cleanup
    │
    ├── gcPage.gotoFiltered(name) → buka halaman dengan search
    ├── expect(gcPage.rowByName(name)).toBeVisible() → assert baris ada
    ├── expect(row).toContainText(acronym) → assert akronim tampil
    │
[test selesai]
    │
    └── TEARDOWN:
        deleteGradeComponentById(gc.id)
            → DELETE FROM sb25_assessments_details WHERE gradeId = gc.id
            → DELETE FROM sb25_grade_components WHERE id = gc.id
```

### Test UPDATE (DB-seeded)

```
[test dimulai]
    │
    ├── createGradeComponent(originalName, originalAcronym)
    │       → INSERT langsung ke DB
    │
    ├── trackForCleanup.gcId(gc.id) → by ID (stabil walau nama berubah)
    │
    ├── gcPage.gotoFiltered(originalName)
    ├── gcPage.updateGradeComponent(originalName, { updatedName, updatedAcronym })
    │       → openUpdateModal → fillForm → submitForm → assertModalClosed
    │       (server UPDATE record di DB)
    │
    ├── gotoFiltered(updatedName) → assertRowVisible(updatedName)
    ├── gotoFiltered(originalName) → assertRowNotVisible(originalName)
    │
[test selesai]
    │
    └── TEARDOWN: deleteGradeComponentById(gc.id)
        (ID gc tetap sama walau name sudah berubah menjadi updatedName)
```

### Test NEGATIVE (Duplicate)

```
[test dimulai]
    │
    ├── createGradeComponent(name, acronym) → seed data pertama via DB
    ├── trackForCleanup.gcId(gc.id)
    │
    │   (tidak ada goto() karena tidak butuh dropdown/factory di halaman)
    │
    ├── gcPage.openCreateModal() → fixture sudah di goto, langsung buka modal
    ├── gcPage.fillForm({ name, acronym: newAcronym }) → nama sama
    ├── gcPage.submitForm()
    │       (server: cek unique constraint → error)
    │
    ├── gcPage.assertInlineFormError() → pastikan error server tampil
    ├── gcPage.assertModalOpen() → modal tidak boleh menutup
    │
[test selesai]
    │
    └── TEARDOWN: deleteGradeComponentById(gc.id)
```

---

*Tutorial ini mencakup 9 lapis dari konfigurasi project hingga test case,*
*menjelaskan mengapa setiap keputusan desain diambil, bukan hanya apa yang dilakukan.*
