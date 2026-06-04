# Penjelasan Baris per Baris: `global.setup.ts`

```ts
import { chromium, FullConfig } from '@playwright/test';
```
Mengimpor dua hal dari Playwright:
- `chromium` — objek untuk meluncurkan browser Chrome/Chromium secara programatik
- `FullConfig` — tipe TypeScript yang merepresentasikan seluruh konfigurasi Playwright, dipakai sebagai tipe parameter fungsi `globalSetup`

---

```ts
import * as dotenv from 'dotenv';
import * as path from 'path';
```
- `dotenv` — library untuk membaca file `.env` dan memasukkan isinya ke `process.env`
- `path` — modul bawaan Node.js untuk memanipulasi path file lintas OS

---

```ts
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
```
Membaca file `.env.test` di root project dan memuat semua variabelnya ke `process.env`. `path.resolve(__dirname, '../../.env.test')` membangun path absolut: dari lokasi file ini (`tests/auth/`) naik dua level ke root project, lalu ambil file `.env.test`.

Setelah baris ini, `process.env.TEST_ADMIN_EMAIL`, `process.env.TEST_ADMIN_PASSWORD`, dst. sudah bisa diakses.

---

```ts
const AUTH_DIR = path.resolve(__dirname, '../../.auth');
```
Menyimpan path absolut ke folder `.auth/` di root project. Folder ini tempat menyimpan file cookie hasil login.

---

