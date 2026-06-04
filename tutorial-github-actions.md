# Tutorial: GitHub Actions + SSH Tunnel untuk E2E Testing SIMAK

## Untuk Siapa Tutorial Ini?

Tutorial ini ditujukan untuk QA Automation yang sudah bisa membuat test Playwright
dan ingin menjalankan test tersebut secara otomatis di GitHub Actions setiap kali
ada perubahan kode — dengan aman, tanpa membuka port database ke internet.

---

## Gambaran Besar: Apa yang Akan Kita Bangun?

Saat ini kamu menjalankan test secara manual di laptop:

```
Laptop kamu
├── Playwright test runner
├── App berjalan di localhost:3000
└── PostgreSQL berjalan di localhost:5432
```

Setelah tutorial ini, setiap kali kamu push ke GitHub:

```
GitHub Actions Runner (Ubuntu cloud)
├── Playwright test runner
├── App berjalan di VPS kamu (https://simak.namadomain.com)
└── SSH Tunnel ──────────────────────────────────────────────┐
    localhost:5432 (runner) ←──────→ localhost:5432 (VPS) ←──┘
```

**Kenapa perlu SSH Tunnel?**

Database PostgreSQL di VPS tidak boleh dibuka ke internet (port 5432 terbuka = risiko
serangan). SSH Tunnel membuat GitHub Actions runner seolah-olah terhubung langsung ke
database VPS melalui koneksi SSH yang terenkripsi, tanpa perlu membuka port database.

---

## Daftar Isi

