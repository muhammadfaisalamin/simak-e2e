# Dokumentasi API SIMAK — `src/app/api`

> Analisis lengkap seluruh route handler Next.js App Router di direktori `src/app/api`.  
> Disusun dengan pendekatan **top-down** (gambaran besar → detail) dan **bottom-up** (komponen dasar → alur lengkap).

---

## Daftar Isi

1. [Gambaran Besar (Top-Down)](#1-gambaran-besar-top-down)
2. [Peta Seluruh Endpoint](#2-peta-seluruh-endpoint)
3. [Komponen Dasar (Bottom-Up)](#3-komponen-dasar-bottom-up)
4. [Analisis Per Endpoint](#4-analisis-per-endpoint)
   - [GET /api/avatar](#41-get-apiavatar)
   - [GET /api/payment](#42-get-apipayment)
   - [GET /api/grade](#43-get-apigrade)
   - [GET /api/excel](#44-get-apiexcel)
   - [GET /api/pdf](#45-get-apipdf)
5. [Alur Eksekusi Lengkap (Top-Down + Bottom-Up Digabung)](#5-alur-eksekusi-lengkap)
6. [Pola Arsitektur dan Catatan Penting](#6-pola-arsitektur-dan-catatan-penting)

---

## 1. Gambaran Besar (Top-Down)

### Apa itu layer API ini?

Direktori `src/app/api` berisi **5 route handler** Next.js (App Router) yang semuanya berupa endpoint HTTP `GET`. Fungsi utamanya terbagi menjadi dua kategori besar:

```
src/app/api/
├── avatar/route.ts    ─── LAYANI FILE: foto mahasiswa dari server disk
├── payment/route.ts   ─── LAYANI FILE: bukti pembayaran dari server disk
├── grade/route.ts     ─── EKSPOR: nilai satu kelas akademik → Excel
├── excel/route.ts     ─── EKSPOR: 8 jenis laporan → Excel (.xlsx)
└── pdf/route.ts       ─── EKSPOR: 12 jenis dokumen → PDF
```

**Kategori 1 — File Server** (`avatar`, `payment`):  
Membaca file dari direktori lokal di server (folder yang dikonfigurasi via environment variable), lalu mengirimkannya sebagai response HTTP dengan MIME type yang tepat. Tidak ada query ke database.

**Kategori 2 — Report Generator** (`excel`, `pdf`, `grade`):  
Melakukan query ke database melalui Prisma ORM, mengolah data, lalu memanggil fungsi khusus untuk menghasilkan file Excel atau PDF. File dikembalikan langsung sebagai response HTTP stream.

### Mengapa ada endpoint terpisah dan bukan langsung dari Server Component?

Next.js Server Components tidak bisa mengembalikan binary file (PDF/Excel). Endpoint API adalah jalan satu-satunya untuk menghasilkan dan mengunduh file dari server. Komponen UI (misalnya tombol "Download Excel") cukup membuat link `<a href="/api/excel?u=...&type=...">` yang memicu download.

### Siapa yang memanggil API ini?

- **Komponen `ButtonPdfDownload`** (`src/component/ButtonPdfDownload.tsx`) → `/api/pdf`
- **Tombol/Link di halaman admin** → `/api/excel`, `/api/grade`
- **Tag `<img>` atau `<Image>` di komponen** → `/api/avatar` (menampilkan foto mahasiswa)
- **Link di halaman admin reregistrasi** → `/api/payment` (lihat bukti pembayaran)

---

## 2. Peta Seluruh Endpoint

| Endpoint | Method | Parameter Utama | Output | Nama File |
|----------|--------|-----------------|--------|-----------|
| `/api/avatar` | GET | `file` (nama file) | image/* (inline) | — |
| `/api/payment` | GET | `file`, `download` | * (inline/attachment) | sesuai `file` |
| `/api/grade` | GET | `academicClassId`, `template?` | Excel .xlsx | `Kelas {nama} - ({kode}) {matkul} - {periode}.xlsx` |
| `/api/excel` | GET | `u` (periodId/scheduleId), `type` | Excel .xlsx | tergantung `type` |
| `/api/pdf` | GET | `u` (berbagai ID), `type` | PDF | tergantung `type` |

### Tipe-tipe yang didukung `/api/excel` dan `/api/pdf`

| `type` | Excel | PDF | Keterangan |
|--------|-------|-----|-----------|
| `coursekrs` | ✓ | ✓ | Rekapitulasi mata kuliah per periode |
| `studentsRegisteredKrs` | ✓ | ✓ | Mahasiswa yang sudah KRS |
| `studentsUnregisteredKrs` | ✓ | ✓ | Mahasiswa yang belum KRS |
| `studentsTakingThesis` | ✓ | ✓ | Mahasiswa program TA (skripsi) |
| `studentsTakingInternship` | ✓ | ✓ | Mahasiswa program PKL |
| `studentActiveInactive` | ✓ | ✓ | Status aktif/nonaktif mahasiswa |
| `studentsRegularSore` | ✓ | ✓ | Pemisahan mahasiswa pagi vs sore |
| `schedule` | ✓ | — | Jadwal perkuliahan |
| `assessment` | — | ✓ | Daftar nilai kelas akademik |
| `krs` | — | ✓ | Kartu Rencana Studi mahasiswa |
| `khs` | — | ✓ | Kartu Hasil Studi mahasiswa |
| `transcript` | — | ✓ | Transkrip akademik mahasiswa |
| `reregister` | — | ✓ | Formulir herregistrasi mahasiswa |

---

## 3. Komponen Dasar (Bottom-Up)

Sebelum memahami setiap endpoint, penting mengenal blok-blok kecil yang digunakan.

### 3.1 Shared Infrastructure

**`NextRequest` / `NextResponse`** (dari `next/server`):  
Semua endpoint menerima `NextRequest` dan mengembalikan `NextResponse`. Untuk file binary, konstruktor `NextResponse` menerima `Uint8Array` secara langsung.

```typescript
// Pola dasar semua endpoint file
return new NextResponse(new Uint8Array(fileBuffer), {
  headers: {
    'Content-Type': mimeType,
    'Content-Disposition': 'inline' | `attachment; filename="..."`
  }
})
```

**`prisma`** (dari `@/lib/prisma`):  
Instance Prisma Client tunggal yang di-share. Digunakan di tiga endpoint (`grade`, `excel`, `pdf`) untuk query database.

**`logger`** (dari `@/lib/logger`):  
Digunakan di `grade/route.ts` dan `pdf/route.ts` untuk mencatat error. `excel/route.ts` menggunakan `error` dari `console` secara langsung (tidak konsisten).

### 3.2 Pustaka File System

```typescript
import path from 'path';
import fs from 'fs/promises';
import mime from 'mime';
```

- `path.join(process.cwd(), envFolder, file)` — membentuk path absolut ke file
- `fs.readFile(filePath)` — membaca file sebagai Buffer
- `mime.getType(filePath)` — mendeteksi MIME type dari ekstensi file (misal `.jpg` → `image/jpeg`)

### 3.3 Fungsi Export Excel

Semua fungsi ini ada di `@/lib/excel/` dan menerima data yang sudah diproses, lalu mengembalikan `Buffer` file Excel:

| Fungsi | File |
|--------|------|
| `exportCourseTaken` | `exportCourseTaken.ts` |
| `exportStudentRegisteredKrs` | `exportStudentRegisteredKrs.ts` |
| `exportStudentUnregisteredKrs` | `exportStudentUnregisteredKrs.ts` |
| `exportStudentTakingThesis` | `exportStudentTakingThesis.ts` |
| `exportStudentTakingIntership` | `exportStudentTakingIntership.ts` |
| `exportStudentActiveInactive` | `exportStudentActiveInactive.ts` |
| `exportStudentRegularSore` | `exportStudentRegularSore.ts` |
| `exportSchedule` | `exportSchedule.ts` |
| `exportAssessmentGrade` | `exportAssessmentGrade.ts` |
| `exportAssessmentTemplate` | `exportAssessmentTemplate.ts` |

### 3.4 Fungsi Render PDF

```typescript
import renderPdf from "@/lib/renderPdf";
```

`renderPdf({ type, data })` menerima tipe dokumen dan data yang dibutuhkan, mengembalikan `Buffer` PDF. Di dalamnya kemungkinan menggunakan library seperti Puppeteer atau PDFKit (tidak dikonfirmasi dari route).

**Logo sebagai Base64:**
```typescript
const logoPath = path.join(process.cwd(), 'public', 'logo.png');
const logoFile = await readFile(logoPath);
const img = `data:image/png;base64,${logoFile.toString('base64')}`;
```
Logo institusi disisipkan ke setiap PDF sebagai data URI agar tidak memerlukan request HTTP terpisah saat rendering.

**Format tanggal Indonesia:**
```typescript
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
const date = format(new Date(), 'dd MMMM yyyy', { locale: indonesianLocale });
// Hasil: "29 Mei 2026"
```

### 3.5 Fungsi Utility Akademik

Dari `@/lib/utils`:

| Fungsi | Kegunaan |
|--------|---------|
| `coursesClearing(khs)` | Menghilangkan duplikat mata kuliah dari riwayat KHS (mengambil nilai terbaik) |
| `totalSks(courses)` | Menjumlahkan total SKS dari daftar mata kuliah |
| `totalBobot(courses)` | Menjumlahkan total bobot nilai (SKS × NAB) |
| `lecturerName({ frontTitle, name, backTitle })` | Menggabungkan nama dosen dengan gelar depan/belakang |
| `courseSorting(courses)` | Mengurutkan mata kuliah berdasarkan semester/urutan tertentu |

Formula IPK/IPS yang digunakan:
```typescript
const gpa = (totalBobot / totalSks).toFixed(2);
```

### 3.6 Environment Variables

| Variabel | Digunakan di | Keterangan |
|----------|-------------|-----------|
| `AVATAR_FOLDER` | `avatar/route.ts` | Path folder foto mahasiswa relatif ke `process.cwd()` |
| `PAYMENT_FOLDER` | `payment/route.ts` | Path folder bukti pembayaran relatif ke `process.cwd()` |
| `DATABASE_URL` | (via Prisma) | Koneksi database PostgreSQL |

---

## 4. Analisis Per Endpoint

### 4.1 `GET /api/avatar`

**File:** `src/app/api/avatar/route.ts`

**Tujuan:** Menyajikan file foto/avatar mahasiswa yang tersimpan di server disk, bukan di direktori `public/` (sehingga tidak accessible langsung via URL statis).

**Parameter:**
- `?file=namafile.jpg` — nama file avatar (wajib)

**Alur Eksekusi:**
```
Request → Ambil query param 'file'
        → Validasi: jika tidak ada → 400 Missing file
        → Bentuk path: path.join(cwd, AVATAR_FOLDER, file)
        → fs.readFile(path)
        → Deteksi MIME type dari ekstensi
        → Response dengan Content-Disposition: inline
           (ditampilkan langsung di browser, bukan di-download)
        → Jika file tidak ada → 404 File not found
```

**Kode Kunci:**
```typescript
const filePath = path.join(process.cwd(), avatarFilePath, file);
const fileBuffer = await fs.readFile(filePath);
const mimeType = mime.getType(filePath) || 'application/octet-stream';
return new NextResponse(new Uint8Array(fileBuffer), {
  headers: {
    'Content-Type': mimeType,
    'Content-Disposition': 'inline',
  },
});
```

**Catatan:** File avatar disimpan di luar `public/` agar tidak diakses publik tanpa melalui endpoint ini. Ini pola umum untuk file yang ingin dikontrol aksesnya.

---

### 4.2 `GET /api/payment`

**File:** `src/app/api/payment/route.ts`

**Tujuan:** Menyajikan file bukti pembayaran herregistrasi. Mendukung dua mode: tampil di browser (inline) atau download (attachment).

**Parameter:**
- `?file=namafile.pdf` — nama file pembayaran (wajib)
- `?download=true` — jika `true`, file di-download; jika tidak ada/`false`, ditampilkan inline

**Alur Eksekusi:**
```
Request → Ambil 'file' dan 'download' dari query params
        → Validasi: jika 'file' tidak ada → 400 Missing file
        → Bentuk path: path.join(cwd, PAYMENT_FOLDER, file)
        → fs.readFile(path)
        → Deteksi MIME type
        → download=true  → Content-Disposition: attachment; filename="..."
           download=false → Content-Disposition: inline
        → Jika file tidak ada → 404 File not found
```

**Perbedaan dengan `/api/avatar`:**
Satu-satunya perbedaan fungsional adalah dukungan parameter `download=true` yang mengubah header `Content-Disposition`. Ini memungkinkan UI menawarkan pilihan "lihat" vs "unduh" untuk bukti pembayaran.

---

### 4.3 `GET /api/grade`

**File:** `src/app/api/grade/route.ts`

**Tujuan:** Mengekspor data penilaian (nilai) satu kelas akademik ke format Excel. Mendukung dua mode: **template kosong** (untuk diisi dosen) atau **data aktual** (nilai yang sudah ada).

**Parameter:**
- `?academicClassId=uuid` — ID kelas akademik (wajib)
- `?template` — jika ada (nilai apapun), export template; jika tidak ada, export data nilai aktual

**Alur Eksekusi:**

```
Request → Ambil 'academicClassId' dan 'template'
        → Validasi: jika academicClassId tidak ada → 400

        ─── Query Prisma 1: AcademicClass ───────────────────────────────
        prisma.academicClass.findUnique({ id: academicClassId })
          select: course → assessment → assessmentDetail → grade
                  lecturer (nama)
                  name, periodId, period (nama)
                  academicClassDetail (list studentId di kelas)

        ─── Query Prisma 2: KhsDetail ───────────────────────────────────
        prisma.khsDetail.findMany({
          where: courseId = academicClass.course.id
                 AND studentId IN (academicClassDetail.studentId)
                 AND periodId = academicClass.periodId
        })
          include: khs → student (nama, nim)
                   khsGrade → assessmentDetail → grade
          orderBy: nim ASC

        ─── Gabungkan data ───────────────────────────────────────────────
        data = { academicClass, khsDetails }

        ─── Pilih fungsi export ──────────────────────────────────────────
        template ada → exportAssessmentTemplate(data)   // template kosong
        template tidak ada → exportAssessmentGrade(data) // data nilai aktual

        → Return Excel dengan nama:
          "Kelas {name} - ({course.code}) {course.name} - {period.name}.xlsx"
```

**Kenapa ada dua query terpisah?**
`academicClass` memberi struktur kelas (komponen penilaian, dosen, period). `khsDetail` memberi nilai aktual setiap mahasiswa. Keduanya digabungkan agar fungsi export bisa membangun spreadsheet yang lengkap: header kolom dari assessment, baris data dari khsDetail.

**Struktur data yang dikirim ke export:**
```typescript
{
  academicClass: {
    name, course: { code, name, assessment: { assessmentDetail: [{ grade, seq_number }] } },
    lecturer: { name }, period: { name }, academicClassDetail: [{ studentId }]
  },
  khsDetails: [
    { khs: { student: { name, nim } }, khsGrade: [{ assessmentDetail, grade }] }
  ]
}
```

---

### 4.4 `GET /api/excel`

**File:** `src/app/api/excel/route.ts`

**Tujuan:** Endpoint multi-fungsi yang menghasilkan berbagai laporan Excel operasional kampus per periode akademik (atau jadwal). Satu endpoint, 8 jenis laporan.

**Parameter:**
- `?u=uuid` — ID periode (`sb25_periods.id`) untuk semua tipe kecuali `schedule`; untuk `schedule` ini adalah `scheduleId`
- `?type=...` — jenis laporan (lihat tabel di bawah)

**Inisialisasi bersama (dilakukan sebelum `switch`):**
```typescript
const dataPeriod = await prisma.period.findUnique({ where: { id: uid } });
const dataMajor = await prisma.major.findMany({ select: { id, name, stringCode } });
```
`dataMajor` selalu di-fetch karena hampir semua tipe membutuhkan pengelompokan data per program studi.

---

**`type = "coursekrs"` — Rekapitulasi Mata Kuliah**

Menghasilkan laporan jumlah mahasiswa yang mengambil setiap mata kuliah, dipisahkan per tipe kampus (BJB, BJM, ONLINE, SORE) dan per angkatan.

```
Logika utama:
1. Ambil semua curriculumDetail semester yang relevan (ganjil: 1,3,5,7 / genap: 2,4,6,8)
   dari kurikulum aktif → ini adalah daftar mata kuliah yang "seharusnya" diambil

2. Ambil semua krsDetail untuk periode ini → ini mahasiswa yang BENAR-BENAR mengambil

3. Gabungkan: untuk setiap krsDetail, tambahkan counter BJB/BJM/ONLINE/SORE
   dan counter per angkatan ke data mata kuliah yang sesuai

4. Buat Set unik angkatan dari semua mahasiswa yang KRS
   (digunakan sebagai kolom dinamis di Excel)

5. Group hasil per program studi

Output file: "REKAPITULASI MATA KULIAH ({nama_periode}).xlsx"
```

**`type = "studentsRegisteredKrs"` — Mahasiswa Sudah KRS**

```
Prisma query: krs.findMany({
  where: reregister.periodId = uid AND krsDetail.some: {}  // ada minimal 1 detail KRS
})
select: student (nim, nama, prodi), maxSks, ips, lecturer, semester, krsDetail (sks)

Proses: Hitung total SKS yang diambil dari krsDetail
        Group per prodi

Output: "REKAP MAHASISWA SUDAH KRS ({nama_periode}).xlsx"
```

**`type = "studentsUnregisteredKrs"` — Mahasiswa Belum KRS**

```
Prisma query: krs.findMany({
  where: reregister.periodId = uid AND krsDetail.none: {}  // tidak ada detail KRS
})
Output: "REKAP MAHASISWA BELUM KRS ({nama_periode}).xlsx"
```

**`type = "studentsTakingThesis"` — Mahasiswa Program TA**

```
Prisma query: student.findMany({
  where: krs.some → krsDetail.some → course.isSkripsi: true
         AND studentStatus: AKTIF
})
select: nama, nim, prodi, reregisterDetail (semester, dosen wali), khs (khsDetail latest+announced)

Proses (dalam $transaction):
  - coursesClearing(khs) → hilangkan duplikat, ambil nilai terbaik
  - totalSks + totalBobot → hitung IPK transcript

Output: "REKAP MAHASISWA PROGRAM TA ({nama_periode}).xlsx"
```

**`type = "studentsTakingInternship"` — Mahasiswa Program PKL**

Identik dengan `studentsTakingThesis` tetapi filter `course.isPKL: true`.

```
Output: "DAFTAR MAHASISWA PROGRAM PKL ({nama_periode}).xlsx"
```

**`type = "studentActiveInactive"` — Status Aktif/Nonaktif**

```
Prisma query: reregisterDetail.findMany({
  where: reregister.periodId = uid
})
select: student (nim, nama, prodi), semesterStatus

Output: "DAFTAR MAHASISWA AKTIF-NONAKTIF ({nama_periode}).xlsx"
```

**`type = "studentsRegularSore"` — Pemisahan Pagi/Sore**

```
Dua query terpisah:
  1. reregisterDetail WHERE campusType = "SORE"
  2. reregisterDetail WHERE campusType IN ["BJM", "BJB", "ONLINE"]

Digabung sebagai: [{ campusType: "SORE", students: [...] }, { campusType: "PAGI", students: [...] }]

Output: "DAFTAR MAHASISWA Reg.Pagi-Sore ({nama_periode}).xlsx"
```

**`type = "schedule"` — Jadwal Perkuliahan**

Satu-satunya tipe yang `u` adalah `scheduleId`, bukan `periodId`.

```
Prisma query: scheduleDetail.findMany({ where: scheduleId = uid })
select: dayName, time (timeStart), room, academicClass (nama, semester, dosen, matkul)

Pemisahan Reg.Pagi vs Reg.Sore:
  Pagi: timeStart.getHours() < 15
  Sore: timeStart.getHours() >= 15

Kedua kelompok diurutkan per hari sesuai dayName (dari setting)

Output: "JADWAL PERKULIAHAN {NAMA_PERIODE}.xlsx"
```

---

### 4.5 `GET /api/pdf`

**File:** `src/app/api/pdf/route.ts`

**Tujuan:** Endpoint multi-fungsi yang menghasilkan berbagai dokumen PDF akademik. Sama seperti `/api/excel` tetapi outputnya PDF dan mendukung lebih banyak tipe dokumen individual (KRS, KHS, transkrip, herregistrasi).

**Parameter:**
- `?u=uuid` — ID berbeda tergantung `type` (lihat detail per tipe)
- `?type=...` — jenis dokumen

**Inisialisasi bersama:**
```typescript
const date = format(new Date(), 'dd MMMM yyyy', { locale: indonesianLocale });
const dataPeriod = await prisma.period.findUnique({ where: { id: uid } });
const dataMajor = await prisma.major.findMany({ ... });
// Load logo untuk disematkan ke PDF:
const logoFile = await readFile(path.join(cwd, 'public', 'logo.png'));
const img = `data:image/png;base64,${logoFile.toString('base64')}`;
```

---

**`type = "assessment"` — Daftar Nilai Kelas (`u` = academicClassId)**

Sama logika dengan `/api/grade`, tetapi outputnya PDF bukan Excel.  
Menggunakan `lecturerName()` untuk menggabungkan gelar dosen.

```
Output: "DAFTAR NILAI ({kode}) {nama_matkul} - KELAS {nama_kelas}.pdf"
```

---

**`type = "krs"` — Kartu Rencana Studi (`u` = krsId)**

```
Query 1: krs.findUnique({ id: uid })
  select: student (nama, nim, prodi), reregister → period, maxSks, ips,
          lecturer (nama + gelar), krsDetail → course (nama, SKS, kode, isAcc)

Query 2: reregisterDetail.findUnique({ reregisterId_studentId: { ... } })
  → untuk mendapat nomor semester

Data ke renderPdf:
  krsStudent (+ ips sebagai Number), lecturerNameKrs, semester, logo, tanggal

Output: "{nim}(KRS-{nama_periode}).pdf"
```

**Informasi di KRS:** Nama mahasiswa, NIM, program studi, daftar mata kuliah beserta status persetujuan (`isAcc`), nama dosen wali, semester, IPS, dan maksimal SKS.

---

**`type = "khs"` — Kartu Hasil Studi (`u` = khsId)**

```
Query 1: khs.findUnique({ id: uid })
  select: student (nama, nim, prodi), semester, period (nama), ips, maxSks

Query 2: position.findFirst({ positionName contains "KAPRODI SI" atau "KAPRODI TI" })
  → nama dan jabatan kaprodi untuk tanda tangan di KHS
  (logika: prodi "sistem informasi" → KAPRODI SI, lainnya → KAPRODI TI)

Query 3: khsDetail.findMany({ where: khsId AND isLatest: true })
  select: course (kode, nama, sks), gradeLetter, weight

Hitung lokal:
  totalSKS = sum(course.sks)
  totalSKSxNAB = sum(course.sks × weight)

Output: "{nim}(KHS-{nama_periode}).pdf"
```

---

**`type = "transcript"` — Transkrip Akademik (`u` = studentId)**

Ini adalah logika **paling kompleks** di seluruh API. Semua dikerjakan dalam satu Prisma `$transaction`.

```
Tahap 1 — Ambil riwayat KHS:
  student.findUnique({ id })
  select: nama, nim, khs → khsDetail (isLatest, ANNOUNCEMENT, bukan skripsi)
          → course (id, kode, nama, sks, courseType, isPKL, isSkripsi)

Tahap 2 — Ambil kurikulum aktif:
  curriculum.findFirst({ ada di antara course yang sudah diambil })
  select: nama, prodi, curriculumDetail → course (+ predecessor + successor)

Tahap 3 — Mapping "selesai" vs "belum selesai":
  Untuk setiap khsDetail:
    Cari courseInCurriculum (cek course.id, atau predecessor.id, atau successor.id)
    → ini untuk menangani perubahan kurikulum (kode/nama matkul lama ke baru)
    Jika ditemukan:
      Tambahkan ke 'coursesFinish' (key: courseInCurriculum.course.id)
      Hapus dari curriculumDetail (agar tidak dihitung ganda)
      Jika courseType === "PILIHAN_KONSENTRASI" → akumulasi SKS konsentrasi

Tahap 4 — Hitung kebutuhan matkul pilihan konsentrasi:
  Target: 9 SKS pilihan konsentrasi (3 matkul × 3 SKS)
  Jika kurang, tambahkan placeholder "PILIHAN" ke 'coursesUnfinish'

Tahap 5 — Sorting dan pemisahan:
  courseSorting() → urutkan berdasarkan semester
  Pisahkan: courseIsnPkl (bukan PKL) | courseIsPkl (PKL) → [...courseIsnPkl, ...courseIsPkl]

Tahap 6 — Hitung akademik:
  totalSKS, totalBobot, IPK = (totalBobot / totalSKS).toFixed(2)
  totalSKSUnfinish = SKS mata kuliah yang belum selesai

Return 7 nilai dari transaction:
  [dataStudent, coursesFinal, coursesUnfinishSorted,
   totalSKSTranscript, totalSKSUnfinish, totalBobotTranscript, gpaCalculation]

Output: "{nim}(TRANSCRIPT).pdf"
```

**Kenapa ada logic predecessor/successor?** Kurikulum bisa berubah; mata kuliah lama mungkin digantikan oleh mata kuliah baru (successor). Jika mahasiswa sudah mengambil mata kuliah lama (predecessor), itu dianggap sudah memenuhi persyaratan mata kuliah baru di kurikulum saat ini.

---

**`type = "reregister"` — Formulir Herregistrasi (`u` = "reregisterId:studentId")**

Format parameter `u` unik: gabungan dua UUID dipisahkan titik dua (`:`).

```typescript
const [reregisterId, studentId] = uid.split(':');
```

```
Query: reregisterDetail.findUnique({ reregisterId_studentId: { reregisterId, studentId } })
  select: semester, campusType, reregister → period (nama, semesterType, year)
          student → nim, nama, prodi, tempat lahir, tanggal lahir, alamat, domisili,
                    email, hp, wali (nama, NIK, hp, pekerjaan, alamat), ibu kandung

Proses:
  - Format tanggal lahir: dd/MM/yyyy
  - Terjemahkan campusType: "BJB" → "BANJARBARU", "BJM" → "BANJARMASIN"

Output: "{nim}(HERREGISTRASI-{nama_periode}).pdf"
```

---

**`type = "coursekrs"` (PDF) — Rekapitulasi Mata Kuliah (`u` = periodId)**

Mirip dengan Excel `coursekrs` tetapi lebih sederhana: hanya hitung jumlah mahasiswa per mata kuliah tanpa pemisahan campusType dan angkatan.

```
Query 1: curriculumDetail.findMany (semester yang relevan, kurikulum aktif)
Query 2: krsDetail.groupBy(['courseId']) → _count mahasiswa yang ambil tiap matkul

Gabungkan: setiap matkul dapat field 'studentCount'
Group per prodi → dataCoursesByMajor

Output: "REKAPITULASI MATA KULIAH ({nama_periode}).pdf"
```

---

**`type = "studentsRegisteredKrs"` hingga `"studentsRegularSore"` (PDF)**  
Logika identik dengan versi Excel — query sama, data sama — hanya fungsi outputnya yang berbeda (`renderPdf` bukan `exportXxx`). Perbedaan minor:
- `studentsTakingThesis` dan `studentsTakingInternship` pada versi PDF lebih sederhana (tidak menghitung IPK transcript per mahasiswa secara individual)
- `studentActiveInactive` pada PDF diurutkan berdasarkan `semesterStatus` ASC

---

## 5. Alur Eksekusi Lengkap

Berikut contoh **alur penuh end-to-end** untuk dua skenario representatif:

### Skenario A: Mahasiswa mengunduh KRS

```
[Browser]
  Klik tombol "Download KRS"
  → <a href="/api/pdf?u={krsId}&type=krs" download>

[Next.js Router]
  → Matches /api/pdf/route.ts
  → Panggil GET(req)

[GET /api/pdf]
  1. Parse: uid = krsId, type = "krs"
  2. Baca logo.png → base64
  3. Format tanggal hari ini (Indonesian locale)
  4. case "krs":
     a. prisma.krs.findUnique(krsId)
        → student: nim, nama, prodi
        → reregister: period (nama, semesterType)
        → lecturer: nama + gelar (frontTitle/backTitle)
        → krsDetail: [{ course: { nama, sks, kode }, isAcc }]
     b. prisma.reregisterDetail.findUnique(reregisterId + studentId)
        → semester
     c. lecturerName({ frontTitle, name, backTitle })
        → "Dr. Budi Santoso, M.Kom."
     d. renderPdf({
          type: "krs",
          data: { krsStudent, lecturerNameKrs, semester, img, date }
        })
        → Buffer PDF
  5. Response:
     Content-Type: application/pdf
     Content-Disposition: attachment; filename="12345678(KRS-Semester Ganjil 2025-2026).pdf"
     Body: Uint8Array(pdfBuffer)

[Browser]
  → File KRS.pdf ter-download
```

---

### Skenario B: Admin mengunduh Excel Rekapitulasi Mata Kuliah

```
[Browser]
  Klik "Export Excel" di halaman laporan periode
  → <a href="/api/excel?u={periodId}&type=coursekrs">

[GET /api/excel]
  1. Parse: uid = periodId, type = "coursekrs"
  2. prisma.period.findUnique(uid) → dataPeriod (nama, semesterType)
  3. prisma.major.findMany() → dataMajor (semua prodi)
  4. case "coursekrs":
     a. semesterQuery = semesterType === "GANJIL" ? [1,3,5,7] : [2,4,6,8]
     b. prisma.curriculumDetail.findMany(semester in semesterQuery, kurikulum aktif)
        → list mata kuliah dengan kode, nama, semester, prodi
        Inisialisasi: .BJB=0, .BJM=0, .ONLINE=0, .SORE=0, .angkatan={}, .totalStudents=0
     c. prisma.krsDetail.findMany(reregister.periodId = uid)
        select: courseId, krs → student.year, reregisterDetail.campusType
     d. Loop coursesInStudyPlan:
        - Temukan mata kuliah di 'report' berdasarkan courseId
        - Increment BJB/BJM/ONLINE/SORE sesuai campusType
        - Tambah ke years Set
        - Increment angkatan[year]
        - Increment totalStudents
     e. finalReport: untuk setiap matkul, buat row dengan kolom dinamis per angkatan
     f. dataCoursesByMajor: group finalReport per prodi
     g. exportCourseTaken({ dataPeriod, dataCoursesByMajor, years })
        → Buffer Excel
  5. Response:
     Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
     Content-Disposition: attachment; filename="REKAPITULASI MATA KULIAH (Semester Ganjil 2025-2026).xlsx"
```

---

## 6. Pola Arsitektur dan Catatan Penting

### Pola yang Konsisten

1. **Validasi awal**: Semua endpoint memeriksa parameter wajib di awal dan return 400 jika tidak ada.
2. **Binary response**: Semua file dikembalikan sebagai `Uint8Array` dalam body `NextResponse`.
3. **Content-Disposition**: File yang ingin di-download menggunakan `attachment; filename="..."`. File yang ingin ditampilkan langsung menggunakan `inline`.
4. **Error catch global**: Setiap endpoint membungkus seluruh logika dalam `try/catch` dan return 400 jika terjadi error.
5. **Pengelompokan per prodi**: Hampir semua laporan (Excel dan PDF) mengelompokkan data berdasarkan `major`, menggunakan `dataMajor.map(major => ({ major, items: data.filter(item => item.major.id === major.id) }))`.

### Inkonsistensi yang Perlu Diperhatikan

| Masalah | Lokasi | Penjelasan |
|---------|--------|-----------|
| `error(err)` dari `console` | `excel/route.ts` | Seharusnya `logger.error(err)` seperti di `pdf/route.ts` dan `grade/route.ts` |
| `await await prisma...` (double await) | `excel/route.ts:516`, `excel/route.ts:552` | Redundan, meskipun tidak menyebabkan bug karena Promise di-await dua kali tetap valid |
| Parameter `u` untuk `schedule` | `excel/route.ts` | Untuk semua tipe lain `u` = periodId, tetapi untuk `schedule` `u` = scheduleId. Tidak konsisten dan mudah membingungkan |
| Transcript `studentsTakingThesis` berbeda antara Excel dan PDF | `excel/route.ts` vs `pdf/route.ts` | Versi Excel menghitung IPK transcript per mahasiswa; versi PDF tidak |
| `pdf/route.ts`: `default: break` tanpa response | `pdf/route.ts:1039` | Jika `type` tidak dikenal, tidak ada response yang dikembalikan (implicit undefined response) |

### Tidak Ada Autentikasi di Level Route

Tidak ada pengecekan sesi/token di dalam route handler ini. Autentikasi kemungkinan dilakukan oleh:
- Next.js Middleware (`middleware.ts`) yang memvalidasi cookie sebelum request mencapai route
- Atau asumsi bahwa URL endpoint tidak diketahui publik (security by obscurity — tidak direkomendasikan)

Ini berarti siapa pun yang mengetahui URL dengan ID yang valid dapat mengakses data akademik tanpa login.

### Overlapping Excel dan PDF

Delapan dari dua belas tipe PDF identik dengan tipe Excel (hanya beda format output). Ini menunjukkan peluang refactoring: logika query database bisa diekstrak ke fungsi bersama, sehingga route handler hanya memilih format output di akhir.

### Ringkasan Dependency Graph

```
/api/avatar   → fs/promises, mime, env(AVATAR_FOLDER)
/api/payment  → fs/promises, mime, env(PAYMENT_FOLDER)
/api/grade    → prisma, @/lib/excel/exportAssessmentGrade, exportAssessmentTemplate, logger
/api/excel    → prisma, @/lib/excel/* (8 fungsi), @/lib/utils, @/lib/setting
/api/pdf      → prisma, @/lib/renderPdf, @/lib/utils, date-fns(id locale), fs/promises(logo), logger
```