```ts
const ADMIN_AUTH_FILE    = path.join(AUTH_DIR, 'admin.json');
const LECTURER_AUTH_FILE = path.join(AUTH_DIR, 'lecturer.json');
const STUDENT_AUTH_FILE  = path.join(AUTH_DIR, 'student.json');
```
Membangun path lengkap ke masing-masing file cookie per role. `path.join()` menggabungkan `AUTH_DIR` dengan nama file secara aman (menangani perbedaan separator `/` vs `\` antar OS).

---

```ts
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
```
Mengambil URL aplikasi dari environment variable. Jika `TEST_BASE_URL` tidak di-set di `.env.test`, fallback ke `http://localhost:3000`. Ini memudahkan test dijalankan di environment berbeda (lokal, staging, CI) cukup dengan mengubah `.env.test`.

---

## Fungsi `loginAndSave`

```ts
async function loginAndSave(
  email: string,
  password: string,
  authFile: string,
  roleName: string,
) {
```
Fungsi async yang menerima 4 parameter:
- `email` — username/email untuk login
- `password` — password akun
- `authFile` — path file JSON tempat menyimpan cookie hasil login
- `roleName` — nama role untuk keperluan logging di terminal

---

```ts
const browser = await chromium.launch();
```
Meluncurkan browser Chromium baru. Defaultnya berjalan **headless** (tanpa tampilan GUI) karena ini fase setup, bukan test. Browser ini sepenuhnya terisolasi dari browser yang dipakai saat test berjalan.

---

```ts
const context = await browser.newContext();
```
Membuat **browser context** baru — setara dengan profil browser yang bersih. Tidak ada cookie, tidak ada localStorage, tidak ada riwayat. Ini memastikan login yang dilakukan benar-benar fresh tanpa sisa data session sebelumnya.

---

```ts
const page = await context.newPage();
```
Membuka tab baru di dalam context tersebut. Semua interaksi (goto, fill, click) dilakukan lewat objek `page` ini.

---

```ts
console.log(`🔐 Login sebagai ${roleName}...`);
```
Mencetak pesan ke terminal sebagai penanda progress. Berguna saat melihat output `npx playwright test` untuk tahu fase mana yang sedang berjalan.

---

```ts
await page.goto(`${BASE_URL}/sign-in`);
```
Membuka halaman login di browser. Playwright menunggu hingga halaman selesai dimuat sebelum melanjutkan ke baris berikutnya.

---

```ts
await page.waitForSelector('input#username', { timeout: 10000 });
```
Menunggu sampai elemen `<input id="username">` muncul di DOM, maksimal 10 detik. Ini memastikan form login sudah siap diisi sebelum melakukan `fill()`. Penting karena Next.js perlu waktu untuk hydration (proses mounting komponen React di browser).

---

```ts
await page.fill('input#username', email);
await page.fill('input#password', password);
```
Mengisi field username dan password dengan nilai dari parameter fungsi. `fill()` mengosongkan field terlebih dahulu lalu mengetik nilai baru — lebih andal dibanding `type()` untuk mengisi form.

---

```ts
await page.locator('form button').click();
```
Mencari `<button>` pertama di dalam `<form>` lalu mengkliknya. Selector ini lebih stabil dibanding `button[type="submit"]` (yang butuh atribut eksplisit) atau `getByRole('button', { name: /log in/i })` (yang bergantung pada teks tombol).

---

```ts
await page.waitForFunction(
  () => !window.location.pathname.includes('sign-in'),
  { timeout: 15000 },
);
```
Menunggu sampai URL browser tidak lagi mengandung kata `sign-in`, maksimal 15 detik. Ekspresi `() => !window.location.pathname.includes('sign-in')` dieksekusi langsung di dalam browser (bukan di Node.js), dan Playwright akan terus mengeceknya secara polling sampai bernilai `true`.

Alasan menggunakan `waitForFunction` dan bukan `waitForURL`:
- Login menggunakan `router.push()` dari Next.js App Router — ini **client-side navigation**
- Client-side navigation tidak memicu event `load` halaman seperti navigasi biasa
- `waitForURL` dengan default `waitUntil: 'load'` menunggu event `load` yang tidak pernah terjadi, sehingga timeout
- `waitForFunction` tidak bergantung pada event navigasi — ia langsung membaca `window.location` di browser

---

```ts
console.log(`✅ ${roleName} berhasil login, URL: ${page.url()}`);
```
Mencetak konfirmasi login berhasil beserta URL saat ini (contoh: `http://localhost:3000/admin`). Berguna untuk debugging jika redirect menuju halaman yang tidak terduga.

---

```ts
await context.storageState({ path: authFile });
```
Mengambil seluruh state browser context saat ini — semua cookie, localStorage, dan sessionStorage — lalu menyimpannya ke file JSON yang ditentukan oleh `authFile`.

Isi file yang dihasilkan:
```json
{
  "cookies": [
    {
      "name": "session",
      "value": "eyJhbGciOiJIUzI1NiJ9...",
      "domain": "localhost",
      "path": "/",
      "expires": 1779251591,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": []
}
```
Cookie `session` inilah yang nanti diinjeksikan ke browser context setiap test, menggantikan proses login manual.

---

```ts
console.log(`💾 Cookie ${roleName} disimpan ke: ${authFile}`);
```
Mencetak path file cookie yang baru disimpan sebagai konfirmasi.

---

```ts
await browser.close();
```
Menutup browser yang dipakai untuk login. Penting dilakukan agar tidak ada proses browser yang menggantung di background setelah setup selesai.

---

## Fungsi `globalSetup`

```ts
async function globalSetup(config: FullConfig) {
```
Fungsi utama yang dipanggil otomatis oleh Playwright sebelum semua test berjalan. Parameter `config` berisi seluruh konfigurasi dari `playwright.config.ts`, tapi tidak digunakan di sini. Nama fungsi dan tipe parameternya harus sesuai konvensi Playwright agar bisa dikenali.

---

```ts
await loginAndSave(
  process.env.TEST_ADMIN_EMAIL!,
  process.env.TEST_ADMIN_PASSWORD!,
  ADMIN_AUTH_FILE,
  'Admin/Operator',
);
```
Memanggil `loginAndSave` untuk role Admin. `process.env.TEST_ADMIN_EMAIL!` mengambil nilai dari `.env.test` — tanda `!` di akhir adalah **non-null assertion** TypeScript, artinya kita memberitahu compiler bahwa nilai ini pasti ada (tidak `undefined`). Jika `.env.test` tidak memiliki variabel ini, runtime akan error.

Baris serupa diulangi untuk Lecturer dan Student:

```ts
await loginAndSave(
  process.env.TEST_LECTURER_EMAIL!,
  process.env.TEST_LECTURER_PASSWORD!,
  LECTURER_AUTH_FILE,
  'Lecturer/Dosen',
);

await loginAndSave(
  process.env.TEST_STUDENT_EMAIL!,
  process.env.TEST_STUDENT_PASSWORD!,
  STUDENT_AUTH_FILE,
  'Student/Mahasiswa',
);
```
Ketiga pemanggilan `loginAndSave` menggunakan `await` secara berurutan — artinya login Admin selesai dulu, baru Lecturer, baru Student. Tidak dijalankan paralel agar lebih mudah dibaca jika salah satu gagal.

---

```ts
console.log('\n🎉 Semua role berhasil login! Test siap dijalankan.\n');
```
Pesan akhir yang muncul di terminal setelah ketiga role berhasil login. Jika pesan ini tidak muncul, berarti salah satu `loginAndSave` gagal dan melempar error.

---

```ts
export default globalSetup;
```
Mengekspor fungsi `globalSetup` sebagai default export. Playwright membaca export ini dari path yang ditentukan di `playwright.config.ts`:

```ts
globalSetup: './tests/auth/global.setup.ts'
```

Tanpa `export default`, Playwright tidak bisa menemukan fungsi yang harus dijalankan.