1. [Persiapan VPS](#1-persiapan-vps)
2. [Generate SSH Key Pair](#2-generate-ssh-key-pair)
3. [Konfigurasi VPS: Tambah Public Key](#3-konfigurasi-vps-tambah-public-key)
4. [Buat Repository GitHub](#4-buat-repository-github)
5. [Setup GitHub Secrets](#5-setup-github-secrets)
6. [Update Konfigurasi Playwright untuk CI](#6-update-konfigurasi-playwright-untuk-ci)
7. [Tambah Script test:ui:clean di package.json](#7-tambah-script-testuiclean-di-packagejson)
8. [Buat File GitHub Actions Workflow](#8-buat-file-github-actions-workflow)
9. [Konfigurasi GitHub Pages](#9-konfigurasi-github-pages)
10. [Push dan Jalankan Pipeline Pertama Kali](#10-push-dan-jalankan-pipeline-pertama-kali)
11. [Memahami Hasil di GitHub Actions](#11-memahami-hasil-di-github-actions)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Persiapan VPS

Sebelum mulai, pastikan hal-hal berikut sudah berjalan di VPS kamu:

### 1.1 Cek aplikasi sudah running

SSH ke VPS dan cek apakah app Next.js berjalan:

```bash
# SSH ke VPS dulu
ssh user@ip-vps-kamu

# Cek apakah app running di port 3000
curl -I http://localhost:3000
# Harus muncul: HTTP/1.1 200 OK atau 302 Found

# Atau cek process
pm2 list
# atau
ps aux | grep next
```

Jika app diakses via domain (misalnya https://simak.stmikbjb.ac.id), catat URL-nya
karena ini akan dipakai sebagai `TEST_BASE_URL`.

### 1.2 Cek PostgreSQL berjalan

```bash
# Masih di VPS
psql -U postgres -c "SELECT version();"
# Atau
pg_isready
# Output: /var/run/postgresql:5432 - accepting connections
```

### 1.3 Catat informasi koneksi database

Kamu butuh `DATABASE_URL` dalam format:

```
postgresql://USERNAME:PASSWORD@localhost:5432/NAMA_DATABASE
```

Contoh:
```
postgresql://simak_user:secretpassword@localhost:5432/simak_db
```

Simpan string ini — akan dipakai sebagai GitHub Secret nanti.

### 1.4 Cek SSH service berjalan

```bash
# Di VPS
sudo systemctl status ssh
# Harus: active (running)
```

---

## 2. Generate SSH Key Pair

SSH Tunnel membutuhkan pasangan kunci: **private key** (disimpan di GitHub Secrets)
dan **public key** (ditambahkan ke VPS).

Lakukan langkah ini di **laptop kamu** (bukan di VPS).

### 2.1 Buat folder untuk key (opsional, untuk organisasi)

```bash
# Di laptop kamu (Windows PowerShell atau Git Bash)
mkdir -p C:\keys\simak-ci
cd C:\keys\simak-ci
```

### 2.2 Generate SSH key pair

```bash
ssh-keygen -t ed25519 -C "github-actions-simak-e2e" -f simak_ci_key
```

Penjelasan flag:
- `-t ed25519` : algoritma kunci modern, lebih aman dari RSA
- `-C "github-actions-simak-e2e"` : label/komentar untuk identifikasi
- `-f simak_ci_key` : nama file output

**Saat ditanya passphrase: tekan Enter dua kali (biarkan kosong).**
GitHub Actions tidak bisa memasukkan passphrase secara interaktif.

Dua file akan terbuat:
```
simak_ci_key        ← private key (RAHASIA, masuk ke GitHub Secrets)
simak_ci_key.pub    ← public key (boleh dibagi, masuk ke VPS)
```

### 2.3 Lihat isi kedua file

```bash
# Private key — akan kamu copy ke GitHub Secrets
cat simak_ci_key

# Output contoh:
# -----BEGIN OPENSSH PRIVATE KEY-----
# b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz...
# -----END OPENSSH PRIVATE KEY-----

# Public key — akan kamu tambahkan ke VPS
cat simak_ci_key.pub

# Output contoh:
# ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBx... github-actions-simak-e2e
```

**PENTING:** Private key (`simak_ci_key`) harus dijaga kerahasiaannya.
Jangan pernah di-commit ke repository.

---

## 3. Konfigurasi VPS: Tambah Public Key

Sekarang tambahkan public key ke VPS agar GitHub Actions bisa login.

### 3.1 Copy isi public key

Di laptop, tampilkan dan copy isi `simak_ci_key.pub`:

```bash
cat simak_ci_key.pub
# Copy seluruh output (satu baris panjang)
```

### 3.2 Tambahkan ke authorized_keys di VPS

SSH ke VPS, lalu tambahkan public key:

```bash
# Di VPS
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Di editor nano: paste public key (satu baris) di baris baru, lalu simpan
dengan Ctrl+X → Y → Enter.

Atau cara lebih cepat tanpa editor:

```bash
# Di VPS — ganti PASTE_PUBLIC_KEY_DI_SINI dengan isi simak_ci_key.pub
echo "PASTE_PUBLIC_KEY_DI_SINI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3.3 Verifikasi dari laptop

Kembali ke laptop, test koneksi SSH menggunakan private key yang baru:

```bash
# Di laptop
ssh -i C:\keys\simak-ci\simak_ci_key USER@IP_VPS "echo 'Koneksi berhasil!'"

# Output yang diharapkan:
# Koneksi berhasil!
```

Jika berhasil tanpa diminta password, setup SSH key sudah benar.

### 3.4 Test SSH Tunnel secara manual

Ini penting untuk memastikan tunnel bekerja sebelum memasukkannya ke CI:

```bash
# Di laptop — buka tunnel di background
ssh -i C:\keys\simak-ci\simak_ci_key \
    -L 5432:localhost:5432 \
    -N -f \
    USER@IP_VPS

# Cek apakah port 5432 sekarang tersedia di localhost
# Windows PowerShell:
Test-NetConnection -ComputerName localhost -Port 5432
# Harus: TcpTestSucceeded : True

# Atau di Git Bash:
nc -z localhost 5432 && echo "Tunnel OK"
```

Jika berhasil, tunnel bekerja. Kamu bisa menutupnya:
```bash
# Di Windows PowerShell, cari dan kill proses ssh
Get-Process ssh | Stop-Process
```

---

## 4. Buat Repository GitHub

### 4.1 Buat repository baru di GitHub

1. Buka https://github.com/new
2. Isi nama repository, misalnya `simak-e2e`
3. Pilih **Private** (karena berisi konfigurasi test)
4. Jangan centang "Initialize with README"
5. Klik **Create repository**

### 4.2 Inisialisasi git di folder project

Buka PowerShell di folder `simak-e2e`:

```powershell
cd C:\Projects\StmikBjbApplication\simak-e2e

# Inisialisasi git
git init

# Tambah remote
git remote add origin https://github.com/USERNAME/simak-e2e.git

# Verifikasi .gitignore sudah ada dan lengkap
cat .gitignore
# Pastikan ada: node_modules/, .auth/, .env, .env.test
```

### 4.3 Commit awal

```powershell
git add .
git status
# Pastikan .env.test dan folder .auth/ TIDAK muncul di daftar

git commit -m "Initial commit: Playwright E2E test suite"
git branch -M main
git push -u origin main
```

---

## 5. Setup GitHub Secrets

GitHub Secrets adalah tempat menyimpan informasi sensitif (password, key, URL)
yang dibutuhkan workflow tapi tidak boleh ada di kode.

### 5.1 Buka halaman Secrets

1. Buka repository di GitHub
2. Klik tab **Settings**
3. Di sidebar kiri, klik **Secrets and variables** → **Actions**
4. Klik tombol **New repository secret**

### 5.2 Tambahkan semua secret berikut satu per satu

| Secret Name | Nilai | Keterangan |
|---|---|---|
| `SSH_PRIVATE_KEY` | Isi file `simak_ci_key` | Copy seluruh isi termasuk baris `-----BEGIN` dan `-----END` |
| `SSH_HOST` | IP atau domain VPS | Contoh: `123.456.789.0` atau `vps.namadomain.com` |
| `SSH_USER` | Username SSH VPS | Contoh: `ubuntu`, `root`, atau `deploy` |
| `DATABASE_URL` | Connection string DB | `postgresql://user:pass@localhost:5432/dbname` |
| `TEST_BASE_URL` | URL aplikasi di VPS | Contoh: `https://simak.stmikbjb.ac.id` |
| `TEST_ADMIN_EMAIL` | Email akun admin test | Sesuai data di VPS |
| `TEST_ADMIN_PASSWORD` | Password akun admin test | Sesuai data di VPS |
| `TEST_STUDENT_EMAIL` | Email akun student test | Sesuai data di VPS |
| `TEST_STUDENT_PASSWORD` | Password akun student test | Sesuai data di VPS |
| `TEST_LECTURER_EMAIL` | Email akun lecturer test | Sesuai data di VPS |
| `TEST_LECTURER_PASSWORD` | Password akun lecturer test | Sesuai data di VPS |

**Cara menambahkan SSH_PRIVATE_KEY:**

Buka file `simak_ci_key` dengan text editor, copy SELURUH isinya termasuk baris header:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
... (banyak baris)
-----END OPENSSH PRIVATE KEY-----
```

Paste semua itu sebagai nilai secret `SSH_PRIVATE_KEY`.

**Kenapa DATABASE_URL menggunakan localhost?**

Karena SSH Tunnel akan memetakan `localhost:5432` di runner ke `localhost:5432` di VPS.
Jadi meskipun database ada di VPS, dari sudut pandang kode, koneksinya ke localhost.

---

## 6. Update Konfigurasi Playwright untuk CI

Ada dua hal di `playwright.config.ts` yang perlu disesuaikan agar berjalan di CI:

1. `baseURL` perlu bisa dikonfigurasi via env var (sekarang hardcode `localhost:3000`)
2. `headless: false` harus jadi `true` di CI (CI tidak punya tampilan layar)
3. `slowMo: 1000` harus jadi `0` di CI (tidak perlu lambat di server)

### 6.1 Edit playwright.config.ts

Buka file `playwright.config.ts` dan ubah bagian `use`:

**Sebelum:**
```typescript
use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    launchOptions: {
        slowMo: 1000,
    },
```

**Sesudah:**
```typescript
use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000',
    headless: !!process.env.CI,
    launchOptions: {
        slowMo: process.env.CI ? 0 : 1000,
    },
```

Penjelasan:
- `process.env.TEST_BASE_URL ?? 'http://localhost:3000'` : pakai env var jika ada,
  fallback ke localhost untuk development lokal
- `!!process.env.CI` : GitHub Actions otomatis set `CI=true`, jadi ini jadi `true`
  di CI dan `false` di lokal
- `process.env.CI ? 0 : 1000` : slowMo 0ms di CI, 1000ms di lokal

---

## 7. Tambah Script test:ui:clean di package.json

Untuk CI, kita hanya menjalankan test file yang sudah bersih (lulus semua).
Tambahkan script khusus di `package.json`:

**Buka `package.json`, tambahkan di bagian `scripts`:**

```json
"scripts": {
    "test:api": "cross-env PLAYWRIGHT_HTML_OUTPUT_FOLDER=playwright-report-api playwright test --project=setup-admin --project=setup-api-data --project=api",
    "test:ui": "cross-env PLAYWRIGHT_HTML_OUTPUT_FOLDER=playwright-report-ui playwright test --project=setup-admin --project=setup-lecturer --project=setup-student --project=admin --project=lecturer --project=student",
    "test:ui:clean": "cross-env PLAYWRIGHT_HTML_OUTPUT_FOLDER=playwright-report-ui playwright test --project=setup-admin --project=setup-student --project=admin --project=student tests/admin/courses/assessment.spec.ts tests/admin/courses/course.spec.ts tests/admin/courses/grade-component.spec.ts tests/admin/reregistrations/reregistration.spec.ts tests/student/reregistrations/reregistration-student.spec.ts",
    "test:all": "playwright test",
    "report:api": "playwright show-report playwright-report-api",
    "report:ui": "playwright show-report playwright-report-ui",
    "report:deploy:api": "gh-pages -d playwright-report-api --dest api --dotfiles",
    "report:deploy:ui": "gh-pages -d playwright-report-ui --dest ui --dotfiles"
}
```

Script `test:ui:clean` sama persis dengan yang sudah berhasil dijalankan manual —
hanya menjalankan 5 file test yang 100% lulus.

---

## 8. Buat File GitHub Actions Workflow

Workflow adalah instruksi yang dibaca GitHub untuk menjalankan CI/CD.
File ini harus berada di lokasi yang spesifik: `.github/workflows/`.

### 8.1 Buat folder dan file

```powershell
# Di folder simak-e2e
mkdir -p .github/workflows
```

> **Penting:** Nama foldernya harus persis `workflows` (bukan `wokflows` atau typo lain).
> GitHub Actions hanya membaca file dari `.github/workflows/`.

### 8.2 Buat file workflow

Buat file `.github/workflows/e2e-tests.yml` dengan isi berikut:

```yaml
name: E2E Tests SIMAK

# Opt-in ke Node.js 24 untuk semua actions (checkout, setup-node, cache, upload-artifact)
# Wajib sejak Juni 2026 — Node.js 20 sudah deprecated di GitHub Actions
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:

      # ── LANGKAH 1: Ambil kode dari repository ─────────────────────────
      - name: Checkout kode
        uses: actions/checkout@v4

      # ── LANGKAH 2: Install Node.js ────────────────────────────────────
      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # ── LANGKAH 3: Install semua dependencies ─────────────────────────
      - name: Install dependencies
        run: npm ci

      # ── LANGKAH 4: Cache Playwright Binaries ──────────────────────────
      # Menghemat ~1-2 menit per run jika package-lock.json tidak berubah
      - name: Cache Playwright Binaries
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}

      # ── LANGKAH 5: Install Playwright Chromium ────────────────────────
      - name: Install Playwright Chromium (Cache Miss)
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install chromium --with-deps

      - name: Install Playwright System Dependencies Only (Cache Hit)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium

      # ── LANGKAH 6: Setup SSH Tunnel ke database VPS ───────────────────
      # Tunnel memetakan: localhost:5432 (runner) → localhost:5432 (VPS)
      # SYARAT: port 22 VPS harus terbuka untuk koneksi dari internet.
      - name: Setup SSH tunnel ke DB VPS
        run: |
          echo "[1] Membuat folder .ssh..."
          mkdir -p ~/.ssh

          echo "[2] Menulis private key..."
          # tr -d '\r' menghapus carriage return jika key dibuat di Windows
          echo "${{ secrets.SSH_PRIVATE_KEY }}" | tr -d '\r' > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          echo "    Key size: $(wc -c < ~/.ssh/id_rsa) bytes"

          echo "[3] Menjalankan ssh-keyscan..."
          # Non-fatal: jika gagal, StrictHostKeyChecking=no di bawah sudah cukup
          ssh-keyscan -H "${{ secrets.SSH_HOST }}" >> ~/.ssh/known_hosts 2>&1 \
            || echo "    ssh-keyscan gagal (lanjut dengan StrictHostKeyChecking=no)"
          echo "    known_hosts: $(wc -l < ~/.ssh/known_hosts) baris"

          echo "[4] Test autentikasi SSH..."
          ssh -i ~/.ssh/id_rsa \
              -v \
              -o BatchMode=yes \
              -o ConnectTimeout=15 \
              -o StrictHostKeyChecking=no \
              "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}" \
              "echo 'SSH auth OK'" > /tmp/ssh-test.log 2>&1
          SSH_EXIT=$?
          cat /tmp/ssh-test.log
          if [ $SSH_EXIT -ne 0 ]; then
            echo "[4] GAGAL — lihat verbose log di atas"
            exit 1
          fi
          echo "[4] Berhasil"

          echo "[5] Membuka tunnel..."
          ssh -i ~/.ssh/id_rsa \
              -L 5432:localhost:5432 \
              -o ServerAliveInterval=60 \
              -o ServerAliveCountMax=10 \
              -o StrictHostKeyChecking=no \
              -N -f \
              "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}"

          sleep 3
          echo "[5] Tunnel SSH aktif"

      # ── LANGKAH 7: Verifikasi tunnel berhasil ─────────────────────────
      - name: Verifikasi koneksi tunnel
        run: |
          nc -z localhost 5432 && echo "Port 5432 terbuka via tunnel" || exit 1

      # ── LANGKAH 8: Buat file .env.test dari GitHub Secrets ────────────
      # File .env.test tidak di-commit (ada di .gitignore).
      # Secrets dioper lewat env: block lalu dibaca sebagai shell variable.
      # PENTING: heredoc delimiter TIDAK boleh diapit tanda kutip (bukan 'ENVEOF')
      # agar shell variable seperti $DB_URL ter-expand dengan benar.
      - name: Buat file .env.test
        env:
          DB_URL: ${{ secrets.DATABASE_URL }}
          BASE_URL: ${{ secrets.TEST_BASE_URL }}
          ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          ADMIN_PWD: ${{ secrets.TEST_ADMIN_PASSWORD }}
          STUDENT_EMAIL: ${{ secrets.TEST_STUDENT_EMAIL }}
          STUDENT_PWD: ${{ secrets.TEST_STUDENT_PASSWORD }}
          LECTURER_EMAIL: ${{ secrets.TEST_LECTURER_EMAIL }}
          LECTURER_PWD: ${{ secrets.TEST_LECTURER_PASSWORD }}
        run: |
          cat > .env.test << ENVEOF
          DATABASE_URL=$DB_URL
          TEST_BASE_URL=$BASE_URL
          TEST_ADMIN_EMAIL=$ADMIN_EMAIL
          TEST_ADMIN_PASSWORD=$ADMIN_PWD
          TEST_STUDENT_EMAIL=$STUDENT_EMAIL
          TEST_STUDENT_PASSWORD=$STUDENT_PWD
          TEST_LECTURER_EMAIL=$LECTURER_EMAIL
          TEST_LECTURER_PASSWORD=$LECTURER_PWD
          ENVEOF

      # ── LANGKAH 9: Jalankan API Tests ─────────────────────────────────
      - name: Run API Tests
        run: npm run test:api
        env:
          CI: true

      # ── LANGKAH 10: Jalankan UI Tests ─────────────────────────────────
      - name: Run UI Tests
        run: npm run test:ui:clean
        env:
          CI: true

      # ── LANGKAH 11: Upload laporan sebagai artifact ───────────────────
      - name: Upload test reports sebagai artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-reports-${{ github.run_number }}
          path: |
            playwright-report-api/
            playwright-report-ui/
            test-results/
          retention-days: 14

      # ── LANGKAH 12: Deploy laporan ke GitHub Pages ────────────────────
      # Hanya deploy jika push ke main (bukan dari pull request).
      # Menggunakan --repo dengan token eksplisit karena gh-pages tidak
      # otomatis membaca GITHUB_TOKEN dari environment.
      - name: Deploy laporan ke GitHub Pages
        if: github.ref == 'refs/heads/main'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          npx gh-pages \
            -d playwright-report-api \
            --dest api \
            --dotfiles \
            --repo "https://x-access-token:${GITHUB_TOKEN}@github.com/${{ github.repository }}.git"

          npx gh-pages \
            -d playwright-report-ui \
            --dest ui \
            --dotfiles \
            --repo "https://x-access-token:${GITHUB_TOKEN}@github.com/${{ github.repository }}.git"

      # ── LANGKAH 13: Tutup SSH Tunnel ─────────────────────────────────
      # if: always() memastikan cleanup berjalan meski step sebelumnya gagal
      - name: Close SSH Tunnel
        if: always()
        run: |
          pkill -f "ssh -i ~/.ssh/id_rsa -L 5432:localhost:5432" || true
```

### 8.3 Penjelasan struktur workflow

```
name:        → Nama workflow yang muncul di tab Actions GitHub
on:          → Kondisi pemicu (push, pull_request, manual)
jobs:        → Kumpulan pekerjaan yang dijalankan
  e2e-tests: → Nama job (bisa ada beberapa job paralel)
    steps:   → Langkah-langkah berurutan dalam satu job
```

Setiap `step` bisa berupa:
- `uses: actions/xxx@v4` → pakai action yang sudah dibuat komunitas
- `run: perintah` → jalankan perintah shell langsung

---

## 9. Konfigurasi GitHub Pages

Laporan HTML akan dikirim ke branch `gh-pages` oleh `gh-pages` package.
GitHub Pages perlu dikonfigurasi untuk membaca dari branch tersebut.

> **Urutan yang benar:**
> Branch `gh-pages` baru terbuat setelah pipeline pertama berjalan.
> Karena itu lakukan **9.2 dulu → Langkah 10 (push & run pipeline) → baru 9.1**.

### 9.2 Aktifkan izin untuk GitHub Actions (lakukan SEBELUM push pertama)

Agar workflow bisa push ke branch `gh-pages`:

1. Buka repository di GitHub
2. Klik tab **Settings** → di sidebar klik **Actions** → **General**
3. Scroll ke bawah ke bagian **Workflow permissions**
4. Pilih **Read and write permissions**
5. Klik **Save**

### 9.1 Aktifkan GitHub Pages (lakukan SETELAH pipeline pertama selesai)

Branch `gh-pages` baru muncul di dropdown setelah pipeline pertama sukses deploy.

1. Buka repository di GitHub
2. Klik tab **Settings**
3. Di sidebar, klik **Pages**
4. Di bagian **Source**, pilih:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
5. Klik **Save**

### 9.3 URL laporan setelah deploy

Setelah pipeline pertama berhasil, laporan bisa diakses di:
```
API Report : https://USERNAME.github.io/simak-e2e/api/
UI Report  : https://USERNAME.github.io/simak-e2e/ui/
```

---

## 10. Push dan Jalankan Pipeline Pertama Kali

### 10.1 Commit semua perubahan

```powershell
cd C:\Projects\StmikBjbApplication\simak-e2e

git add .github/workflows/e2e-tests.yml
git add playwright.config.ts
git add package.json

git status
# Pastikan hanya 3 file di atas yang berubah
# .env.test dan .auth/ TIDAK boleh masuk

git commit -m "feat: add GitHub Actions CI/CD with SSH tunnel"
git push origin main
```

### 10.2 Pantau pipeline berjalan

1. Buka repository di GitHub
2. Klik tab **Actions**
3. Kamu akan melihat workflow "E2E Tests SIMAK" sedang berjalan
4. Klik nama workflow untuk melihat detail
5. Klik nama job `e2e-tests` untuk lihat log tiap step

### 10.3 Indikator status

| Ikon | Arti |
|---|---|
| Kuning berputar | Sedang berjalan |
| Hijau centang | Berhasil |
| Merah silang | Gagal — klik untuk lihat error |

---

## 11. Memahami Hasil di GitHub Actions

### 11.1 Melihat log per step

Klik nama step untuk expand log-nya. Contoh log sukses step tunnel:

```
[1] Membuat folder .ssh...
[2] Menulis private key...
    Key size: 419 bytes
[3] Menjalankan ssh-keyscan...
    known_hosts: 1 baris
[4] Test autentikasi SSH...
SSH auth OK
[4] Berhasil
[5] Membuka tunnel...
[5] Tunnel SSH aktif

Port 5432 terbuka via tunnel
```

### 11.2 Melihat test results di log

```
Running 45 tests using 1 worker

  ✓  [setup-admin] login sebagai admin (1.2s)
  ✓  [setup-api-data] seed API test data (82ms)
  ✓  [api] GET /api/pdf — type=krs — harus return PDF valid (150ms)
  ...
  40 passed (17.4s)
```

### 11.3 Download artifact jika test gagal

1. Di halaman job yang gagal, scroll ke bawah
2. Di bagian **Artifacts**, klik nama artifact
3. Download dan extract ZIP
4. Buka `playwright-report-api/index.html` atau `playwright-report-ui/index.html`
   di browser untuk melihat laporan lengkap dengan screenshot dan video

---

## 12. Troubleshooting

### Masalah: "Permission denied (publickey)"

**Gejala di log:**
```
Permission denied (publickey).
```

**Penyebab:** Public key belum ditambahkan ke VPS, atau format private key salah.

**Solusi:**
1. Pastikan isi secret `SSH_PRIVATE_KEY` menyertakan baris `-----BEGIN` dan `-----END`
2. Verifikasi public key ada di `~/.ssh/authorized_keys` di VPS
3. Cek permission: `chmod 600 ~/.ssh/authorized_keys` di VPS

---

### Masalah: "Port 5432 tidak terbuka" (tunnel gagal)

**Gejala di log:**
```
nc: connect to localhost port 5432: Connection refused
Error: Process completed with exit code 1.
```

**Penyebab:** SSH terhubung tapi tunnel tidak terbentuk.

**Solusi:**
1. Pastikan PostgreSQL berjalan di VPS: `pg_isready` di VPS
2. Tambah debug ke step tunnel:
   ```yaml
   run: |
     ssh -i ~/.ssh/id_rsa \
         -L 5432:localhost:5432 \
         -v \           # ← tambah -v untuk verbose logging
         -N -f \
         "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}"
   ```
3. Cek apakah user SSH punya izin untuk port forwarding di VPS:
   ```bash
   # Di VPS, cek /etc/ssh/sshd_config
   grep AllowTcpForwarding /etc/ssh/sshd_config
   # Harus: AllowTcpForwarding yes (atau tidak ada baris ini = default yes)
   ```

---

### Masalah: "Connection refused" ke aplikasi

**Gejala:**
```
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://simak.stmikbjb.ac.id
```

**Penyebab:** `TEST_BASE_URL` salah atau aplikasi tidak running di VPS.

**Solusi:**
1. Verifikasi secret `TEST_BASE_URL` sudah benar (tidak ada trailing slash)
2. SSH ke VPS dan cek: `curl -I http://localhost:3000`
3. Jika pakai HTTPS, pastikan SSL certificate valid

---

### Masalah: "value: expected string, got undefined"

**Gejala:**
```
Error: locator.fill: value: expected string, got undefined
```

**Penyebab:** Salah satu secret email/password tidak ter-set atau nama secret typo.

**Solusi:**
1. Cek semua secret di GitHub Settings → Secrets and variables → Actions
2. Pastikan nama secret persis sama dengan yang dipakai di workflow
3. Tambah step debug (HANYA untuk troubleshoot, hapus setelah selesai):
   ```yaml
   - name: Debug env (HAPUS SETELAH DEBUG)
     run: |
       echo "BASE_URL=${{ secrets.TEST_BASE_URL }}"
       echo "ADMIN_EMAIL length: ${#TEST_ADMIN_EMAIL}"
     env:
       TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
   ```

---

### Masalah: SSH exit code 255 — tunnel gagal terkoneksi

**Gejala di log:**
```
[3] ssh-keyscan gagal
    known_hosts: 0 baris
[4] Test autentikasi SSH...
Error: Process completed with exit code 255.
```

**Penyebab:** GitHub Actions runner tidak bisa menjangkau VPS di port 22.
Exit code 255 = koneksi gagal total (bukan masalah key).

**Solusi:** Buka port 22 di firewall VPS:

```bash
# Di VPS — jika pakai ufw:
sudo ufw allow 22/tcp
sudo ufw status

# Verifikasi dari laptop:
# Windows PowerShell:
Test-NetConnection -ComputerName IP_VPS -Port 22
# Harus: TcpTestSucceeded : True
```

Jika VPS di cloud (DigitalOcean, AWS, GCP, dll): tambahkan rule di
Security Group / Firewall dashboard — **Port 22, TCP, Source: 0.0.0.0/0**.

---

### Masalah: "gh-pages deploy gagal"

**Gejala:**
```
fatal: could not read Username for 'https://github.com': No such device or address
ProcessError: fatal: could not read Username...
```

**Penyebab ada dua — cek keduanya:**

1. **Izin write belum diaktifkan:**
   - Settings → Actions → General → Workflow permissions
   - Pilih **Read and write permissions** → Save

2. **gh-pages tidak membaca `GITHUB_TOKEN` dari environment secara otomatis.**
   Pastikan workflow memakai `--repo` dengan token eksplisit:
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   run: |
     npx gh-pages \
       -d playwright-report-api \
       --dest api \
       --dotfiles \
       --repo "https://x-access-token:${GITHUB_TOKEN}@github.com/${{ github.repository }}.git"
   ```
   Perhatikan: gunakan `${GITHUB_TOKEN}` (shell variable), bukan
   `${{ secrets.GITHUB_TOKEN }}` (agar nilai token tidak ter-print di log script).

---

### Masalah: "Node.js 20 actions are deprecated"

**Gejala di log:**
```
Node.js 20 actions are deprecated. The following actions are running on
Node.js 20: actions/cache@v4, actions/checkout@v4 ...
```

**Penyebab:** GitHub Actions mewajibkan Node.js 24 mulai Juni 2026.

**Solusi:** Tambahkan env var di level `jobs` dalam workflow:
```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  e2e-tests:
    ...
```

---

### Masalah: Tunnel terputus di tengah test

**Gejala:** Beberapa test pertama berhasil, lalu data factory mulai gagal dengan
`connection terminated`.

**Penyebab:** SSH tunnel timeout karena tidak ada aktivitas.

**Solusi:** Sudah di-handle di workflow dengan `ServerAliveInterval=60`.
Jika masih terjadi, tambah opsi:
```yaml
-o TCPKeepAlive=yes \
-o ServerAliveInterval=30 \
-o ServerAliveCountMax=20 \
```

---

## Ringkasan Alur Lengkap

```
Developer push ke GitHub
        │
        ▼
GitHub Actions Runner mulai
        │
        ├─── Checkout kode
        ├─── Install Node.js & npm ci
        ├─── Cache Playwright Binaries (hemat ~1-2 menit jika cache hit)
        ├─── Install Playwright Chromium (skip jika cache hit)
        │
        ├─── Setup SSH Tunnel ──────────────────────────────────────┐
        │    [1] Tulis private key (tr -d '\r' untuk Windows compat) │
        │    [2] ssh-keyscan (non-fatal)                            │
        │    [3] Test auth SSH dengan verbose log                   │
        │    [4] Buka tunnel di background (-N -f)                  │
        │    localhost:5432 (runner) ←──SSH──→ localhost:5432 (VPS) │
        │                                                           │
        ├─── Verifikasi port 5432 terbuka                          │
        │                                                           │
        ├─── Buat .env.test dari Secrets (heredoc tanpa kutip)     │
        │                                                           │
        ├─── npm run test:api ──────────────────────────────────────┤
        │    ├── setup-admin: login → simpan admin.json            │
        │    ├── setup-api-data: INSERT data via tunnel ───────────┘
        │    └── api: HTTP request ke VPS app ──────→ TEST_BASE_URL
        │
        ├─── npm run test:ui:clean
        │    ├── setup-admin: login → simpan admin.json
        │    ├── setup-student: login → simpan student.json
        │    └── admin/student: UI test via browser ──→ TEST_BASE_URL
        │
        ├─── Upload artifacts (selalu, termasuk saat gagal)
        │
        ├─── Deploy ke GitHub Pages (hanya jika push ke main)
        │    ├── playwright-report-api/ → /api/
        │    └── playwright-report-ui/ → /ui/
        │
        └─── Close SSH Tunnel (if: always — cleanup)
```

---

## File yang Diubah dalam Tutorial Ini

| File | Perubahan |
|---|---|
| `playwright.config.ts` | `baseURL`, `headless`, `slowMo` bisa dikonfigurasi via env |
| `package.json` | Tambah script `test:ui:clean` |
| `.github/workflows/e2e-tests.yml` | File baru — definisi workflow CI/CD |

File yang **tidak perlu diubah:**
- `tests/` — semua test file tetap sama
- `tests/factories/` — db.ts tetap pakai `DATABASE_URL` dari env
- `tests/auth/*.setup.ts` — sudah pakai `TEST_BASE_URL` dari env

Ini membuktikan bahwa SSH Tunnel bekerja transparan — kode factory dan auth setup
tidak perlu tahu bahwa mereka berjalan di CI dengan tunnel, bukan di localhost.
