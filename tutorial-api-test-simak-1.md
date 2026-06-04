# Tutorial: Membuat API Test Suite untuk SIMAK

Tutorial ini menjelaskan dari nol cara membangun test otomatis untuk 5 route API di aplikasi
SIMAK (Sistem Informasi Akademik). Kamu akan mengetik ulang setiap file dari awal, sehingga
paham alasan di balik setiap keputusan desain.

---

## Daftar Isi

1. [Gambaran Besar (Top-Down)](#1-gambaran-besar-top-down)
2. [Struktur Direktori Final](#2-struktur-direktori-final)
3. [Fondasi (Bottom-Up)](#3-fondasi-bottom-up)
4. [Konfigurasi: playwright.config.ts](#4-konfigurasi-playwrightconfigts)
5. [Proses Login: admin.setup.ts](#5-proses-login-adminsetupts)
6. [Koneksi Database: factories/db.ts](#6-koneksi-database-factoriesdbts)
7. [Helper Database: helpers/api-db.ts](#7-helper-database-helpersapi-dbts)
8. [File Test 1: avatar.api.spec.ts](#8-file-test-1-avatarapi-spects)
9. [File Test 2: payment.api.spec.ts](#9-file-test-2-paymentapi-spects)
10. [File Test 3: grade.api.spec.ts](#10-file-test-3-gradeapi-spects)
11. [File Test 4: excel.api.spec.ts](#11-file-test-4-excelapi-spects)
12. [File Test 5: pdf.api.spec.ts](#12-file-test-5-pdfapi-spects)
13. [Cara Menjalankan](#13-cara-menjalankan)
14. [Pola-Pola Penting](#14-pola-pola-penting)

---

## 1. Gambaran Besar (Top-Down)

### Apa yang kita uji?

Aplikasi SIMAK (Next.js) punya 5 route API yang melayani unduhan file:

| Route | Fungsi |
|---|---|
| `GET /api/avatar` | Serve foto mahasiswa (image) |
| `GET /api/payment` | Serve bukti pembayaran herregistrasi (PDF/image) |
| `GET /api/grade` | Export nilai kelas ke file Excel (.xlsx) |
| `GET /api/excel` | Export laporan operasional kampus ke Excel |
| `GET /api/pdf` | Generate PDF: KRS, KHS, transkrip, herregistrasi, laporan |

### Mengapa API test berbeda dari E2E test biasa?

Test E2E biasa membuka browser, klik tombol, dan periksa tampilan. API test **langsung
memanggil endpoint HTTP** tanpa membuka browser. Ini jauh lebih cepat dan fokus pada:
- Apakah status code benar? (200, 400, 404)
- Apakah Content-Type sesuai? (application/pdf, dll.)
- Apakah body response adalah file yang valid?

### Bagaimana alur autentikasi bekerja?

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: Login (admin.setup.ts)                                  │
│                                                                 │
│  Browser → POST /sign-in → berhasil → simpan cookie ke         │
│  .auth/admin.json                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │ (cookie diwariskan ke project 'api')
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: Test API (*.api.spec.ts)                                │
│                                                                 │
│  request.get('/api/pdf?...') → server menerima cookie admin →  │
│  server mengembalikan data → test verifikasi response           │
└─────────────────────────────────────────────────────────────────┘
```

### Urutan prioritas test

Kami membangun test dari yang paling kritis ke yang paling aman:

```
Priority 1: /api/pdf    — langsung berdampak ke mahasiswa
Priority 2: /api/excel  — laporan operasional kampus
Priority 3: /api/grade  — export nilai untuk alur penilaian
Priority 4: /api/avatar — file serving sederhana
Priority 5: /api/payment — identik avatar + fitur download
```

---

## 2. Struktur Direktori Final

Setelah selesai, direktori kamu akan terlihat seperti ini:

```
simak-e2e/
├── .env.test                        ← Variabel lingkungan (JANGAN commit ke git)
├── playwright.config.ts             ← Konfigurasi semua project Playwright
│
├── .auth/                           ← Cookie hasil login (auto-generated)
│   └── admin.json
│
└── tests/
    ├── auth/
    │   └── admin.setup.ts           ← Script login admin
    │
    ├── factories/
    │   └── db.ts                    ← Koneksi pool database
    │
    └── api/
        ├── helpers/
        │   └── api-db.ts            ← Helper query DB untuk API test
        │
        ├── avatar.api.spec.ts       ← Test GET /api/avatar
        ├── payment.api.spec.ts      ← Test GET /api/payment
        ├── grade.api.spec.ts        ← Test GET /api/grade
        ├── excel.api.spec.ts        ← Test GET /api/excel
        └── pdf.api.spec.ts          ← Test GET /api/pdf
```

**File yang sudah ada sebelumnya** (tidak perlu dibuat ulang):
- `tests/auth/admin.setup.ts`
- `tests/factories/db.ts`
- `playwright.config.ts` (kita hanya menambahkan project `api`)

**File yang kita buat dari nol**:
- `tests/api/helpers/api-db.ts`
- `tests/api/avatar.api.spec.ts`
- `tests/api/payment.api.spec.ts`
- `tests/api/grade.api.spec.ts`
- `tests/api/excel.api.spec.ts`
- `tests/api/pdf.api.spec.ts`

---

## 3. Fondasi (Bottom-Up)

Sebelum membuat file test, kita pahami 3 lapisan fondasi yang sudah ada.

### 3.1 File `.env.test`

Semua konfigurasi sensitif disimpan di sini. **Jangan pernah hardcode** nilai ini
langsung di dalam kode test.

```
# Lokasi: simak-e2e/.env.test

# URL aplikasi yang berjalan
TEST_BASE_URL=http://localhost:3000

# Koneksi langsung ke database PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5433/simakdb

# Akun admin untuk login
TEST_ADMIN_EMAIL=admin1@stmik.com
TEST_ADMIN_PASSWORD=admin

# Akun dosen (untuk test lain)
TEST_LECTURER_EMAIL=lecturer4@stmik.com
TEST_LECTURER_PASSWORD=lecturer

# Akun mahasiswa (untuk test lain)
TEST_STUDENT_EMAIL=Pamungkas5512@stmik.com
TEST_STUDENT_PASSWORD=student
```

### 3.2 Mengapa perlu `DATABASE_URL`?

Test API perlu tahu ID record yang valid di database. Daripada hardcode UUID (yang bisa
berubah tiap environment), kita **query langsung ke DB** untuk menemukan ID yang valid saat
test berjalan. Inilah tujuan file `helpers/api-db.ts`.

### 3.3 Package yang digunakan

```json
// package.json (devDependencies yang relevan)
{
  "@playwright/test": "^1.58.2",  // Framework test utama
  "dotenv": "^17.4.2",            // Membaca .env.test
  "pg": "^8.20.0",                // Driver PostgreSQL untuk Node.js
  "@types/pg": "^8.20.0"         // TypeScript types untuk pg
}
```

---

## 4. Konfigurasi: playwright.config.ts

File ini sudah ada dan mengatur semua project test. Kita **menambahkan satu project baru**
yaitu `api` di bagian `projects`.

### Apa yang ditambahkan

Tambahkan blok berikut ke dalam array `projects` di `playwright.config.ts`:

```typescript
// ─── PROJECT API (headless, admin session) ────────────────
{
  name: 'api',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: path.join(AUTH_DIR, 'admin.json'),  // Gunakan cookie admin
    launchOptions: { slowMo: 0 },                      // Tidak butuh slowMo
    headless: true,                                    // Tidak buka browser
  },
  testMatch: 'tests/api/**/*.api.spec.ts',             // Hanya file *.api.spec.ts
  dependencies: ['setup-admin'],                       // Login dulu sebelum test
},
```

### Penjelasan setiap opsi

| Opsi | Nilai | Penjelasaan |
|---|---|---|
| `name` | `'api'` | Nama project, dipakai di perintah `--project=api` |
| `storageState` | `admin.json` | Playwright akan kirim cookie ini di setiap request |
| `launchOptions.slowMo` | `0` | Project lain pakai `slowMo: 1000` untuk bisa dilihat manusia; API test tidak perlu |
| `headless` | `true` | Tidak ada browser yang terbuka |
| `testMatch` | `*.api.spec.ts` | Konvensi nama file: harus diakhiri `.api.spec.ts` |
| `dependencies` | `['setup-admin']` | Playwright akan jalankan `setup-admin` terlebih dahulu |

### Mengapa `dependencies: ['setup-admin']`?

Tanpa ini, test API mungkin jalan sebelum file `admin.json` dibuat, sehingga request
akan ditolak karena tidak ada sesi login.

---

## 5. Proses Login: admin.setup.ts

File ini **sudah ada** di `tests/auth/admin.setup.ts`. Ketikkan ulang untuk memahami
cara kerjanya:

```typescript
// tests/auth/admin.setup.ts

import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Muat .env.test agar process.env.TEST_ADMIN_EMAIL tersedia
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Path absolut ke file output cookie
const AUTH_FILE = path.resolve(__dirname, '../../.auth/admin.json');
const BASE_URL   = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Ini bukan `test(...)` biasa — ini `setup(...)` yang artinya Playwright tahu
// ini fase persiapan, bukan test yang dihitung sebagai pass/fail
setup('login sebagai admin', async ({ page }) => {
  console.log('🔐 Login sebagai Admin/Operator...');

  // 1. Buka halaman login
  await page.goto(`${BASE_URL}/sign-in`);

  // 2. Tunggu field username muncul (halaman belum tentu langsung siap)
  await page.waitForSelector('input#username', { timeout: 10000 });

  // 3. Isi form — variabel dari .env.test
  await page.fill('input#username', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('input#password', process.env.TEST_ADMIN_PASSWORD!);

  // 4. Klik tombol submit
  await page.locator('form button').click();

  // 5. Tunggu redirect (URL tidak lagi mengandung '/sign-in')
  await page.waitForFunction(
    () => !window.location.pathname.includes('sign-in'),
    { timeout: 15000 },
  );

  console.log(`✅ Admin berhasil login, URL: ${page.url()}`);

  // 6. Simpan semua cookie dan localStorage ke file JSON
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`💾 Cookie Admin disimpan ke: ${AUTH_FILE}`);
});
```

### Apa isi `admin.json`?

File ini berisi cookies dan localStorage dalam format JSON. Playwright akan
membacanya dan menyertakan cookies tersebut di setiap `request.get(...)` yang
dibuat oleh project `api`. Isinya kira-kira:

```json
{
  "cookies": [
    {
      "name": "next-auth.session-token",
      "value": "...",
      "domain": "localhost",
      "path": "/",
      "httpOnly": true,
      "secure": false
    }
  ],
  "origins": []
}
```

### Catatan penting: field `input#username`

Meskipun HTML menggunakan `id="username"`, nilai yang dikirim adalah **email**
(bukan username). Di dalam kode server Next.js, field ini di-mapping ke kolom
`email` di tabel `sb25_users`. Ini penting ketika membuat factory atau query DB.

---

## 6. Koneksi Database: factories/db.ts

File ini **sudah ada** di `tests/factories/db.ts`. Ia membuat satu instance Pool
PostgreSQL yang dipakai bersama oleh semua helper DB.

```typescript
// tests/factories/db.ts

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Jarak dari file ini ke .env.test adalah dua level ke atas
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

/**
 * Shared pg connection pool for all data factories.
 * One pool per test worker process — Node.js cleans up connections on exit.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

### Mengapa pakai Pool, bukan Client?

`Pool` mengelola beberapa koneksi sekaligus dan mengembalikannya ke pool setelah
query selesai. Jauh lebih efisien daripada membuka dan menutup koneksi baru setiap
kali ada query.

### Mengapa satu pool untuk semua?

File ini di-import oleh banyak helper. Karena Node.js men-cache modul, `pool` hanya
dibuat **satu kali** per proses worker, lalu di-share ke semua yang mengimportnya.

---

## 7. Helper Database: helpers/api-db.ts

Ini adalah file **baru** yang kita buat. Letakkan di `tests/api/helpers/api-db.ts`.

### Tujuannya

Setiap test yang butuh data nyata (bukan data mock) harus menemukan ID yang valid di
database. File ini menyediakan fungsi-fungsi untuk itu. Jika tidak ada data, fungsi
mengembalikan `null`, dan test akan **di-skip** dengan pesan yang jelas.

### Prinsip desain

- Setiap fungsi hanya `SELECT` minimal — hanya ambil kolom `id` yang dibutuhkan.
- Tidak ada `ORDER BY` yang tidak perlu — kita hanya butuh *satu* record.
- Caller (file test) yang memutuskan apa yang terjadi jika hasilnya `null`.

### Ketikkan file ini dari awal:

```typescript
// tests/api/helpers/api-db.ts

/**
 * DB query helpers for API tests.
 *
 * Each function returns the first matching ID from the DB, or null if no
 * record exists. Callers use `test.skip(!id, reason)` to skip gracefully.
 *
 * Queries are intentionally minimal — they only select the ID needed and
 * impose no ordering beyond LIMIT 1, so they're fast regardless of table size.
 */
import { pool } from '../../factories/db';

// ── Kartu Rencana Studi ────────────────────────────────────────────────────────

export async function getValidKrsId(): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM sb25_krs LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// ── Kartu Hasil Studi ─────────────────────────────────────────────────────────

export async function getValidKhsId(): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM sb25_khs LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// ── Transkrip Akademik ─────────────────────────────────────────────────────────

/**
 * Returns a studentId yang punya setidaknya satu KHS detail (riwayat nilai),
 * sehingga algoritma transkrip bisa menemukan kurikulum yang relevan.
 * Hanya student aktif dengan tahun, program studi, dan dosen wali yang diambil.
 */
export async function getValidStudentIdForTranscript(): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT DISTINCT k."studentId" AS id
       FROM sb25_krs k
       JOIN sb25_khs        h  ON h."krsId"  = k.id
       JOIN sb25_khs_details kd ON kd."khsId" = h.id
       JOIN sb25_students   s  ON s.id = k."studentId"
      WHERE s.year         IS NOT NULL
        AND s."majorId"    IS NOT NULL
        AND s."lecturerId" IS NOT NULL
      LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// ── Herregistrasi ──────────────────────────────────────────────────────────────

/**
 * Returns "reregisterId:studentId" for a detail where the student has already
 * submitted the form (isStatusForm = true) — required for the reregister PDF.
 */
export async function getValidReregisterKey(): Promise<string | null> {
  const { rows } = await pool.query<{ reregisterId: string; studentId: string }>(
    `SELECT "reregisterId", "studentId"
       FROM sb25_reregister_details
      WHERE "isStatusForm" = true
      LIMIT 1`,
  );
  if (!rows[0]) return null;
  return `${rows[0].reregisterId}:${rows[0].studentId}`;
}

// ── Kelas Akademik ─────────────────────────────────────────────────────────────

export async function getValidAcademicClassId(): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM sb25_academic_classes LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// ── Periode ────────────────────────────────────────────────────────────────────

export async function getValidPeriodId(): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM sb25_periods LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// ── Jadwal Perkuliahan ─────────────────────────────────────────────────────────

/**
 * Returns a scheduleId that has at least one scheduleDetail row,
 * so the schedule export finds real data.
 */
export async function getValidScheduleId(): Promise<string | null> {
  const { rows } = await pool.query<{ scheduleId: string }>(
    `SELECT DISTINCT "scheduleId" FROM sb25_schedule_details LIMIT 1`,
  );
  return rows[0]?.scheduleId ?? null;
}

// ── Avatar Mahasiswa ───────────────────────────────────────────────────────────

/**
 * Returns the filename stored in Student.photo (not the full path).
 * Used for /api/avatar happy-path test.
 */
export async function getValidAvatarFilename(): Promise<string | null> {
  const { rows } = await pool.query<{ photo: string }>(
    `SELECT photo FROM sb25_students
      WHERE photo IS NOT NULL AND photo <> ''
      LIMIT 1`,
  );
  return rows[0]?.photo ?? null;
}

// ── Bukti Pembayaran ───────────────────────────────────────────────────────────

/**
 * Returns the filename stored in ReregisterDetail.paymentReceiptFile.
 * Used for /api/payment happy-path test.
 */
export async function getValidPaymentFilename(): Promise<string | null> {
  const { rows } = await pool.query<{ f: string }>(
    `SELECT "paymentReceiptFile" AS f
       FROM sb25_reregister_details
      WHERE "paymentReceiptFile" IS NOT NULL AND "paymentReceiptFile" <> ''
      LIMIT 1`,
  );
  return rows[0]?.f ?? null;
}
```

### Pola `rows[0]?.id ?? null`

Ini adalah kombinasi dua operator JavaScript:
- `rows[0]?.id` — optional chaining: jika `rows[0]` adalah `undefined`, kembalikan
  `undefined` (bukan throw error).
- `?? null` — nullish coalescing: jika hasilnya `undefined`, kembalikan `null`.

Hasilnya: fungsi **selalu** mengembalikan `string` atau `null`, tidak pernah throw.

### Kenapa transkrip butuh JOIN yang kompleks?

```sql
SELECT DISTINCT k."studentId" AS id
  FROM sb25_krs k
  JOIN sb25_khs        h  ON h."krsId"  = k.id
  JOIN sb25_khs_details kd ON kd."khsId" = h.id
  JOIN sb25_students   s  ON s.id = k."studentId"
 WHERE s.year IS NOT NULL AND s."majorId" IS NOT NULL AND s."lecturerId" IS NOT NULL
```

Algoritma transkrip di server membutuhkan:
1. Student harus punya `year`, `majorId`, `lecturerId` (untuk mapping kurikulum)
2. Student harus punya setidaknya 1 baris `khs_details` (riwayat nilai)

Jika kita pakai query sederhana `SELECT id FROM sb25_students LIMIT 1`, kita bisa
mendapatkan student yang tidak memenuhi syarat di atas, sehingga server menghasilkan
teks error bukan PDF. JOIN memastikan kita hanya mendapat student yang benar-benar
bisa menghasilkan transkrip.

### Kenapa `getValidReregisterKey()` mengembalikan string gabungan?

```typescript
return `${rows[0].reregisterId}:${rows[0].studentId}`;
```

Route `/api/pdf?type=reregister` butuh **dua** ID sekaligus: `reregisterId` dan
`studentId`. API menerimanya sebagai satu parameter `u` dengan format
`reregisterId:studentId`. Fungsi ini merangkainya agar caller tidak perlu tahu
format tersebut.

---

## 8. File Test 1: avatar.api.spec.ts

Route `/api/avatar` adalah yang paling sederhana: terima nama file, cari di folder
avatar, kembalikan gambar. Tidak ada DB query di server, tidak ada business logic.

```typescript
// tests/api/avatar.api.spec.ts

import { test, expect } from '@playwright/test';
import { getValidAvatarFilename } from './helpers/api-db';

/**
 * API Test Suite: GET /api/avatar
 *
 * Priority 4 — File serving sederhana untuk foto mahasiswa.
 * Tidak ada DB query, tidak ada business logic; risiko regresi paling rendah.
 *
 * File disimpan di folder yang dikonfigurasi via env AVATAR_FOLDER.
 * Response selalu inline (bukan attachment), sehingga gambar tampil di browser.
 *
 * Cakupan:
 *   - Missing param → 400
 *   - File tidak ditemukan di disk → 404
 *   - File valid → 200 + image/* Content-Type + Content-Disposition: inline
 */

// ── Validasi Parameter ────────────────────────────────────────────────────────

test.describe('GET /api/avatar — validasi parameter', () => {

  test('harus return 400 jika parameter file tidak ada', async ({ request }) => {
    const res = await request.get('/api/avatar');
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing file');
  });

});

// ── File Tidak Ditemukan ──────────────────────────────────────────────────────

test.describe('GET /api/avatar — file tidak ditemukan', () => {

  test('harus return 404 untuk nama file yang tidak ada di disk', async ({ request }) => {
    const res = await request.get('/api/avatar?file=nonexistent_file_xyz.jpg');
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).toContain('File not found');
  });

});

// ── Happy Path ────────────────────────────────────────────────────────────────

test.describe('GET /api/avatar — happy path', () => {

  test('harus return gambar dengan MIME type yang tepat dan Content-Disposition inline',
    async ({ request }) => {
      const filename = await getValidAvatarFilename();
      test.skip(!filename, 'Tidak ada foto mahasiswa (Student.photo) di database');

      const res = await request.get(`/api/avatar?file=${encodeURIComponent(filename)}`);
      expect(res.status()).toBe(200);

      // Verifikasi Content-Type: harus diawali "image/"
      const contentType = res.headers()['content-type'];
      expect(contentType).toMatch(/^image\//); // cocok dengan image/jpeg, image/png, dll.

      // Avatar selalu ditampilkan inline (tidak diunduh)
      const disposition = res.headers()['content-disposition'];
      expect(disposition).toBe('inline');

      // Body tidak boleh kosong
      const body = await res.body();
      expect(body.length).toBeGreaterThan(0);
    });

});
```

### Anatomi satu test

```typescript
test('nama test', async ({ request }) => {
  //                          ^^^^^^^
  //                          Ini bukan browser — ini APIRequestContext
  //                          Playwright inject ini secara otomatis
  //                          berdasarkan storageState di config

  const res = await request.get('/api/avatar');
  //                              ^^^^^^^^^^^^^^^^^
  //                              baseURL sudah diset di config, jadi
  //                              ini setara dengan: http://localhost:3000/api/avatar

  expect(res.status()).toBe(400);
  //          ^^^^^^
  //          HTTP status code sebagai angka integer
});
```

### Kenapa `encodeURIComponent(filename)`?

Nama file mungkin mengandung karakter spasi, tanda plus, atau karakter khusus lain.
`encodeURIComponent` mengubahnya menjadi format aman untuk URL. Contoh:
- `foto mahasiswa.jpg` → `foto%20mahasiswa.jpg`
- `foto+mahasiswa.jpg` → `foto%2Bmahasiswa.jpg`

### Kenapa `test.skip(!filename, '...')`?

Ini adalah cara Playwright untuk **melewatkan test secara kondisional** tanpa
menganggapnya gagal. Jika tidak ada foto di database, test ini tidak relevan
dijalankan — lebih baik skip daripada fail dengan pesan yang membingungkan.

---

## 9. File Test 2: payment.api.spec.ts

Route `/api/payment` identik dengan `/api/avatar`, tetapi ada satu fitur tambahan:
parameter `?download=true` mengubah `Content-Disposition` dari `inline` menjadi
`attachment; filename="..."`.

```typescript
// tests/api/payment.api.spec.ts

import { test, expect } from '@playwright/test';
import { getValidPaymentFilename } from './helpers/api-db';

/**
 * API Test Suite: GET /api/payment
 *
 * Priority 5 — File serving untuk bukti pembayaran herregistrasi.
 * Identik dengan /api/avatar, ditambah satu fitur: parameter ?download=true
 * mengubah Content-Disposition dari inline ke attachment.
 *
 * Cakupan:
 *   - Missing param → 400
 *   - File tidak ditemukan → 404
 *   - File valid + download=false (default) → inline
 *   - File valid + download=true            → attachment dengan filename
 */

test.describe('GET /api/payment — validasi parameter', () => {

  test('harus return 400 jika parameter file tidak ada', async ({ request }) => {
    const res = await request.get('/api/payment');
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing file');
  });

});

test.describe('GET /api/payment — file tidak ditemukan', () => {

  test('harus return 404 untuk nama file yang tidak ada di disk', async ({ request }) => {
    const res = await request.get('/api/payment?file=nonexistent_receipt_xyz.pdf');
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).toContain('File not found');
  });

});

test.describe('GET /api/payment — happy path', () => {

  // Deklarasikan filename di scope describe agar bisa dipakai semua test di bawah
  let filename: string | null;

  // beforeAll dijalankan SEKALI sebelum semua test dalam describe ini
  // Lebih efisien daripada query DB di setiap test
  test.beforeAll(async () => {
    filename = await getValidPaymentFilename();
  });

  test('tanpa ?download harus return file dengan Content-Disposition inline',
    async ({ request }) => {
      test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

      const res = await request.get(`/api/payment?file=${encodeURIComponent(filename)}`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-disposition']).toBe('inline');
      expect(res.headers()['content-type']).toBeTruthy();

      const body = await res.body();
      expect(body.length).toBeGreaterThan(0);
    });

  test('dengan ?download=false harus return Content-Disposition inline',
    async ({ request }) => {
      test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

      const res = await request.get(
        `/api/payment?file=${encodeURIComponent(filename)}&download=false`
      );
      expect(res.status()).toBe(200);
      expect(res.headers()['content-disposition']).toBe('inline');
    });

  test('dengan ?download=true harus return Content-Disposition attachment dengan nama file',
    async ({ request }) => {
      test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

      const res = await request.get(
        `/api/payment?file=${encodeURIComponent(filename)}&download=true`
      );
      expect(res.status()).toBe(200);
      const disposition = res.headers()['content-disposition'];
      // Harus diawali "attachment; filename="
      expect(disposition).toMatch(/^attachment; filename="/);
      // Harus mengandung nama file asli
      expect(disposition).toContain(filename);
    });

  test('mode inline dan download menghasilkan body yang identik', async ({ request }) => {
    test.skip(!filename, 'Tidak ada paymentReceiptFile di database');

    // Jalankan dua request secara paralel untuk efisiensi
    const [resInline, resDownload] = await Promise.all([
      request.get(`/api/payment?file=${encodeURIComponent(filename)}`),
      request.get(`/api/payment?file=${encodeURIComponent(filename)}&download=true`),
    ]);
    const bodyInline   = await resInline.body();
    const bodyDownload = await resDownload.body();

    // Ukuran harus sama
    expect(bodyInline.length).toBe(bodyDownload.length);
    // Isi byte-per-byte harus identik — hanya header yang berbeda, bukan isi file
    expect(bodyInline.equals(bodyDownload)).toBe(true);
  });

});
```

### Pola `test.beforeAll` + variabel di scope describe

```typescript
test.describe('...', () => {
  let filename: string | null;          // 1. Deklarasi di scope describe

  test.beforeAll(async () => {
    filename = await getValidPaymentFilename(); // 2. Isi sekali sebelum semua test
  });

  test('test A', async ({ request }) => {
    test.skip(!filename, '...');         // 3. Tiap test cek apakah ada datanya
    // gunakan filename...
  });

  test('test B', async ({ request }) => {
    test.skip(!filename, '...');
    // gunakan filename yang sama
  });
});
```

Tanpa `beforeAll`, setiap test akan query DB sendiri — 4x query untuk data yang sama.
Dengan `beforeAll`, hanya 1x query.

### Pola `Promise.all` untuk request paralel

```typescript
const [resInline, resDownload] = await Promise.all([
  request.get('...url-1...'),
  request.get('...url-2...'),
]);
```

`Promise.all` menjalankan kedua request **secara bersamaan** dan menunggu keduanya
selesai. Hasilnya diambil dengan destructuring array. Lebih cepat dari menjalankan
satu per satu secara sequential.

---

## 10. File Test 3: grade.api.spec.ts

Route `/api/grade` menghasilkan file Excel (.xlsx) untuk satu kelas akademik. Ada dua
mode: export nilai aktual dan export template kosong.

### Konsep penting: validasi binary XLSX

File XLSX adalah **ZIP container** yang berisi XML. Ciri khasnya: dua byte pertama
selalu `PK` (0x50 0x4B), sama persis dengan magic bytes format ZIP. Kita bisa
memverifikasi ini tanpa perlu membuka atau mem-parsing file.

```typescript
// tests/api/grade.api.spec.ts

import { test, expect } from '@playwright/test';
import { getValidAcademicClassId } from './helpers/api-db';

/**
 * API Test Suite: GET /api/grade
 *
 * Priority 3 — Endpoint khusus untuk export nilai satu kelas akademik.
 * Digunakan dalam alur penilaian: dosen download template → isi nilai → upload.
 *
 * Dua mode yang diuji secara terpisah:
 *   - Tanpa ?template  → export nilai aktual (ExportAssessmentGrade)
 *   - Dengan ?template → export template kosong  (ExportAssessmentTemplate)
 *
 * Kedua mode menghasilkan file XLSX dari data kelas yang sama (academicClassId),
 * tetapi struktur isinya berbeda: template kosong vs kolom nilai terisi.
 */

// MIME type resmi untuk file Excel format baru (.xlsx)
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Helper bersama — validasi bahwa response adalah file XLSX yang valid
function assertValidXlsx(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe(XLSX_CONTENT_TYPE);
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body[0]).toBe(0x50); // 'P' — byte pertama magic bytes ZIP
  expect(body[1]).toBe(0x4B); // 'K' — byte kedua magic bytes ZIP
}

// ── Validasi parameter (selalu jalan) ─────────────────────────────────────────

test.describe('GET /api/grade — validasi parameter', () => {

  test('harus return 400 jika academicClassId tidak ada', async ({ request }) => {
    const res = await request.get('/api/grade');
    expect(res.status()).toBe(400);
  });

});

// ── Happy path — butuh AcademicClass di DB ────────────────────────────────────

test.describe('GET /api/grade — export nilai aktual dan template', () => {

  let classId: string | null;

  test.beforeAll(async () => {
    classId = await getValidAcademicClassId();
  });

  test('tanpa ?template harus return Excel nilai aktual', async ({ request }) => {
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const res  = await request.get(`/api/grade?academicClassId=${classId}`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    // Nama file mengikuti format: "Kelas {name} - ({code}) {courseName} - {period}.xlsx"
    expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
  });

  test('dengan ?template harus return Excel template kosong', async ({ request }) => {
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const res  = await request.get(`/api/grade?academicClassId=${classId}&template=1`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    // Nama file sama dengan mode aktual — hanya isi Excel yang berbeda
    expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
  });

  test('kedua mode menghasilkan file dengan nama yang sama', async ({ request }) => {
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const [resActual, resTemplate] = await Promise.all([
      request.get(`/api/grade?academicClassId=${classId}`),
      request.get(`/api/grade?academicClassId=${classId}&template=1`),
    ]);
    // Nama file harus identik karena keduanya export kelas yang sama
    expect(resActual.headers()['content-disposition'])
      .toBe(resTemplate.headers()['content-disposition']);
  });

});
```

### Memahami regex untuk Content-Disposition

```typescript
expect(res.headers()['content-disposition']).toMatch(/Kelas .+ - \(.+\) .+\.xlsx/);
```

Regex ini cocok dengan string seperti:
- `attachment; filename="Kelas A - (TI101) Algoritma - Ganjil 2024.xlsx"`

Arti tiap bagian:
- `Kelas ` — literal
- `.+` — nama kelas (1 atau lebih karakter apapun)
- ` - ` — literal
- `\(` — tanda kurung buka (harus di-escape karena `(` punya arti khusus di regex)
- `.+` — kode mata kuliah
- `\)` — tanda kurung tutup
- ` .+` — nama mata kuliah + nama periode
- `\.xlsx` — ekstensi file (titik di-escape karena `.` di regex berarti "karakter apapun")

---

## 11. File Test 4: excel.api.spec.ts

Route `/api/excel` paling banyak variannya: 8 tipe laporan berbeda, semua menghasilkan
XLSX. Ada satu inkonsistensi penting: tipe `schedule` menggunakan `scheduleId`
sebagai parameter `u`, bukan `periodId` seperti tipe-tipe lainnya.

```typescript
// tests/api/excel.api.spec.ts

import { test, expect } from '@playwright/test';
import { getValidPeriodId, getValidScheduleId } from './helpers/api-db';

/**
 * API Test Suite: GET /api/excel
 *
 * Priority 2 — Laporan Excel operasional kampus per periode.
 * Digunakan admin setiap awal semester untuk pengambilan keputusan.
 *
 * Strategi validasi binary:
 *   - Magic bytes XLSX: 2 byte pertama harus 0x50 0x4B ('PK', tanda file ZIP)
 *     karena XLSX adalah format ZIP/Open XML
 *   - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   - Content-Disposition: mengandung 'attachment; filename='
 *
 * Perilaku endpoint per tipe:
 *   - Semua tipe selain 'schedule' menggunakan u = periodId
 *   - 'schedule' menggunakan u = scheduleId (INKONSISTENSI yang perlu diperhatikan)
 *   - Tipe yang tidak dikenal → 400
 *   - Jika data kosong (periode tanpa mahasiswa) → 200 dengan Excel baris kosong
 */

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function assertValidXlsx(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe(XLSX_CONTENT_TYPE);
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body[0]).toBe(0x50); // 'P'
  expect(body[1]).toBe(0x4B); // 'K'
}

// ── Validasi parameter (selalu jalan) ─────────────────────────────────────────

test.describe('GET /api/excel — validasi parameter', () => {

  test('harus return 400 jika parameter type tidak ada', async ({ request }) => {
    const res = await request.get('/api/excel?u=some-id');
    expect(res.status()).toBe(400);
  });

  test('harus return 400 jika parameter u tidak ada', async ({ request }) => {
    const res = await request.get('/api/excel?type=coursekrs');
    expect(res.status()).toBe(400);
  });

  test('harus return 400 untuk type yang tidak dikenal', async ({ request }) => {
    const periodId = await getValidPeriodId();
    test.skip(!periodId, 'Tidak ada Period di database');

    const res = await request.get(`/api/excel?u=${periodId}&type=invalid_type`);
    expect(res.status()).toBe(400);
  });

});

// ── Laporan per periode (Priority 2a) ─────────────────────────────────────────

test.describe('GET /api/excel — laporan berbasis periodId', () => {

  let periodId: string | null;

  test.beforeAll(async () => {
    periodId = await getValidPeriodId();
  });

  test('type=coursekrs harus return Excel rekapitulasi mata kuliah', async ({ request }) => {
    test.skip(!periodId, 'Tidak ada Period di database');

    const res  = await request.get(`/api/excel?u=${periodId}&type=coursekrs`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/REKAPITULASI MATA KULIAH/);
  });

  test('type=studentsRegisteredKrs harus return Excel mahasiswa sudah KRS',
    async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/excel?u=${periodId}&type=studentsRegisteredKrs`);
      const body = await res.body();
      assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
      expect(res.headers()['content-disposition']).toMatch(/MAHASISWA SUDAH KRS/);
    });

  test('type=studentsUnregisteredKrs harus return Excel mahasiswa belum KRS',
    async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/excel?u=${periodId}&type=studentsUnregisteredKrs`);
      const body = await res.body();
      assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
      expect(res.headers()['content-disposition']).toMatch(/MAHASISWA BELUM KRS/);
    });

  test('type=studentsTakingThesis harus return Excel mahasiswa program TA',
    async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/excel?u=${periodId}&type=studentsTakingThesis`);
      const body = await res.body();
      assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
      expect(res.headers()['content-disposition']).toMatch(/MAHASISWA PROGRAM TA/);
    });

  test('type=studentsTakingInternship harus return Excel mahasiswa program PKL',
    async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/excel?u=${periodId}&type=studentsTakingInternship`);
      const body = await res.body();
      assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
      expect(res.headers()['content-disposition']).toMatch(/MAHASISWA PROGRAM PKL/);
    });

  test('type=studentActiveInactive harus return Excel status aktif/nonaktif',
    async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/excel?u=${periodId}&type=studentActiveInactive`);
      const body = await res.body();
      assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
      expect(res.headers()['content-disposition']).toMatch(/AKTIF-NONAKTIF/);
    });

  test('type=studentsRegularSore harus return Excel pemisahan pagi/sore',
    async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/excel?u=${periodId}&type=studentsRegularSore`);
      const body = await res.body();
      assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
      expect(res.headers()['content-disposition']).toMatch(/Reg\.Pagi-Sore/);
    });

});

// ── Jadwal perkuliahan (u = scheduleId, BUKAN periodId) ──────────────────────

test.describe('GET /api/excel — type=schedule (u = scheduleId)', () => {

  test('harus return Excel jadwal untuk scheduleId yang ada', async ({ request }) => {
    const scheduleId = await getValidScheduleId();
    test.skip(!scheduleId, 'Tidak ada ScheduleDetail di database');

    const res  = await request.get(`/api/excel?u=${scheduleId}&type=schedule`);
    const body = await res.body();
    assertValidXlsx(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/JADWAL PERKULIAHAN/);
  });

  test('harus return 404 untuk scheduleId yang tidak punya detail', async ({ request }) => {
    // Schedule tanpa detail → data kosong → endpoint return 404
    const res = await request.get(
      '/api/excel?u=00000000-0000-0000-0000-000000000000&type=schedule'
    );
    expect(res.status()).toBe(404);
  });

});
```

### Catatan: inkonsistensi parameter `u`

Semua tipe menggunakan `u=periodId`, kecuali `schedule` yang menggunakan
`u=scheduleId`. Ini adalah perilaku nyata di kode produksi yang kita dokumentasikan
(bukan bug yang perlu diperbaiki di test). Test kita mencerminkan realitas ini.

### Catatan: laporan kosong tetap return 200

Berbeda dengan `schedule` yang return 404 jika tidak ada detail, laporan berbasis
periode (coursekrs, dll.) mengembalikan Excel dengan baris data kosong tapi tetap
status 200. Kita tidak perlu test kasus "data kosong" untuk tipe-tipe ini karena
keduanya sudah tercakup: validasi parameter (400) dan happy path (200).

---

## 12. File Test 5: pdf.api.spec.ts

Ini adalah file test paling kompleks — 12 tipe PDF, kombinasi dokumen individual
(butuh ID spesifik) dan laporan agregat (bisa jalan walau data kosong).

### Konsep penting: validasi binary PDF

File PDF selalu diawali dengan string `%PDF`. Kita bisa cek ini dengan membaca
4 byte pertama dari body response:

```typescript
expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
// body.slice(0, 4) → Buffer [0x25, 0x50, 0x44, 0x46]
// .toString('ascii') → '%PDF'
```

### Konsep penting: `for...of` untuk test dinamis

Daripada menulis 7 test identik (satu per tipe agregat), kita pakai loop:

```typescript
for (const type of ['coursekrs', 'studentsRegisteredKrs', ...] as const) {
  test(`type=${type} harus return PDF valid`, async ({ request }) => {
    // test body yang sama untuk setiap type
  });
}
```

`as const` memberitahu TypeScript bahwa array ini adalah tuple literal, bukan
`string[]`. Ini mengaktifkan type-checking yang lebih ketat.

### Ketikkan file lengkap:

```typescript
// tests/api/pdf.api.spec.ts

import { test, expect } from '@playwright/test';
import {
  getValidKrsId,
  getValidKhsId,
  getValidStudentIdForTranscript,
  getValidReregisterKey,
  getValidAcademicClassId,
  getValidPeriodId,
} from './helpers/api-db';

/**
 * API Test Suite: GET /api/pdf
 *
 * Priority 1 — Endpoint ini langsung berdampak ke mahasiswa (KRS, KHS, transkrip,
 * herregistrasi) dan mengandung logika paling kompleks di seluruh layer API
 * (transkrip: pemetaan predecessor/successor kurikulum, hitung SKS konsentrasi).
 *
 * Strategi validasi binary:
 *   - Magic bytes PDF: 4 byte pertama harus '%PDF' (ASCII)
 *   - Content-Type: 'application/pdf'
 *   - Content-Disposition: mengandung 'attachment; filename='
 *   - Ukuran body: > 100 bytes (bukan response error teks)
 *
 * Catatan skip:
 *   Tipe dokumen individual (krs, khs, transcript, reregister, assessment)
 *   membutuhkan record di DB. Jika tidak ada, test di-skip secara otomatis.
 *   Tipe agregat (coursekrs, studentsXxx) menghasilkan PDF walau data kosong.
 */

// ── Shared assertions ────────────────────────────────────────────────────────

function assertValidPdf(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe('application/pdf');
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  // Cek magic bytes: 4 karakter pertama file PDF selalu '%PDF'
  expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
}

// ── Parameter validation (selalu jalan, tidak butuh data DB) ─────────────────

test.describe('GET /api/pdf — validasi parameter', () => {

  test('harus return 400 jika parameter type tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?u=some-id');
    expect(res.status()).toBe(400);
  });

  test('harus return 400 jika parameter u tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?type=krs');
    expect(res.status()).toBe(400);
  });

});

// ── Dokumen individual mahasiswa (Priority 1a) ────────────────────────────────

test.describe('GET /api/pdf — type=krs (Kartu Rencana Studi)', () => {

  test('harus return PDF valid untuk krsId yang ada', async ({ request }) => {
    const krsId = await getValidKrsId();
    test.skip(!krsId, 'Tidak ada record KRS di database');

    const res  = await request.get(`/api/pdf?u=${krsId}&type=krs`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/KRS-/);
  });

  test('harus return 400 untuk krsId yang tidak ada', async ({ request }) => {
    const res = await request.get('/api/pdf?u=00000000-0000-0000-0000-000000000000&type=krs');
    expect(res.status()).toBe(400);
  });

});

test.describe('GET /api/pdf — type=khs (Kartu Hasil Studi)', () => {

  test('harus return PDF valid untuk khsId yang ada', async ({ request }) => {
    const khsId = await getValidKhsId();
    test.skip(!khsId, 'Tidak ada record KHS di database');

    const res  = await request.get(`/api/pdf?u=${khsId}&type=khs`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/KHS-/);
  });

});

// ── Transkrip akademik (Priority 1b — logika paling kompleks) ─────────────────

test.describe('GET /api/pdf — type=transcript (Transkrip Akademik)', () => {

  test('harus return PDF valid untuk studentId yang ada', async ({ request }) => {
    const studentId = await getValidStudentIdForTranscript();
    test.skip(!studentId, 'Tidak ada student dengan data lengkap di database');

    const res  = await request.get(`/api/pdf?u=${studentId}&type=transcript`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/TRANSCRIPT/);
  });

  test('harus return 400 untuk studentId yang tidak ada', async ({ request }) => {
    const res = await request.get(
      '/api/pdf?u=00000000-0000-0000-0000-000000000000&type=transcript'
    );
    expect(res.status()).toBe(400);
  });

});

// ── Formulir herregistrasi (Priority 1c) ─────────────────────────────────────

test.describe('GET /api/pdf — type=reregister (Formulir Herregistrasi)', () => {

  test('harus return PDF valid untuk reregisterId:studentId yang ada', async ({ request }) => {
    const key = await getValidReregisterKey();
    test.skip(!key, 'Tidak ada ReregisterDetail dengan isStatusForm=true di database');

    const res  = await request.get(`/api/pdf?u=${key}&type=reregister`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/HERREGISTRASI-/);
  });

  test('harus return 400 jika format u bukan reregisterId:studentId yang valid',
    async ({ request }) => {
      const res = await request.get('/api/pdf?u=invalid-key-format&type=reregister');
      expect(res.status()).toBe(400);
    });

});

// ── Daftar nilai kelas akademik ────────────────────────────────────────────────

test.describe('GET /api/pdf — type=assessment (Daftar Nilai Kelas)', () => {

  test('harus return PDF valid untuk academicClassId yang ada', async ({ request }) => {
    const classId = await getValidAcademicClassId();
    test.skip(!classId, 'Tidak ada AcademicClass di database');

    const res  = await request.get(`/api/pdf?u=${classId}&type=assessment`);
    const body = await res.body();
    assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    expect(res.headers()['content-disposition']).toMatch(/DAFTAR NILAI/);
  });

});

// ── Laporan agregat per periode (200 walau data kosong) ───────────────────────

test.describe('GET /api/pdf — laporan agregat (menggunakan periodId yang ada)', () => {

  let periodId: string | null;

  // Fetch periodId sekali untuk semua 7 test di bawah
  test.beforeAll(async () => {
    periodId = await getValidPeriodId();
  });

  // Loop menghasilkan 7 test dengan nama berbeda tapi body yang sama
  for (const type of [
    'coursekrs',
    'studentsRegisteredKrs',
    'studentsUnregisteredKrs',
    'studentsTakingThesis',
    'studentsTakingInternship',
    'studentActiveInactive',
    'studentsRegularSore',
  ] as const) {
    test(`type=${type} harus return PDF valid`, async ({ request }) => {
      test.skip(!periodId, 'Tidak ada Period di database');

      const res  = await request.get(`/api/pdf?u=${periodId}&type=${type}`);
      const body = await res.body();
      assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
    });
  }

});
```

---

## 13. Cara Menjalankan

### Persiapan (sekali saja)

```bash
# 1. Install dependencies
npm install

# 2. Install browser Playwright (hanya Chromium yang dibutuhkan untuk API test)
npx playwright install chromium

# 3. Pastikan aplikasi Next.js berjalan
#    Buka terminal terpisah:
cd C:\Projects\StmikBjbApplication\simak-sb
npm run dev
```

### Jalankan API test saja

```bash
# Jalankan setup login + semua API test
npx playwright test --project=setup-admin --project=api

# Dengan reporter list (tampilkan tiap test di terminal)
npx playwright test --project=setup-admin --project=api --reporter=list

# Jalankan satu file saja
npx playwright test --project=setup-admin --project=api tests/api/pdf.api.spec.ts
```

### Memahami output

```
◇ Login sebagai Admin/Operator...
✅ Admin berhasil login, URL: http://localhost:3000/admin
💾 Cookie Admin disimpan ke: ...\.auth\admin.json
  ✓  [setup-admin] login sebagai admin (5.3s)
  ✓  [api] GET /api/avatar — validasi parameter › harus return 400 ... (44ms)
  ✓  [api] GET /api/avatar — file tidak ditemukan › harus return 404 ... (15ms)
  -  [api] GET /api/avatar — happy path › harus return gambar ...        ← SKIP (tidak ada data)
  ✓  [api] GET /api/excel — validasi parameter › harus return 400 ... (9ms)
  ...

  14 skipped
  29 passed (12.5s)
```

- `✓` = test lulus
- `-` = test di-skip (karena tidak ada data di DB — ini **normal**, bukan gagal)
- `✗` = test gagal (seharusnya tidak ada setelah setup benar)

### Hanya jalankan test yang spesifik tipe

```bash
# Hanya test PDF
npx playwright test --project=setup-admin --project=api --grep "GET /api/pdf"

# Hanya test validasi parameter
npx playwright test --project=setup-admin --project=api --grep "validasi parameter"
```

---

## 14. Pola-Pola Penting

Bagian ini merangkum pola yang berulang di semua file test.

### Pola 1: Test yang selalu jalan vs. yang butuh data

```
┌──────────────────────────────────────────────────────┐
│ SELALU JALAN                                         │
│ (tidak butuh data DB)                                │
│                                                      │
│  test('missing param → 400', ...)                    │
│  test('unknown type → 400', ...)                     │
│  test('nonexistent ID format → 400', ...)            │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ SKIP JIKA TIDAK ADA DATA                             │
│ (butuh record nyata di DB)                           │
│                                                      │
│  beforeAll → query DB → dapatkan ID                  │
│  test(...) → test.skip(!id, '...')                   │
│           → request dengan ID valid                  │
│           → verifikasi response                      │
└──────────────────────────────────────────────────────┘
```

### Pola 2: Hierarki `describe` yang bersih

```typescript
// BAIK: Satu describe per kelompok skenario
test.describe('GET /api/pdf — validasi parameter', () => { ... });
test.describe('GET /api/pdf — type=krs',           () => { ... });
test.describe('GET /api/pdf — laporan agregat',    () => { ... });

// BURUK: Semua test dalam satu describe besar (sulit di-filter, sulit dibaca)
test.describe('GET /api/pdf', () => {
  test('validasi 1', ...);
  test('krs 1', ...);
  test('laporan 1', ...);
});
```

### Pola 3: Magic bytes untuk validasi binary

| Format | Magic Bytes | Cara cek |
|---|---|---|
| PDF | `%PDF` (hex: `25 50 44 46`) | `body.slice(0,4).toString('ascii') === '%PDF'` |
| XLSX/ZIP | `PK` (hex: `50 4B`) | `body[0] === 0x50 && body[1] === 0x4B` |
| JPEG | `FF D8` | `body[0] === 0xFF && body[1] === 0xD8` |
| PNG | `89 50 4E 47` | `body.slice(0,4)` vs Buffer |

### Pola 4: `encodeURIComponent` untuk nama file

```typescript
// SALAH — bisa rusak jika filename mengandung spasi atau karakter khusus
request.get(`/api/avatar?file=${filename}`)

// BENAR — selalu encode
request.get(`/api/avatar?file=${encodeURIComponent(filename)}`)
```

### Pola 5: Helper function `assertValidXxx`

Daripada mengulang 4 baris `expect` yang sama di setiap test, ekstrak ke fungsi:

```typescript
// Definisikan sekali di atas file
function assertValidPdf(body: Buffer, contentType: string, disposition: string) {
  expect(contentType).toBe('application/pdf');
  expect(disposition).toMatch(/^attachment; filename=/);
  expect(body.length).toBeGreaterThan(100);
  expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
}

// Panggil di setiap test
const body = await res.body();
assertValidPdf(body, res.headers()['content-type'], res.headers()['content-disposition']);
```

### Pola 6: Null-safety di DB helper

```typescript
// rows[0]?.id    → undefined jika rows kosong (tidak throw)
// ?? null        → konversi undefined menjadi null
return rows[0]?.id ?? null;

// Di caller: test.skip jika null
const id = await getValidKrsId();
test.skip(!id, 'Tidak ada record KRS di database');
// Setelah baris ini, TypeScript tahu id bukan null
```

### Pola 7: Satu pool untuk semua helper

```typescript
// factories/db.ts — dibuat SEKALI
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// helpers/api-db.ts — import pool yang sama
import { pool } from '../../factories/db';

// Semua fungsi helper menggunakan pool yang sama
// Node.js caching modul memastikan hanya satu koneksi pool yang dibuat
```

---

## Ringkasan Alur Eksekusi

```
npx playwright test --project=setup-admin --project=api
│
├── [setup-admin] admin.setup.ts
│   ├── Buka browser (headful)
│   ├── goto /sign-in
│   ├── Fill form dengan TEST_ADMIN_EMAIL & TEST_ADMIN_PASSWORD
│   ├── Klik submit → tunggu redirect
│   └── Simpan cookie → .auth/admin.json
│
└── [api] *.api.spec.ts (headless, tanpa browser)
    │
    ├── Playwright baca .auth/admin.json
    ├── Setiap request.get() menyertakan cookie admin secara otomatis
    │
    ├── avatar.api.spec.ts
    │   ├── GET /api/avatar          → cek 400 (tidak ada param)
    │   ├── GET /api/avatar?file=xyz → cek 404 (file tidak ada)
    │   └── GET /api/avatar?file=... → cek 200 + image/* + inline [skip jika kosong]
    │
    ├── payment.api.spec.ts          → pola sama + test download vs inline
    │
    ├── grade.api.spec.ts
    │   ├── GET /api/grade           → cek 400
    │   ├── GET /api/grade?classId=X → cek XLSX valid
    │   └── GET /api/grade?classId=X&template=1 → cek XLSX + nama file sama
    │
    ├── excel.api.spec.ts
    │   ├── Validasi parameter (3 test)
    │   ├── 7 tipe laporan × periodId (7 test)
    │   └── type=schedule × scheduleId (2 test)
    │
    └── pdf.api.spec.ts
        ├── Validasi parameter (2 test)
        ├── type=krs     (2 test: happy path + invalid ID)
        ├── type=khs     (1 test: happy path)
        ├── type=transcript (2 test: happy path + invalid ID)
        ├── type=reregister (2 test: happy path + format invalid)
        ├── type=assessment (1 test: happy path)
        └── 7 tipe agregat (7 test dalam loop)
```

**Total: 43 test — 29 passed, 14 skipped (tergantung isi database)**
