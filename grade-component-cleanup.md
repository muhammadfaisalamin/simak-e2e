# Refactoring: Test Independence dan Database Cleanup Otomatis

## Masalah pada Versi Sebelumnya

Versi awal `grade-component.spec.ts` memiliki dua masalah utama:

### Masalah 1 — Data dibagi antar test (shared state)

```ts
// VERSI LAMA — satu RUN_ID untuk seluruh file
const RUN_ID = Date.now().toString().slice(-7);

const data = {
  create:    { name: `Tugas Harian ${RUN_ID}`, ... },
  search:    { name: `Kuis Mingguan ${RUN_ID}`, ... },
  delete:    { name: `To Delete ${RUN_ID}`, ... },
  // ...semua test berbagi konstanta yang sama
};

test.describe('Grade Component Management', () => {
  let gradeComponentPage: GradeComponentPage;

  test.beforeEach(async ({ page }) => {
    gradeComponentPage = new GradeComponentPage(page);
    await gradeComponentPage.goto();
  });
```

`RUN_ID` dihitung **satu kali saat file dimuat**, bukan per test. Akibatnya semua test dalam satu run berbagi prefix yang sama. Jika dua test memakai `data.search`, keduanya akan mencoba membuat row dengan nama identik — test kedua gagal karena duplikat.

### Masalah 2 — Database tidak dibersihkan setelah test

Setelah seluruh test selesai, semua data yang dibuat (`Tugas Harian`, `Kuis Mingguan`, `To Delete`, dll.) tetap ada di database. Semakin banyak dijalankan, semakin banyak sampah data yang menumpuk.

---

## Solusi: Custom Playwright Fixture dengan Teardown

Playwright menyediakan mekanisme **fixture** — sebuah fungsi yang berjalan sebelum dan sesudah setiap test. Ini adalah tempat yang tepat untuk:

1. Menyiapkan page object (`gcPage`)
2. Mengumpulkan daftar data yang dibuat selama test (`trackForCleanup`)
3. Menghapus semua data tersebut setelah test selesai, baik test lulus maupun gagal

---

## Langkah 1 — Buat File Fixture Baru

Buat file `tests/fixtures/grade-component.fixture.ts`:

```ts
import { test as authTest, expect } from './auth.fixture';
import { GradeComponentPage } from '../admin/pages/GradeComponentPage';

type GcFixtures = {
  gcPage: GradeComponentPage;
  trackForCleanup: (name: string) => void;
};

export const test = authTest.extend<GcFixtures>({
  gcPage: async ({ page }, use) => {
    const gcPage = new GradeComponentPage(page);
    await gcPage.goto();
    await use(gcPage);
  },

  trackForCleanup: async ({ page }, use) => {
    const tracked: string[] = [];

    await use((name: string) => {
      tracked.push(name);
    });

    // Teardown — berjalan setelah setiap test, lulus maupun gagal
    if (tracked.length === 0) return;

    const gcPage = new GradeComponentPage(page);
    for (const name of tracked) {
      try {
        await gcPage.gotoFiltered(name);
        const row = gcPage.rowByName(name);
        const visible = await row.isVisible({ timeout: 3000 });
        if (visible) {
          await gcPage.deleteGradeComponent(name);
        }
      } catch {
        // Row tidak ada atau sudah terhapus — aman diabaikan
      }
    }
  },
});

export { expect };
```

### Penjelasan baris per baris

---

#### Deklarasi tipe fixture

```ts
type GcFixtures = {
  gcPage: GradeComponentPage;
  trackForCleanup: (name: string) => void;
};
```

`GcFixtures` adalah TypeScript interface yang mendefinisikan dua fixture baru:
- `gcPage` — bertipe `GradeComponentPage` (instance dari POM)
- `trackForCleanup` — bertipe fungsi yang menerima string dan tidak mengembalikan nilai

Tipe ini digunakan sebagai generic parameter di `authTest.extend<GcFixtures>()` agar TypeScript tahu fixtures apa yang tersedia di dalam `async ({ gcPage, trackForCleanup }) => { ... }`.

---

#### Fixture `gcPage`

```ts
gcPage: async ({ page }, use) => {
  const gcPage = new GradeComponentPage(page);
  await gcPage.goto();
  await use(gcPage);
},
```

Pola fixture Playwright selalu:
1. Kode **sebelum** `await use(...)` → setup (berjalan sebelum test)
2. `await use(...)` → test body berjalan di sini
3. Kode **setelah** `await use(...)` → teardown (berjalan setelah test)

Pada `gcPage`:
- Sebelum `use`: buat instance `GradeComponentPage` dan navigasi ke halaman
- `use(gcPage)`: berikan instance ke test body
- Setelah `use`: tidak ada (fixture ini tidak perlu teardown)

