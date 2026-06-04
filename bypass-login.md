# Bypass Login di Playwright: Konsep & Alur Lengkap

## Mengapa Bypass Login?

Setiap test yang membutuhkan autentikasi **tidak perlu login ulang dari nol**. Tanpa bypass:

```
Test 1: buka /sign-in → isi form → klik login → jalankan test  (~3–5 detik overhead)
Test 2: buka /sign-in → isi form → klik login → jalankan test  (~3–5 detik overhead)
Test 3: buka /sign-in → isi form → klik login → jalankan test  (~3–5 detik overhead)
```

Dengan bypass:

```
Setup (1x): login tiap role → simpan cookie
Test 1: inject cookie → langsung jalankan test  (0 detik overhead)
Test 2: inject cookie → langsung jalankan test
Test 3: inject cookie → langsung jalankan test
```

---

## Gambaran Besar Alur

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: globalSetup (berjalan 1x sebelum semua test)           │
│                                                                  │
│  .env.test ──→ global.setup.ts ──→ browser login ──→ .auth/*.json│
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: Tiap test berjalan                                      │
│                                                                  │
│  playwright.config.ts ──→ inject .auth/admin.json ke context    │
│                       ──→ browser sudah "login" tanpa form       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: globalSetup — Login Sungguhan & Simpan Cookie

### 1.1 Titik Masuk: `playwright.config.ts`

```ts
export default defineConfig({
  globalSetup: './tests/auth/global.setup.ts',  // ← jalankan ini dulu
  // ...
});
```

Playwright membaca `globalSetup` dan menjalankan file tersebut **satu kali** sebelum test suite apapun dimulai.

---

### 1.2 Membuka Browser Baru yang Bersih

```ts
const browser = await chromium.launch();
const context = await browser.newContext();  // context kosong, tanpa cookie apapun
const page = await context.newPage();
```

`newContext()` membuat **profil browser baru yang terisolasi** — tidak ada cookie lama, tidak ada session sebelumnya. Ini penting agar login benar-benar fresh.

---

### 1.3 Melakukan Login Sungguhan

```ts
await page.goto(`${BASE_URL}/sign-in`);
await page.waitForSelector('input#username', { timeout: 10000 });
await page.fill('input#username', email);
await page.fill('input#password', password);
await page.locator('form button').click();
```

Ini adalah login **seperti yang dilakukan user asli** — mengisi form, klik tombol. Server memvalidasi credentials dan mengirimkan **cookie session** ke browser.

---

### 1.4 Menunggu Redirect (Client-Side Navigation Next.js)

```ts
await page.waitForFunction(
  () => !window.location.pathname.includes('sign-in'),
  { timeout: 15000 },
);
```

Setelah login berhasil, `LoginForm.tsx` memanggil `router.push('/admin')` untuk redirect ke dashboard. Ini adalah **client-side navigation** (Next.js App Router) — URL berubah di browser tanpa full page reload, sehingga tidak memicu event `load` standar.

`waitForFunction` mengevaluasi ekspresi JavaScript langsung di dalam browser sampai kondisi terpenuhi, sehingga bisa mendeteksi perubahan URL dari `router.push()`.

> **Catatan:** `waitForURL` dengan opsi default (`waitUntil: 'load'`) tidak cocok di sini karena menunggu event `load` yang tidak terjadi pada client-side navigation.

---

### 1.5 Menyimpan State Browser ke File

```ts
await context.storageState({ path: authFile });
```

`storageState()` mengambil **seluruh state browser context** saat ini dan menyimpannya ke file JSON. Isinya:

```json
{
  "cookies": [
    {
      "name": "session",
      "value": "eyJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uSWQiOi...",
      "domain": "localhost",
      "path": "/",
      "expires": 1779251591.646698,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": []
}
```

**Penjelasan tiap field cookie:**

| Field | Nilai | Arti |
|---|---|---|
| `name` | `session` | Nama cookie yang dibaca server untuk autentikasi |
| `value` | `eyJhbGci...` | JWT token berisi `sessionId` + waktu berlaku |
| `domain` | `localhost` | Cookie hanya berlaku untuk domain ini |
| `path` | `/` | Cookie berlaku untuk semua path |
| `expires` | Unix timestamp | Kapan cookie kedaluwarsa |
| `httpOnly` | `true` | JavaScript di halaman tidak bisa baca cookie ini (keamanan) |
| `secure` | `true` | Hanya dikirim lewat HTTPS (atau localhost) |
| `sameSite` | `Lax` | Cookie dikirim pada navigasi same-site biasa |

**Isi `value` (JWT) jika di-decode:**
```json
{
  "sessionId": "343a4e99-5d4a-49e7-be5a-d6bfd40aa0e5",
  "iat": 1779078791,
  "exp": 1779251591
}
```

Server menyimpan `sessionId` ini di database. Ketika browser mengirim cookie, server mencari `sessionId` untuk tahu siapa user-nya dan role-nya.

---

### 1.6 Hasil Akhir Fase 1

Tiga file terbentuk di folder `.auth/`:

```
.auth/
├── admin.json      ← session cookie milik admin
├── lecturer.json   ← session cookie milik dosen
└── student.json    ← session cookie milik mahasiswa
```

---

## Fase 2: Injeksi Cookie ke Tiap Test

### 2.1 Konfigurasi di `playwright.config.ts`

```ts
{
  name: 'admin',
  use: {
    ...devices['Desktop Chrome'],
    storageState: path.join(AUTH_DIR, 'admin.json'),  // ← inject cookie ini
  },
  testMatch: 'tests/admin/**/*.spec.ts',
},
```

Setiap project Playwright punya `storageState` yang menunjuk ke file JSON yang berbeda sesuai role.

---

### 2.2 Bagaimana Injeksi Bekerja

Saat sebuah test di `tests/admin/` hendak dijalankan, Playwright:

1. Membuat **browser context baru**
2. **Memuat** semua cookies dari `admin.json` ke dalam context tersebut
3. Baru membuka halaman test

```
Browser context kosong
       │
       ▼
