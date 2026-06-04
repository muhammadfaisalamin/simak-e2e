# Tutorial: Test Automation Modul Grade Component

Tutorial ini menjelaskan secara runut dan detail cara membuat test E2E untuk modul **Grade Component (Komponen Nilai)** menggunakan Playwright dengan pola Page Object Model (POM). Mulai dari analisis aplikasi hingga semua test berhasil 18/18 passed.

---

## Daftar Isi

1. [Analisis Aplikasi](#1-analisis-aplikasi)
2. [Struktur File yang Dibuat](#2-struktur-file-yang-dibuat)
3. [Membuat Page Object Model](#3-membuat-page-object-model)
4. [Membuat Test File](#4-membuat-test-file)
5. [Masalah yang Ditemukan dan Cara Memperbaiki](#5-masalah-yang-ditemukan-dan-cara-memperbaiki)
6. [Menjalankan Test](#6-menjalankan-test)
7. [Referensi Selector Penting](#7-referensi-selector-penting)

---

## 1. Analisis Aplikasi

Sebelum menulis satu baris test pun, analisis aplikasi yang akan ditest adalah langkah pertama dan paling penting.

### 1.1 Analisis Schema Database

Buka file `simak-sb/prisma/schema.prisma` dan temukan model `GradeComponent`:

```prisma
model GradeComponent {
  id               String             @id @default(uuid())
  name             String?            @unique   ← wajib unik
  acronym          String?            @unique   ← wajib unik
  assessmentDetail AssessmentDetail[]

  @@map("sb25_grade_components")
}
```

Informasi penting dari schema:
- Field `name` dan `acronym` keduanya wajib **unik** di seluruh database
- Kedua field bersifat `String?` (nullable di level database, tapi divalidasi wajib isi di level aplikasi)
- Model ini berelasi dengan `AssessmentDetail` — artinya data yang sudah dipakai di assessment tidak bisa dihapus begitu saja (constraint `onDelete: Restrict`)

### 1.2 Analisis Halaman

Buka `simak-sb/src/app/(dashboard)/list/courses/@tab/grade-component/page.tsx`:

**URL halaman:** `/list/courses/grade-component`

Halaman ini adalah **Next.js parallel route** (folder `@tab`) sehingga URL-nya menjadi `/list/courses/grade-component`.

**Fitur yang ada di halaman:**
- Heading: "Komponen Nilai"
- Search bar (`TableSearch` component)
- Tombol Create (bulat, ikon `create.svg`)
- Tabel dengan kolom: Komponen Nilai, Akronim, Actions
- Setiap baris punya tombol Update dan Delete
- Pagination

**Struktur setiap baris tabel:**
```tsx
<tr>
  <td>
    <h3>{item.name}</h3>          ← nama ada di sini
    {/* Mobile: tombol update + delete tersembunyi di md */}
    <div className="md:hidden">
      <button>update</button>
      <button>delete</button>
    </div>
  </td>
  <td className="hidden md:table-cell">{item.acronym}</td>
  <td>
    {/* Desktop: tombol update + delete */}
    <div className="hidden md:flex">
      <button>update</button>
      <button>delete</button>
    </div>
  </td>
</tr>
```

> **Catatan penting:** Setiap baris punya **DUA set tombol** — satu untuk mobile (tersembunyi di layar besar) dan satu untuk desktop. Ini akan jadi masalah saat menulis selector.

### 1.3 Analisis Form

Buka `simak-sb/src/component/forms/GradeForm.tsx`:

```tsx
<form onSubmit={onSubmit}>
  <h1>{type === "create" ? "Tambah data komponen nilai baru" : "Ubah data komponen nilai"}</h1>
  
  <input name="name" />         ← field Komponen Nilai
  <input name="acronym" />      ← field Akronim
  
  {state?.error && <span className="text-xs text-red-400">{state.message}</span>}
  
  <button>
    {type === "create" ? "Tambah" : "Ubah"}
  </button>
</form>
```

**Validasi (dari `formValidationSchema.ts`):**
```typescript
export const gradeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: "Nama komponen nilai harus diisi" }),
  acronym: z.string().min(1, { message: "Akronim komponen nilai harus diisi" }),
})
```

Ada dua jenis error:
1. **Validasi client-side (Zod):** muncul di bawah masing-masing field, teks: `"Nama komponen nilai harus diisi"` atau `"Akronim komponen nilai harus diisi"`
2. **Error server-side:** muncul di `span.text-xs.text-red-400` di bawah form (misalnya saat duplicate)

### 1.4 Analisis Modal

Buka `simak-sb/src/component/FormModal.tsx`:

Modal dirender secara kondisional — **hanya ada di DOM saat `open === true`**:
```tsx
{open && (
  <div className="w-screen h-screen fixed z-9999 ...">
    <div className="bg-white p-4 relative ...">
      <Form />
      <div className="absolute top-4 right-4 cursor-pointer" onClick={() => setOpen(false)}>
        <Image src="/close.png" alt="" />   ← tombol close (div, bukan button)
      </div>
    </div>
  </div>
)}
```

Tombol aksi (create/update/delete) dirender dengan ikon SVG:
- Create: `img[alt="icon-create"]`
- Update: `img[alt="icon-update"]`
- Delete: `img[alt="icon-delete"]`

### 1.5 Analisis Search

Buka `simak-sb/src/component/TableSearch.tsx`:

```tsx
<form onSubmit={handleSubmit}>
  <input
    type="search"
    placeholder="Search..."
  />
</form>
```

Search bekerja dengan menambahkan `?search=nilai` ke URL dan me-reload halaman (server-side filtering). Saat form disubmit, `router.push()` dipanggil dengan URL baru.

---

## 2. Struktur File yang Dibuat

```
simak-e2e/
└── tests/
    └── admin/
        ├── courses/
        │   └── grade-component.spec.ts    ← file test
        └── pages/
            └── GradeComponentPage.ts      ← Page Object Model
```

Buat folder terlebih dahulu:
```powershell
New-Item -ItemType Directory -Force "tests\admin\courses"
New-Item -ItemType Directory -Force "tests\admin\pages"
```

---

## 3. Membuat Page Object Model

File: `tests/admin/pages/GradeComponentPage.ts`

POM adalah kelas yang mengenkapsulasi semua **selector** dan **aksi** untuk satu halaman. Test file tidak boleh berisi selector langsung — semua melalui POM.

### 3.1 Struktur Dasar POM

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class GradeComponentPage {
  readonly page: Page;
  static readonly URL = '/list/courses/grade-component';

  // Deklarasikan semua locator sebagai property
  readonly pageHeading: Locator;
  readonly searchInput: Locator;
  // ... dll

  constructor(page: Page) {
    this.page = page;
    // Inisialisasi semua locator di sini
    this.pageHeading = page.getByRole('heading', { name: 'Komponen Nilai' });
    // ...
  }
}
```

### 3.2 Semua Locator dan Alasannya

```typescript
constructor(page: Page) {
  this.page = page;

  // Heading halaman — dipakai untuk konfirmasi halaman sudah dimuat
  this.pageHeading = page.getByRole('heading', { name: 'Komponen Nilai' });

  // Search input — type="search" adalah atribut dari komponen TableSearch
  this.searchInput = page.locator('input[type="search"]');

  // Modal overlay — div.fixed muncul di DOM saat modal terbuka
  this.modalOverlay = page.locator('div.fixed');

  // Tombol close modal — ini adalah div, bukan button (lihat FormModal.tsx)
  this.modalCloseButton = page.locator('div.absolute.top-4.right-4');

  // Field form — hanya ada di DOM saat modal terbuka
  this.nameInput    = page.locator('input[name="name"]');
  this.acronymInput = page.locator('input[name="acronym"]');

  // Tombol submit — regex /^(Tambah|Ubah)$/ cocok teks persis "Tambah" atau "Ubah"
  this.submitButton = page.getByRole('button', { name: /^(Tambah|Ubah)$/ });

  // Error server-side di bawah form (bukan error field per-field)
  this.inlineFormError = page.locator('form span.text-red-400');

  // Tombol konfirmasi hapus
  this.deleteConfirmButton = page.getByRole('button', { name: 'Hapus' });

  // Teks peringatan di modal delete
  this.deleteWarningText = page.getByText(/apakah anda yakin ingin menghapus/i);

  // Baris tabel
  this.tableRows = page.locator('table tbody tr');
}
```

### 3.3 Locator Dinamis (Bergantung pada Nama Baris)

Beberapa locator tidak bisa dideklarasikan di constructor karena bergantung pada parameter runtime. Ini dijadikan **method** yang mengembalikan `Locator`:

```typescript
// Tombol create — identifikasi lewat alt text ikon
createButton(): Locator {
  return this.page.locator('button:has(img[alt="icon-create"])');
}

// Tombol update di baris tertentu
// PENTING: target td:last-child untuk menghindari duplikasi mobile/desktop
updateButtonInRow(rowName: string): Locator {
  return this.page
    .locator('tr')
    .filter({ hasText: rowName })
    .locator('td:last-child button:has(img[alt="icon-update"])');
}

// Tombol delete di baris tertentu
deleteButtonInRow(rowName: string): Locator {
  return this.page
    .locator('tr')
    .filter({ hasText: rowName })
    .locator('td:last-child button:has(img[alt="icon-delete"])');
}

// Baris berdasarkan nama — gunakan text-is() untuk exact match
rowByName(name: string): Locator {
  return this.page.locator('tr').filter({
    has: this.page.locator(`h3:text-is("${name}")`),
  });
}
```

### 3.4 Method Navigasi

```typescript
// Navigasi biasa ke halaman tanpa filter
async goto(): Promise<void> {
  await this.page.goto(GradeComponentPage.URL);
  await this.pageHeading.waitFor({ state: 'visible' });
}

// Navigasi dengan search query aktif — gunakan ini setelah create
// agar data yang baru dibuat langsung terlihat tanpa terkena pagination
async gotoFiltered(query: string): Promise<void> {
  await this.page.goto(
    `${GradeComponentPage.URL}?search=${encodeURIComponent(query)}`,
  );
  await this.pageHeading.waitFor({ state: 'visible' });
  await this.page.waitForLoadState('networkidle');
}
```

### 3.5 Method Interaksi

```typescript
// Buka modal create — tunggu nameInput muncul sebagai tanda modal siap
async openCreateModal(): Promise<void> {
  await this.createButton().click();
  await this.nameInput.waitFor({ state: 'visible' });
}

// Buka modal update untuk baris tertentu
async openUpdateModal(rowName: string): Promise<void> {
  await this.updateButtonInRow(rowName).click();
  await this.nameInput.waitFor({ state: 'visible' });
}

// Buka modal delete untuk baris tertentu
async openDeleteModal(rowName: string): Promise<void> {
  await this.deleteButtonInRow(rowName).click();
  await this.deleteConfirmButton.waitFor({ state: 'visible' });
}

// Tutup modal lewat tombol X
async closeModal(): Promise<void> {
  await this.modalCloseButton.click();
  await this.nameInput.waitFor({ state: 'hidden' });
}

// Isi field satu per satu
async fillName(value: string): Promise<void> {
  await this.nameInput.clear();
  await this.nameInput.fill(value);
}

async fillAcronym(value: string): Promise<void> {
  await this.acronymInput.clear();
  await this.acronymInput.fill(value);
}

// Isi semua field sekaligus
async fillForm(data: { name: string; acronym: string }): Promise<void> {
  await this.fillName(data.name);
  await this.fillAcronym(data.acronym);
}

async submitForm(): Promise<void> {
  await this.submitButton.click();
}
```

### 3.6 Method Aksi Tingkat Tinggi (Composite)

Method ini menggabungkan beberapa langkah menjadi satu operasi utuh:

```typescript
// Create lengkap — buka modal, isi form, submit, tunggu modal tutup
async createGradeComponent(name: string, acronym: string): Promise<void> {
  await this.openCreateModal();
  await this.fillForm({ name, acronym });
  await this.submitForm();
  await this.nameInput.waitFor({ state: 'hidden' }); // tunggu modal tutup
}

// Update lengkap
async updateGradeComponent(
  existingName: string,
  newData: { name: string; acronym: string },
): Promise<void> {
  await this.openUpdateModal(existingName);
  await this.fillForm(newData);
  await this.submitForm();
  await this.nameInput.waitFor({ state: 'hidden' });
}

// Delete lengkap — buka modal konfirmasi, klik Hapus, tunggu modal tutup
async deleteGradeComponent(rowName: string): Promise<void> {
  await this.openDeleteModal(rowName);
  await this.deleteConfirmButton.click();
  await this.deleteConfirmButton.waitFor({ state: 'hidden' });
}

// Search via search bar
async search(query: string): Promise<void> {
  await this.searchInput.fill(query);
  await this.searchInput.press('Enter');
  await this.page.waitForLoadState('networkidle');
}
```

### 3.7 Method Assertion Helper

```typescript
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

// Cek error pesan validasi per-field
async assertFieldError(message: string): Promise<void> {
  await expect(this.page.getByText(message)).toBeVisible();
}

// Cek error server-side di bawah form
async assertInlineFormError(): Promise<void> {
  await expect(this.inlineFormError).toBeVisible();
}

async assertTableEmpty(): Promise<void> {
  await expect(this.tableRows).toHaveCount(0);
}
```

---

## 4. Membuat Test File

File: `tests/admin/courses/grade-component.spec.ts`

### 4.1 Import dan Data Test

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { GradeComponentPage } from '../pages/GradeComponentPage';

// RUN_ID unik per test run — mencegah konflik data antar run
const RUN_ID = Date.now().toString().slice(-7);
```

**Aturan data test:** Setiap test harus punya data uniknya sendiri. Jangan berbagi data antar test, karena test yang dijalankan duluan akan membuat data tersebut, dan test kedua yang mencoba membuat data yang sama akan gagal karena constraint unique.

```typescript
const data = {
  create:    { name: `Tugas Harian ${RUN_ID}`,  acronym: `TH${RUN_ID}` },
  display:   { name: `Display Tes ${RUN_ID}`,   acronym: `DP${RUN_ID}` },
  search:    { name: `Kuis Mingguan ${RUN_ID}`,  acronym: `KM${RUN_ID}` },
  preUpdate: { name: `Pre Update ${RUN_ID}`,     acronym: `PU${RUN_ID}` },
  deleteOpen:{ name: `Del Modal ${RUN_ID}`,      acronym: `DM${RUN_ID}` },
  delete:    { name: `To Delete ${RUN_ID}`,      acronym: `TD${RUN_ID}` },
  duplicateName: {
    name: `Duplikat Nama ${RUN_ID}`, acronym: `DN${RUN_ID}`, acronymAlt: `DNA${RUN_ID}`,
  },
  duplicateAcronym: {
    name: `Duplikat Akronim ${RUN_ID}`, acronym: `DA${RUN_ID}`, nameAlt: `Duplikat Akronim Alt ${RUN_ID}`,
  },
  conflictA: { name: `Konflik A ${RUN_ID}`, acronym: `KA${RUN_ID}` },
  conflictB: { name: `Konflik B ${RUN_ID}`, acronym: `KB${RUN_ID}` },
};
```

### 4.2 Struktur Describe dan beforeEach

```typescript
test.describe('Grade Component Management', () => {
  let gradeComponentPage: GradeComponentPage;

  // beforeEach dijalankan sebelum setiap test — inisialisasi POM dan navigasi
  test.beforeEach(async ({ page }) => {
    gradeComponentPage = new GradeComponentPage(page);
    await gradeComponentPage.goto();
  });

  test.describe('Positive Scenarios', () => {
    // test positif di sini
  });

  test.describe('Negative Scenarios', () => {
    // test negatif di sini
  });
});
```

### 4.3 Skenario Positif (10 Test)

| # | Nama Test | Yang Diverifikasi |
|---|---|---|
| 1 | should load the grade component page | Heading visible, URL benar |
| 2 | should open the create modal | Modal title, semua field, tombol submit |
| 3 | should create a new grade component | Modal tutup, data muncul di tabel |
| 4 | should display correct acronym | Baris tampil dengan nama dan akronim yang benar |
| 5 | should find via search | Filter search menampilkan data yang dicari |
| 6 | should open update modal pre-filled | Modal terbuka dengan nilai lama terisi |
| 7 | should update name and acronym | Nama lama hilang, nama baru muncul |
| 8 | should open delete confirmation modal | Pesan peringatan muncul |
| 9 | should delete and remove from table | Data tidak ada lagi setelah dihapus |
| 10 | should close modal without saving | Modal tutup, data tidak tersimpan |
| 11 | should return empty results for non-matching query | Tabel kosong |

### 4.4 Skenario Negatif (7 Test)

| # | Nama Test | Yang Diverifikasi |
|---|---|---|
| 1 | name field empty | Error "Nama komponen nilai harus diisi" |
| 2 | acronym field empty | Error "Akronim komponen nilai harus diisi" |
| 3 | both fields empty | Kedua pesan error muncul bersamaan |
| 4 | duplicate name | Server menolak, inline error muncul |
| 5 | duplicate acronym | Server menolak, inline error muncul |
| 6 | update to existing name | Server menolak, modal tetap terbuka |

### 4.5 Pola Test yang Benar

**Test create:**
```typescript
test('should create a new grade component with valid name and acronym', async ({ page }) => {
  await gradeComponentPage.openCreateModal();
  await gradeComponentPage.fillForm(data.create);
  await gradeComponentPage.submitForm();

  await gradeComponentPage.assertModalClosed();

  // Gunakan gotoFiltered bukan goto() — data baru bisa di halaman 2+ karena pagination
  await gradeComponentPage.gotoFiltered(data.create.name);
  await gradeComponentPage.assertRowVisible(data.create.name);
});
```

**Test update:**
```typescript
test('should update an existing grade component name and acronym', async ({ page }) => {
  const original = { name: `Original ${RUN_ID}`, acronym: `ORI${RUN_ID}` };
  const updated  = { name: `Updated ${RUN_ID}`,  acronym: `UPD${RUN_ID}` };

  await gradeComponentPage.createGradeComponent(original.name, original.acronym);
  await gradeComponentPage.gotoFiltered(original.name); // filter ke data yang mau diupdate

  await gradeComponentPage.updateGradeComponent(original.name, updated);

  await gradeComponentPage.gotoFiltered(updated.name);
  await gradeComponentPage.assertRowVisible(updated.name);   // nama baru ada

  await gradeComponentPage.gotoFiltered(original.name);
  await gradeComponentPage.assertRowNotVisible(original.name); // nama lama tidak ada
});
```

**Test delete:**
```typescript
test('should delete a grade component and remove it from the table', async ({ page }) => {
  await gradeComponentPage.createGradeComponent(data.delete.name, data.delete.acronym);
  await gradeComponentPage.gotoFiltered(data.delete.name);

  await gradeComponentPage.deleteGradeComponent(data.delete.name);

  await gradeComponentPage.gotoFiltered(data.delete.name);
  await gradeComponentPage.assertRowNotVisible(data.delete.name); // sudah tidak ada
});
```

**Test validasi (negatif):**
```typescript
test('should show a validation error when the name field is empty', async ({ page }) => {
  await gradeComponentPage.openCreateModal();
  await gradeComponentPage.fillAcronym('TST'); // isi akronim, kosongkan nama
  await gradeComponentPage.submitForm();

  await gradeComponentPage.assertFieldError('Nama komponen nilai harus diisi');
  await gradeComponentPage.assertModalOpen(); // modal HARUS tetap terbuka
});
```

---

## 5. Masalah yang Ditemukan dan Cara Memperbaiki

Selama proses membuat test ini, ditemukan tiga masalah utama. Memahami masalah ini penting agar tidak terulang saat membuat test untuk modul lain.

---

### Masalah 1: Tombol Tidak Ditemukan (Timeout)

**Gejala:**
```
TimeoutError: page.click: Timeout 30000ms exceeded.
waiting for locator('button:has(img[alt="icon-update"])')
```

**Penyebab:**

Selector awal tidak menyebutkan lokasi spesifik tombol:
```typescript
// ❌ SALAH — menemukan 2 elemen: mobile dan desktop
return this.page
  .locator('tr')
  .filter({ hasText: rowName })
  .locator('button:has(img[alt="icon-update"])');
```

Setiap baris punya **dua set tombol** karena desain responsive:
```html
<td>  ← kolom 1 (nama)
  <div class="md:hidden">          ← tombol mobile (tersembunyi di layar besar)
    <button>update</button>
    <button>delete</button>
  </div>
</td>
<td>  ← kolom 3 (actions)
  <div class="hidden md:flex">     ← tombol desktop (tampil di layar besar)
    <button>update</button>
    <button>delete</button>
  </div>
</td>
```

Playwright menemukan dua elemen sekaligus → gagal dengan **strict mode violation**.

**Solusi:**

Target hanya tombol di kolom terakhir (desktop) dengan `td:last-child`:
```typescript
// ✅ BENAR — hanya cocok dengan tombol di kolom Actions (desktop)
return this.page
  .locator('tr')
  .filter({ hasText: rowName })
  .locator('td:last-child button:has(img[alt="icon-update"])');
```

---

### Masalah 2: Data Tidak Terlihat Setelah Create (Pagination)

**Gejala:**
```
Error: expect(locator).toBeVisible() failed
Locator: locator('tr').filter({ hasText: 'Tugas Harian 9648584' })
Expected: visible
Timeout: 5000ms
```

**Penyebab:**

Halaman menggunakan pagination dengan `ITEM_PER_PAGE` item per halaman. Data baru diurutkan secara alfabetis (`orderBy: { name: "asc" }`). Jika ada banyak data di database, data baru bisa berada di halaman 2, 3, atau lebih — sehingga tidak terlihat di halaman pertama.

```typescript
// ❌ SALAH — navigasi ke halaman 1 tanpa filter, data mungkin tidak ada di sini
await gradeComponentPage.goto();
await gradeComponentPage.assertRowVisible(data.create.name);
```

**Solusi:**

Navigasi dengan query search yang sudah aktif. Server akan memfilter dan hanya menampilkan data yang cocok — dipastikan ada di halaman 1:

```typescript
// ✅ BENAR — server memfilter, data pasti muncul di halaman 1
await gradeComponentPage.gotoFiltered(data.create.name);
await gradeComponentPage.assertRowVisible(data.create.name);
```

Implementasi `gotoFiltered`:
```typescript
async gotoFiltered(query: string): Promise<void> {
  await this.page.goto(
    `${GradeComponentPage.URL}?search=${encodeURIComponent(query)}`,
  );
  await this.pageHeading.waitFor({ state: 'visible' });
  await this.page.waitForLoadState('networkidle');
}
```

---

### Masalah 3: Strict Mode Violation karena Substring Match

**Gejala:**
```
Error: strict mode violation: locator('tr').filter({ hasText: 'Updated 0132030' })
resolved to 2 elements:
  1) row: 'Tugas Harian Updated 0132030'
  2) row: 'Updated 0132030'
```

**Penyebab ada dua sub-masalah:**

**Sub-masalah A: Data berbagi antar test**

Dua test berbeda menggunakan nama data yang sama dari konstanta `data`:
```typescript
// ❌ SALAH — test 5 dan test 6 keduanya pakai data.search
test('test 5 - display', async () => {
  await gradeComponentPage.createGradeComponent(data.search.name, data.search.acronym);
});

test('test 6 - search', async () => {
  await gradeComponentPage.createGradeComponent(data.search.name, data.search.acronym);
  // ↑ GAGAL! data.search sudah ada di DB dari test 5 → duplicate error
});
```

**Sub-masalah B: `filter({ hasText })` adalah substring match**

`filter({ hasText: "Updated 0132030" })` juga cocok dengan baris yang mengandung `"Tugas Harian Updated 0132030"` karena `"Updated 0132030"` adalah substring dari `"Tugas Harian Updated 0132030"`.

**Solusi A: Beri setiap test data uniknya sendiri**

```typescript
// ✅ BENAR — setiap test punya key berbeda di objek data
const data = {
  display:   { name: `Display Tes ${RUN_ID}`,  acronym: `DP${RUN_ID}` }, // untuk test 5
  search:    { name: `Kuis Mingguan ${RUN_ID}`, acronym: `KM${RUN_ID}` }, // untuk test 6
  deleteOpen:{ name: `Del Modal ${RUN_ID}`,     acronym: `DM${RUN_ID}` }, // untuk test 9
  delete:    { name: `To Delete ${RUN_ID}`,     acronym: `TD${RUN_ID}` }, // untuk test 10
};
```

**Solusi B: Gunakan `text-is()` untuk exact match**

`text-is()` adalah Playwright custom CSS selector yang cocok hanya jika teks **persis sama** (case-sensitive, mengabaikan spasi di awal/akhir):

```typescript
// ❌ SALAH — filter({ hasText }) adalah substring match
rowByName(name: string): Locator {
  return this.page.locator('tr').filter({ hasText: name });
}

// ✅ BENAR — text-is() adalah exact match
rowByName(name: string): Locator {
  return this.page.locator('tr').filter({
    has: this.page.locator(`h3:text-is("${name}")`),
  });
}
```

`h3` dipakai karena nama item ada di dalam elemen `<h3 class="font-semibold">` di kolom pertama tabel.

---

## 6. Menjalankan Test

### Jalankan hanya test grade component
```powershell
npx playwright test tests/admin/courses/grade-component.spec.ts
```

### Jalankan hanya skenario positif
```powershell
npx playwright test tests/admin/courses/grade-component.spec.ts --grep "Positive"
```

### Jalankan hanya skenario negatif
```powershell
npx playwright test tests/admin/courses/grade-component.spec.ts --grep "Negative"
```

### Jalankan satu test tertentu
```powershell
npx playwright test tests/admin/courses/grade-component.spec.ts --grep "should create"
```

### Hasil yang diharapkan
```
18 passed (±3 menit)
```

---

## 7. Referensi Selector Penting

| Elemen | Selector | Alasan |
|---|---|---|
| Heading halaman | `getByRole('heading', { name: 'Komponen Nilai' })` | Semantik dan stabil |
| Search input | `input[type="search"]` | Atribut statis dari TableSearch |
| Tombol create | `button:has(img[alt="icon-create"])` | Alt text ikon dari FormModal |
| Tombol update (per baris) | `tr:has(h3:text-is("nama")) > td:last-child > button:has(img[alt="icon-update"])` | `td:last-child` hindari tombol mobile |
| Field nama | `input[name="name"]` | Atribut `name` dari react-hook-form |
| Field akronim | `input[name="acronym"]` | Atribut `name` dari react-hook-form |
| Tombol submit | `getByRole('button', { name: /^(Tambah\|Ubah)$/ })` | Teks tombol berubah sesuai mode |
| Error server-side | `form span.text-red-400` | Selector CSS dari GradeForm |
| Tombol hapus | `getByRole('button', { name: 'Hapus' })` | Teks tombol eksak dari FormModal |
| Close modal | `div.absolute.top-4.right-4` | Ini div, bukan button |

---

## Prinsip yang Diterapkan (US Remote Standards)

1. **Page Object Model** — selector dan aksi dipisah dari logika test
2. **Data isolation** — setiap test punya data unik dengan `RUN_ID`
3. **No shared mutable state** — tidak ada data yang dibagi antar test
4. **Descriptive test names** — nama test menjelaskan skenario secara lengkap
5. **AAA pattern** — Arrange (setup), Act (aksi), Assert (verifikasi)
6. **Composite actions** — `createGradeComponent()`, `updateGradeComponent()`, `deleteGradeComponent()` untuk mengurangi duplikasi kode
7. **Explicit waits** — selalu tunggu kondisi (visible/hidden) bukan `sleep`
8. **Exact matching** — gunakan `text-is()` bukan substring match untuk menghindari false positives