Ini menggantikan pola `beforeEach` lama:
```ts
// SEBELUM — beforeEach di spec file
test.beforeEach(async ({ page }) => {
  gradeComponentPage = new GradeComponentPage(page);
  await gradeComponentPage.goto();
});
```

---

#### Fixture `trackForCleanup`

```ts
trackForCleanup: async ({ page }, use) => {
  const tracked: string[] = [];

  await use((name: string) => {
    tracked.push(name);
  });

  // Teardown
  if (tracked.length === 0) return;
  // ...hapus semua row yang terdaftar
},
```

Ini adalah inti dari solusi. Mari dipecah:

**Bagian 1 — Sebelum `use` (setup):**
```ts
const tracked: string[] = [];
```
Array kosong disiapkan untuk menampung nama-nama data yang akan dibuat selama test.

**Bagian 2 — `use(...)` memberi fungsi ke test:**
```ts
await use((name: string) => {
  tracked.push(name);
});
```
Yang diberikan ke test **bukan nilai**, melainkan **fungsi**. Ketika test memanggil `trackForCleanup("Tugas Harian 123")`, fungsi ini berjalan dan mendaftarkan nama tersebut ke array `tracked`.

Ini yang membuat polanya fleksibel — test bisa mendaftarkan satu nama, dua nama, atau tidak sama sekali, bergantung pada kebutuhan masing-masing test.

**Bagian 3 — Setelah `use` (teardown):**
```ts
if (tracked.length === 0) return;

const gcPage = new GradeComponentPage(page);
for (const name of tracked) {
  try {
    await gcPage.gotoFiltered(name);
    const row = gcPage.rowByName(name);
    const visible = await row.isVisible({ timeout: 3000 });
    if (visible) {
      await gcPage.deleteGradeComponent(name);
    }
  } catch {
    // Row tidak ada atau sudah terhapus — aman diabaikan
  }
}
```

Setelah test body selesai (lulus atau gagal), Playwright melanjutkan eksekusi kode setelah `await use(...)`. Di sini:
1. Jika tidak ada yang terdaftar (`tracked.length === 0`) → langsung keluar
2. Buat instance `GradeComponentPage` baru untuk melakukan cleanup
3. Untuk setiap nama yang terdaftar:
   - Navigasi ke halaman dengan filter pencarian (`?search=namarow`)
   - Cek apakah row masih terlihat (timeout 3 detik — cepat, bukan menunggu lama)
   - Jika terlihat → hapus via UI
4. Seluruh proses dibungkus `try/catch` — jika row sudah tidak ada (misalnya test delete berhasil menghapus sendiri), tidak ada error yang muncul

---

#### Kenapa `try/catch` diperlukan?

Bayangkan test "should delete a grade component". Test ini **tidak** memanggil `trackForCleanup` karena test sendiri yang menghapus row. Tapi bagaimana jika test lain memanggil `trackForCleanup` untuk nama yang sudah dihapus di pertengahan test? `gotoFiltered` + `isVisible` dengan timeout 3 detik akan mengembalikan `false` — aman. Namun ada skenario lain: network error, aplikasi tidak merespons, dsb. `try/catch` memastikan cleanup tidak melempar error yang bisa menyebabkan laporan test menjadi kacau.

---

#### Kenapa `{ timeout: 3000 }` dan bukan nilai default?

```ts
const visible = await row.isVisible({ timeout: 3000 });
```

Nilai default timeout Playwright adalah 30 detik. Jika row memang tidak ada di database (misalnya sudah terhapus), Playwright menunggu 30 detik sebelum menyimpulkan "tidak terlihat". Untuk proses cleanup yang mungkin dijalankan untuk banyak nama, ini membuang waktu. Timeout 3 detik cukup untuk kasus normal.

---

## Langkah 2 — Refactor Spec File

### Perubahan impor

```ts
// SEBELUM
import { test, expect } from '../../fixtures/auth.fixture';

// SESUDAH
import { test, expect } from '../../fixtures/grade-component.fixture';
```

`grade-component.fixture.ts` sudah meng-extend `auth.fixture.ts`, jadi session admin tetap aktif. Tidak ada yang hilang — hanya ada tambahan dua fixture baru.

---

### Hilangkan shared `data` dan `RUN_ID`

```ts
// SEBELUM — di level module, dibagi semua test
const RUN_ID = Date.now().toString().slice(-7);
const data = {
  create:    { name: `Tugas Harian ${RUN_ID}`, acronym: `TH${RUN_ID}` },
  display:   { name: `Display Tes ${RUN_ID}`,  acronym: `DP${RUN_ID}` },
  search:    { name: `Kuis Mingguan ${RUN_ID}`, acronym: `KM${RUN_ID}` },
  // ...dst
};
```