Playwright membaca admin.json
       │
       ▼
Context sekarang punya cookie: session=eyJhbGci...
       │
       ▼
page.goto('http://localhost:3000/admin')
       │
       ▼
Browser mengirim cookie ke server: Cookie: session=eyJhbGci...
       │
       ▼
Server validasi → sessionId ditemukan → user dikenali sebagai Admin
       │
       ▼
Server render halaman admin (bukan redirect ke /sign-in)
```

---

### 2.3 Cara Server Memvalidasi

Setiap request ke halaman protected, server membaca cookie `session`, men-decode JWT, mengambil `sessionId`, lalu query ke database:

```
Cookie: session=eyJ...  →  decode JWT  →  sessionId: "343a4e99..."
                                               │
                                               ▼
                                    SELECT * FROM sessions
                                    WHERE id = '343a4e99...'
                                               │
                                               ▼
                                    Dapat data user + role
                                               │
                                               ▼
                              Lanjutkan render / tolak akses
```

---

## Ringkasan Alur Lengkap

```
.env.test
  │  TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, ...
  │
  ▼
global.setup.ts (berjalan 1x)
  │
  ├─ chromium.launch() → browser baru
  │    │
  │    ├─ page.goto('/sign-in')
  │    ├─ page.fill(email, password)
  │    ├─ page.click(button)
  │    ├─ waitForFunction(URL tidak mengandung 'sign-in')
  │    └─ context.storageState() → .auth/admin.json
  │
  ├─ (ulangi untuk lecturer) → .auth/lecturer.json
  └─ (ulangi untuk student)  → .auth/student.json

playwright.config.ts
  │
  ├─ project 'admin'   → storageState: .auth/admin.json
  ├─ project 'lecturer'→ storageState: .auth/lecturer.json
  └─ project 'student' → storageState: .auth/student.json

Saat test berjalan:
  │
  ├─ Playwright buat context baru
  ├─ Load cookies dari admin.json ke context
  ├─ page.goto('/admin/dashboard')
  │    └─ Browser kirim cookie session ke server
  │         └─ Server kenali sebagai Admin → render dashboard
  └─ Test berjalan tanpa perlu login
```

---

## Hal Penting yang Perlu Diperhatikan

**Cookie bisa kedaluwarsa.** Jika `expires` sudah lewat, server akan menolak cookie dan redirect ke `/sign-in`. Solusi: jalankan `globalSetup` ulang (otomatis terjadi setiap `npx playwright test`).

**File `.auth/` jangan di-commit ke git.** File ini berisi session token aktif. Tambahkan ke `.gitignore`:
```
.auth/
```

**`httpOnly: true` bukan halangan untuk Playwright.** Browser biasa tidak bisa membaca cookie `httpOnly` lewat JavaScript, tapi Playwright beroperasi di level CDP (Chrome DevTools Protocol) yang bisa mengakses semua cookie secara langsung — itulah mengapa `storageState()` bisa mengambilnya.
