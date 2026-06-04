# Penjelasan Baris per Baris: `auth.fixture.ts`

```ts
import { test as base, expect } from '@playwright/test';
```
Mengimpor `test` dan `expect` dari library resmi Playwright. `test` di-rename menjadi `base` agar tidak bentrok dengan nama `test` yang akan diekspor nanti. `base` adalah objek test Playwright yang asli sebelum dikustomisasi.

---

```ts
import * as path from 'path';
```
Mengimpor modul bawaan Node.js untuk memanipulasi path file. Digunakan di bagian `AUTH_PATHS` untuk membangun path absolut ke file cookie.

---

```ts
type AuthFixtures = {
  // Tidak ada fixture tambahan untuk sekarang
  // (storageState sudah diatur di playwright.config.ts per project)
};
```
Mendefinisikan tipe TypeScript untuk fixture tambahan. Saat ini kosong karena belum ada fixture custom. Tipe ini nanti diisi jika ingin menambah fixture seperti `adminPage` atau `loggedInUser`.

---

```ts
export const test = base.extend<AuthFixtures>({});
```
Membuat versi `test` baru dengan memanggil `base.extend()`. Ini adalah cara Playwright untuk menambahkan fixture kustom ke dalam `test`. Meskipun `AuthFixtures` kosong dan objek `{}` tidak menambah apa-apa, pola ini penting karena:
- Semua file test mengimpor `test` dari sini, bukan langsung dari `@playwright/test`
- Jika nanti perlu tambah fixture, cukup ubah file ini — semua test otomatis dapat perubahan tanpa perlu disentuh satu per satu

---

```ts
export { expect };
```
Meneruskan `expect` dari Playwright tanpa modifikasi. Di-ekspor ulang agar file test cukup import dari satu tempat (`auth.fixture.ts`) dan tidak perlu import dari dua sumber berbeda.

---

```ts
export const AUTH_PATHS = {
  admin:    path.resolve(__dirname, '../../.auth/admin.json'),
  lecturer: path.resolve(__dirname, '../../.auth/lecturer.json'),
  student:  path.resolve(__dirname, '../../.auth/student.json'),
};
```
Mendefinisikan path absolut ke masing-masing file cookie per role.

- `__dirname` adalah direktori file ini berada, yaitu `tests/fixtures/`
- `../../.auth/` naik dua level ke root project lalu masuk folder `.auth/`
- `path.resolve()` mengubahnya menjadi path absolut yang valid di OS manapun

Hasilnya:
```
admin    → C:\Projects\StmikBjbApplication\simak-e2e\.auth\admin.json
lecturer → C:\Projects\StmikBjbApplication\simak-e2e\.auth\lecturer.json
student  → C:\Projects\StmikBjbApplication\simak-e2e\.auth\student.json
```

Konstanta ini diekspor sebagai utilitas siap pakai jika ada test yang perlu membaca atau memvalidasi isi file cookie secara langsung. Saat ini belum digunakan oleh file test manapun.