```ts
// SESUDAH — setiap test membuat ID-nya sendiri
test('should create a new grade component', async ({ gcPage, trackForCleanup }) => {
  const id = Date.now().toString().slice(-6);
  const name    = `Tugas Harian ${id}`;
  const acronym = `TH${id}`;
  // ...
});
```

`Date.now()` di dalam body test berjalan **saat test itu dieksekusi**, bukan saat file dimuat. Karena test berjalan satu per satu (workers: 1), setiap test mendapat timestamp yang berbeda — tidak ada tabrakan nama.

---

### Hilangkan `beforeEach` dan variabel shared

```ts
// SEBELUM
test.describe('Grade Component Management', () => {
  let gradeComponentPage: GradeComponentPage; // variabel shared

  test.beforeEach(async ({ page }) => {
    gradeComponentPage = new GradeComponentPage(page);
    await gradeComponentPage.goto();
  });

  test('should create...', async ({ page }) => {
    await gradeComponentPage.openCreateModal(); // pakai variabel shared
    // ...
  });
});
```

```ts
// SESUDAH
test.describe('Grade Component Management', () => {
  // Tidak ada variabel shared, tidak ada beforeEach

  test('should create...', async ({ gcPage, trackForCleanup }) => {
    await gcPage.openCreateModal(); // gcPage datang dari fixture
    // ...
  });
});
```

`gcPage` fixture menggantikan `beforeEach` sepenuhnya. Playwright menjalankan setup fixture sebelum setiap test dan teardown setelah setiap test — sama seperti `beforeEach`/`afterEach`, tapi lebih terstruktur dan dapat dikomposisi.

---

### Pola penggunaan `trackForCleanup`

Ada tiga kategori test berdasarkan apakah mereka perlu cleanup:

#### Kategori 1 — Test yang membuat data dan perlu dibersihkan

```ts
test('should create a new grade component', async ({ gcPage, trackForCleanup }) => {
  const id = Date.now().toString().slice(-6);
  const name    = `Tugas Harian ${id}`;
  const acronym = `TH${id}`;
  trackForCleanup(name); // daftarkan SEBELUM membuat data

  await gcPage.openCreateModal();
  await gcPage.fillForm({ name, acronym });
  await gcPage.submitForm();
  // ...
});
```

`trackForCleanup(name)` dipanggil **sebelum** data dibuat. Ini penting: jika create gagal di tengah jalan, nama sudah terdaftar, dan teardown akan mencoba menghapusnya (jika ada). Jika create berhasil, teardown pasti berhasil menghapus.

#### Kategori 2 — Test yang membuat data dan menghapus sendiri

```ts
test('should delete a grade component', async ({ gcPage }) => {
  // Tidak ada trackForCleanup
  const id = Date.now().toString().slice(-6);
  const name = `To Delete ${id}`;

  await gcPage.createGradeComponent(name, acronym);
  await gcPage.deleteGradeComponent(name); // test ini sendiri yang hapus
  // ...
});
```

Karena test ini memverifikasi bahwa delete berfungsi, maka setelah test selesai row sudah tidak ada. `trackForCleanup` tidak diperlukan.

#### Kategori 3 — Test yang tidak membuat data

```ts
test('should show a validation error when the name field is empty', async ({ gcPage }) => {
  // Tidak ada trackForCleanup
  await gcPage.openCreateModal();
  await gcPage.fillAcronym('TST');
  await gcPage.submitForm();
  // Modal tetap terbuka, tidak ada data tersimpan
});
```

Test validasi tidak pernah berhasil menyimpan data, jadi tidak ada yang perlu dihapus.

---

### Kasus khusus: test update (dua nama perlu didaftarkan)

```ts
test('should update an existing grade component', async ({ gcPage, trackForCleanup }) => {
  const id      = Date.now().toString().slice(-6);
  const original = { name: `Original ${id}`, acronym: `ORI${id}` };
  const updated  = { name: `Updated ${id}`,  acronym: `UPD${id}` };
  trackForCleanup(original.name); // ← nama awal
  trackForCleanup(updated.name);  // ← nama setelah diupdate

  await gcPage.createGradeComponent(original.name, original.acronym);
  await gcPage.updateGradeComponent(original.name, updated);
  // ...
});
```

Mengapa mendaftarkan keduanya? Karena di database, setelah update:
- `original.name` sudah tidak ada (diganti)
- `updated.name` sekarang ada di database

`trackForCleanup(original.name)` → teardown akan cari "Original 123456" → tidak ditemukan → `isVisible` false → tidak melakukan apa-apa (aman).
`trackForCleanup(updated.name)` → teardown akan cari "Updated 123456" → ditemukan → hapus.

Mendaftarkan kedua nama memastikan bahwa apapun yang terjadi (update gagal di tengah jalan, dsb.), teardown tetap mencoba membersihkan semua kemungkinan state.

---

### Kasus khusus: test duplikat akronim (nama gagal dibuat tapi tetap didaftarkan)

```ts
test('should reject a duplicate grade component acronym', async ({ gcPage, trackForCleanup }) => {
  const id      = Date.now().toString().slice(-6);
  const name    = `Duplikat Akronim ${id}`;   // berhasil dibuat
  const acronym = `DA${id}`;
  const nameAlt = `Duplikat Akronim Alt ${id}`; // gagal dibuat (duplikat akronim)
  trackForCleanup(name);    // ← perlu dibersihkan
  trackForCleanup(nameAlt); // ← didaftarkan meski gagal dibuat

  await gcPage.createGradeComponent(name, acronym);
  await gcPage.goto();

  await gcPage.openCreateModal();
  await gcPage.fillForm({ name: nameAlt, acronym }); // akronim sama → ditolak server
  await gcPage.submitForm();

  await gcPage.assertInlineFormError();
});
```

`nameAlt` didaftarkan ke `trackForCleanup` meski create-nya gagal. Teardown akan mencari "Duplikat Akronim Alt 123456" → tidak ditemukan → `isVisible` false → tidak melakukan apa-apa. Tidak berbahaya, dan memberi jaminan: jika suatu saat server berperilaku berbeda dan create berhasil, teardown tetap membersihkan.

---

## Struktur File Akhir

```
simak-e2e/
└── tests/
    ├── fixtures/
    │   ├── auth.fixture.ts                   ← tidak berubah
    │   └── grade-component.fixture.ts        ← BARU: gcPage + trackForCleanup
    └── admin/
        ├── pages/
        │   └── GradeComponentPage.ts         ← tidak berubah
        └── courses/
            └── grade-component.spec.ts       ← direfactor
```

---

## Alur Eksekusi Per Test

Berikut alur lengkap untuk satu test yang menggunakan kedua fixture:

```
Playwright mulai test
        │
        ▼
Setup fixture: gcPage
  → new GradeComponentPage(page)
  → gcPage.goto()
        │
        ▼
Setup fixture: trackForCleanup
  → tracked = []
  → siapkan fungsi (name) => tracked.push(name)
        │
        ▼
Test body berjalan
  → const id = Date.now().toString().slice(-6)
  → trackForCleanup("Tugas Harian 123456")  ← tambah ke tracked
  → gcPage.openCreateModal()
  → gcPage.fillForm(...)
  → gcPage.submitForm()
  → gcPage.assertRowVisible(...)
        │
        ▼
Test selesai (lulus atau gagal)
        │
        ▼
Teardown fixture: trackForCleanup
  → tracked = ["Tugas Harian 123456"]
  → gcPage.gotoFiltered("Tugas Harian 123456")
  → row.isVisible() → true
  → gcPage.deleteGradeComponent("Tugas Harian 123456")
        │
        ▼
Teardown fixture: gcPage
  (tidak ada kode teardown)
        │
        ▼
Test selesai, database bersih
```

Perhatikan bahwa teardown berjalan **dalam urutan terbalik** dari setup. `trackForCleanup` di-setup setelah `gcPage`, sehingga teardown-nya berjalan lebih dulu sebelum teardown `gcPage`. Ini penting karena teardown `trackForCleanup` masih membutuhkan `page` aktif untuk melakukan navigasi dan klik.

---

## Perbandingan Sebelum dan Sesudah

| Aspek | Versi Lama | Versi Baru |
|---|---|---|
| Data unik | `RUN_ID` dibagi seluruh file | `Date.now()` per test body |
| Setup navigasi | `beforeEach` di spec | Fixture `gcPage` |
| Cleanup data | Tidak ada | Fixture `trackForCleanup` |
| Dependensi antar test | Ada (shared data object) | Tidak ada |
| Database setelah run | Penuh data sampah | Bersih |
| Test bisa dijalankan ulang | Mungkin gagal (duplicate) | Selalu aman |
| Test bisa dijalankan sendiri | Ya | Ya |

---

## Kapan Tidak Perlu `trackForCleanup`

Tiga kondisi di mana fixture ini tidak dipanggil:

1. **Test tidak membuat data** — test validasi form (submit ditolak, tidak ada data tersimpan)
2. **Test menghapus data sendiri** — test delete yang memverifikasi penghapusan berhasil
3. **Test menutup modal tanpa submit** — test close button, data tidak pernah dikirim ke server
