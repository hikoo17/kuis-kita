# 🎯 KuisKita — Kuis Kelas Interaktif

Aplikasi kuis kelas berbasis web untuk **SMA**: siswa memilih nama, memilih materi, menjawab soal,
mendapat umpan balik, mengumpulkan poin, lalu melihat hasil akhir kelas. Setiap game yang selesai
otomatis tersimpan ke **Riwayat**.

Dibuat dengan **Vue 3 + Vite + Tailwind CSS + Supabase**. Seluruh tampilan menggunakan **Bahasa Indonesia**,
sedangkan kode, nama variabel, nama komponen, dan kolom database tetap Bahasa Inggris.

---

## ✨ Fitur

- **Layar kuis untuk proyektor** — tipografi besar, tombol besar, mudah dibaca dari belakang kelas.
- **Pilih Siswa** — kartu nama siswa dengan poin masing-masing.
- **Pilih Materi** — daftar materi diambil otomatis dari tabel `questions`, plus opsi **Semua Materi**.
- **Pilihan Ganda & Isian Singkat** — pilihan ganda bisa berisi **lebih dari 4 pilihan** (A, B, C, D, E, ...)
  dan dipilih dengan klik; isian singkat dikirim dengan tombol **Enter**.
- **Pemeriksaan jawaban yang toleran** — tidak membedakan huruf besar/kecil dan mengabaikan spasi di tepi
  (`Jakarta`, `jakarta`, ` JAKARTA ` dianggap sama).
- **Umpan balik gaya game show** — overlay **Benar! +10 Poin** dengan konfeti ringan,
  **Belum Tepat!** yang tetap positif (tersedia **Coba Lagi** / **Lanjut**), serta
  **Waktu Habis!** tanpa membocorkan kunci jawaban (pilihannya **Ganti Siswa** / **Lanjut**).
- **Timer menjawab** — setiap giliran dibatasi waktu (bawaan 30 detik, bisa diubah di
  Pengaturan Kuis, 0 = tanpa batas). Bar berubah merah + bunyi tik di 10 detik terakhir.
- **Efek suara & musik latar** — dibuat langsung dengan Web Audio API (tanpa file audio):
  efek untuk pilih nama, pilih materi, jawaban benar/salah, streak, dan fanfare saat kuis selesai;
  plus musik latar lembut yang bisa di-loop. Ada tombol on/off terpisah untuk keduanya di header
  dan pengaturan volume di Dashboard Guru.
- **Papan Skor** — peringkat otomatis, podium juara, dan pembaruan **Realtime** dari Supabase.
- **Arsip otomatis** — begitu kuis selesai (soal terakhir selesai dikerjakan), hasil akhir
  (peringkat kelas itu) langsung tersimpan di tab **Riwayat**, lalu poin kelas dinol-kan untuk
  game berikutnya. Games yang belum selesai **tidak** diarsipkan dan poinnya ikut direset.
- **Gambar soal (opsional)** — guru bisa melampirkan gambar (JPG/PNG/WebP, maks 5 MB) pada soal;
  gambar tersimpan di Supabase Storage dan ikut tampil saat kuis berjalan.
- **Streak ringan** — `🔥 3 Streak!` selama sesi kuis (tidak disimpan ke database).
- **Proteksi klik ganda** — poin ditambahkan lewat fungsi database (RPC) yang atomik.
- **Dashboard Guru** — Kelola Kelas, Kelola Siswa, Kelola Soal (dipilih per materi lewat kartu),
  dan Pengaturan Kuis. Tombol aksi memakai ikon **Lucide** (`@lucide/vue`) yang selalu terlihat
  — Edit, Reset, dan Hapus berupa tombol ikon dengan tooltip Bahasa Indonesia.
- **Banyak kelas, satu guru** — siswa dikelompokkan per kelas (`X-1`, `XI IPA 2`, ...),
  kuis dan papan skor berjalan per kelas. Bank soal dipakai bareng semua kelas.
- **Arsip otomatis** — hasil game tersimpan sendiri ke Riwayat begitu kuis selesai
  (lihat poin di atas), lalu poin kelas dinol-kan untuk game berikutnya.

---

## 🚀 Menjalankan Aplikasi

### 1. Prasyarat

- Node.js 18 atau lebih baru
- Akun/proyek [Supabase](https://supabase.com) (gratis)

### 2. Siapkan database

1. Buka **Supabase Dashboard → SQL Editor → New query**.
2. Salin seluruh isi file [`supabase/schema.sql`](supabase/schema.sql) lalu klik **Run**.
3. Skrip ini akan membuat semua tabel (`students`, `questions`, `subjects`, `subject_scores`,
   `classes`, `quiz_sessions`, `session_scores`), constraint, index, RLS policy, bucket Storage
   `question-images`, fungsi RPC `increment_student_score`, konfigurasi Realtime, dan data contoh.

### 3. Isi environment

Salin `.env.example` menjadi `.env`, lalu isi dari
**Supabase Dashboard → Project Settings → API**:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ADMIN_PIN=1234
```

> ⚠️ Jangan pernah menaruh **Service Role Key** di kode frontend. Hanya gunakan URL dan **anon key**.

### 4. Jalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`, lalu masukkan PIN guru (bawaan `1234`) untuk membuka
menu **Kuis** dan **Dashboard**. Menu navigasi (atas di desktop, bar bawah di layar kecil)
baru tampil setelah berhasil masuk.

Untuk build produksi:

```bash
npm run build
npm run preview
```

### 5. Deploy ke Vercel

Aplikasi ini SPA (vue-router mode history), jadi butuh aturan *rewrite* semua rute ke
`index.html`. Itu sudah disediakan di [`vercel.json`](vercel.json).

**Cara A — dari dashboard Vercel (tanpa CLI):**

1. Push proyek ini ke GitHub/GitLab lalu **Import Project** di [vercel.com/new](https://vercel.com/new).
2. Framework akan terdeteksi **Vite**; build `npm run build`, output `dist` (otomatis dari `vercel.json`).
3. Di **Settings → Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PIN`
4. **Deploy**. Setiap push berikutnya akan otomatis ter-deploy ulang.

**Cara B — Vercel CLI:**

```bash
npm i -g vercel      # sekali saja
vercel login         # masuk lewat browser/email
vercel               # deploy preview
vercel --prod        # deploy produksi
```

Saat pertama kali, CLI akan membuat project. Tambahkan env var-nya:

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_ADMIN_PIN production
```

> ⚠️ Env var di atas dibaca **saat build**. Kalau diisi setelah deploy, lakukan
> **Redeploy** supaya nilai barunya terpakai. Hanya pakai URL + anon/publishable key —
> jangan pernah `service_role`/secret key.

---

## 🗂️ Struktur Proyek

```text
src/
├── components/
│   ├── ClassSelector.vue       # kartu pilih kelas
│   ├── SubjectSelector.vue     # kartu pilih materi
│   ├── QuestionCard.vue        # wadah teks soal + gambar soal
│   ├── MatrixText.vue          # menampilkan matriks bertumpuk dari teks soal
│   ├── MultipleChoice.vue      # tombol pilihan A, B, C, D, ... (bisa lebih dari 4)
│   ├── ShortAnswer.vue         # input jawaban singkat
│   ├── AnswerFeedback.vue      # overlay Benar! / Belum Tepat!
│   ├── Leaderboard.vue         # daftar papan skor (samping soal & hasil akhir)
│   ├── ScoreDisplay.vue        # badge poin + streak (vertikal)
│   ├── InfoButton.vue          # tombol ikon info
│   ├── InfoModal.vue           # modal penjelasan
│   ├── ConfettiBurst.vue       # konfeti ringan
│   ├── TurnCountdown.vue       # overlay hitung mundur giliran
│   └── ConfirmModal.vue        # dialog konfirmasi
├── views/
│   ├── QuizView.vue            # alur utama kuis + layar hasil
│   ├── AdminLogin.vue          # masuk guru (PIN)
│   └── AdminDashboard.vue      # dashboard guru
├── composables/
│   ├── useStudents.js          # CRUD siswa + tambah poin
│   ├── useQuestions.js         # CRUD soal + gambar + filter materi
│   ├── useQuiz.js              # alur & status kuis
│   ├── useLeaderboard.js       # peringkat per materi + per kelas + Realtime
│   ├── useSubjectScores.js     # skor per materi (tabel subject_scores)
│   ├── useQuizSessions.js      # arsip game selesai (tabel quiz_sessions)
│   ├── useClasses.js           # CRUD kelas (tabel classes)
│   ├── useSound.js             # efek suara (Web Audio API)
│   ├── useMusic.js             # musik latar loop (Web Audio API)
│   ├── useSubjects.js          # CRUD materi (tabel subjects)
│   ├── useSettings.js          # pengaturan kuis (localStorage)
│   ├── useConfirm.js           # dialog konfirmasi (mis. keluar di tengah kuis)
│   └── useAdminAuth.js         # sesi login guru
├── lib/
│   ├── matrixText.js           # memecah teks soal + matriks untuk ditampilkan
│   └── supabaseClient.js
├── router/
│   └── index.js
├── App.vue
├── main.js
└── style.css
supabase/
├── schema.sql                   # skema penuh (untuk project baru)
├── migration_subjects.sql       # migrasi tabel subjects (untuk DB yang sudah ada)
├── migration_subject_scores.sql # migrasi skor per materi (untuk DB yang sudah ada)
├── migration_quiz_sessions.sql  # migrasi arsip sesi (untuk DB yang sudah ada)
├── migration_classes.sql        # migrasi tabel classes (untuk DB yang sudah ada)
└── migration_question_images.sql # migrasi kolom gambar + bucket Storage (untuk DB yang sudah ada)
```

---

## 🔄 Alur Kuis

```text
Muat kelas, siswa & materi
        ↓
Pilih kelas (satu guru bisa banyak kelas)
        ↓
Pilih materi (sekali saja, bank soal dipakai bareng)
        ↓
Soal tampil — semua siswa ikut melihat & berpikir
        ↓
Pilih siswa sekelas yang menjawab (di layar soal yang sama)
        ↓
Hitung mundur 3 - 2 - 1 - Mulai! (dengan bunyi, sekali per kuis)
        ↓
Tampilkan soal (+ musik latar mulai)
        ↓
Pilih siswa yang menjawab → timer berjalan
        ↓
Siswa menjawab (atau waktu habis)
        ↓
Periksa jawaban
   ┌────────────┴────────────┐
 Benar                 Belum Tepat / Waktu Habis (bunyi gagal)
   ↓                          ↓
+10 poin (atomik)      Coba Lagi / Ganti Siswa = soal sama, pilih siswa lagi
                       Lanjut = soal berikutnya tanpa poin
   ↓
Update papan skor
   ↓
Soal berikutnya (terkunci) → pilih siswa lagi → timer jalan
   ↓
Semua soal habis → Kuis Selesai (musik berhenti + fanfare)
   ↓
Game otomatis diarsipkan ke Riwayat → poin kelas dinol-kan → tombol "Kembali" ke awal
```

Poin **hanya** ditambahkan saat jawaban benar, dan dilakukan di dalam satu transaksi
database (`increment_student_score`) sehingga klik ganda tidak bisa menambah poin dua kali.
Selama jawaban diproses, tombol jawaban dinonaktifkan. Games yang belum selesai (guru keluar
di tengah kuis) tidak diarsipkan dan poin game itu direset; tombol "Kembali" di tengah kuis
meminta konfirmasi dulu.

---

## 📚 Mengelola Soal (bertahap)

Menu **Kelola Soal** bekerja dua tingkat supaya tidak menumpuk, dan form-nya dipisah:
**tambah materi dulu, baru isi soal**.

```text
TINGKAT 1 — daftar materi (+ form Tambah Materi)
[Tulis nama materi...] [Tambah Materi]

┌──────────────┐ ┌──────────────┐
│ 📘 Matriks   │ │ 📘 Aljabar   │   [Edit] [Hapus] di tiap kartu
│ 3 soal       │ │ 2 soal       │
│ PG 2 · Isian 1│ │ PG 1 · Isian 1│
└──────────────┘ └──────────────┘
        │ klik kartu
        ▼
TINGKAT 2 — soal di dalam materi itu (+ form Tambah Soal)
[← Kembali]           Matriks            [ + Tambah Soal ]
  • daftar soal materi ini, lengkap dengan Edit / Hapus
```

- Setiap materi tampil sebagai **kartu** berisi jumlah soal dan rinciannya (Pilihan Ganda / Isian).
  Materi yang baru dibuat dan masih kosong tetap tampil dengan `0 soal`.
- Klik kartu → masuk ke materi itu. Kolom **Materi** otomatis terkunci pada materi tersebut,
  jadi guru tidak perlu memilihnya lagi tiap kali menambah soal.
- **Edit** pada kartu mengubah nama materi — semua soalnya ikut pindah otomatis.
- **Hapus** pada kartu menghapus materi **beserta semua soalnya** (ada dialog konfirmasi
  yang menyebutkan jumlah soal).
- Soal hanya dimuat saat kartunya diklik, sehingga daftar tetap ringkas walau soal banyak.

> ℹ️ Daftar materi disimpan di tabel **`subjects`**. Kalau database dibuat sebelum tabel ini ada,
> jalankan sekali file **`supabase/migration_subjects.sql`** di SQL Editor (materi yang sudah
> dipakai soal lama akan diisi otomatis). Selama migrasi belum dijalankan, aplikasi tetap jalan
> dengan daftar materi turunan dari soal — hanya tambah/edit/hapus materi yang nonaktif.

### Menulis matriks pada soal

Ada dua cara menampilkan matriks pada soal:

1. **Lampirkan gambar** (dipakai soal Matriks saat ini) — buat gambar matriks (mis. `P = [ ... ]`),
   lalu unggah lewat kolom **Gambar Soal** di form soal. Gambar tampil di bawah pertanyaan.
2. **Tulis notasi** `[[1, 4, 7], [2, 5, 8]]` di teks soal — aplikasi otomatis merendernya menjadi
   matriks bertumpuk lengkap dengan tanda kurung, baik saat kuis maupun di daftar soal.

Keduanya membuat siswa tidak bingung membaca deretan angka.

### Gambar soal

Form soal punya kolom **Gambar Soal (opsional)**: pilih berkas JPG/PNG/WebP (maks 5 MB), lihat
pratinjaunya, dan ganti/hapus lewat tombol yang tersedia. Gambar diunggah ke bucket Storage
**`question-images`** (publik) dan URL-nya disimpan di kolom `questions.image_url`; gambar otomatis
tampil saat kuis. Gambar lama dibersihkan saat diganti/dihapus.

> ℹ️ Fitur gambar butuh sekali migrasi: jalankan **`supabase/migration_question_images.sql`** di
> SQL Editor (menambah kolom `image_url` + bucket `question-images` beserta izinnya). Kalau belum
> dijalankan, guru tetap bisa menyimpan soal **tanpa** gambar; menyimpan soal bergambar akan
> menampilkan pesan agar migrasi dijalankan.

---

## 🎵 Efek Suara & Musik Latar

Semua suara dibuat dengan **Web Audio API** — tidak ada file `.mp3`/`.wav`, jadi tidak ada yang perlu
diunduh dan aplikasi tetap ringan serta bisa jalan offline.

### Efek suara

| Momen | Suara |
| --- | --- |
| Pilih nama siswa | blip pendek |
| Pilih materi | sweep naik |
| Klik pilihan A/B/C/D | klik halus |
| Jawaban **Benar** | arpeggio naik (C–E–G–C) |
| Jawaban **Belum Tepat** / **Waktu Habis** | bunyi gagal yang jelas (tiga nada turun) |
| Streak ≥ 2 | tiga blip naik |
| Soal berikutnya | whoosh kecil |
| Kuis selesai | fanfare |
| PIN guru salah / benar | nada error / nada sukses |

### Musik latar

Loop energik tanpa henti (± 7,5 detik per putaran, **128 BPM**) dari progresi akor **C–G–Am–F**:
kick empat ketukan, hi-hat di offbeat, bassline seperdelapan nada yang melompat oktaf,
stab akor di ketuk 2 & 4, plus motif melodi bel. Dirancang seperti musik game show —
semangat tapi volumenya tetap kecil supaya tidak mengganggu pelajaran.

Musik **mulai saat soal pertama tampil** dan **berhenti saat kuis selesai** (dilanjutkan fanfare).
Tombol 🎵 di header hanya muncul **saat sedang mengerjakan soal** — di halaman lain
(pilih siswa, pilih materi, Papan Skor, Dashboard Guru) tombolnya disembunyikan.

### Hitung mundur giliran

Setiap kali nama siswa dipilih, muncul overlay hitung mundur **3, 2, 1, Mulai!** dengan bunyi
tik setiap angka dan bunyi naik saat "Mulai!". Memberi jeda dramatis sebelum soal dijawab —
klik di mana saja untuk melewatinya kalau kelas sudah tidak sabar.

### Cara mengatur

Dua tombol terpisah di header:

- **🔊 / 🔇** → efek suara
- **🎵** → musik latar (redup & dicoret saat nonaktif)

Keduanya berdiri sendiri: mematikan musik tidak mematikan efek suara, dan sebaliknya.
Pengaturan lengkapnya ada di **Dashboard Guru → Pengaturan Kuis**: *Aktifkan efek suara*,
*Volume Suara*, **Tes Suara**, *Aktifkan musik latar*, *Volume Musik*, dan **Pratinjau Musik**.

Catatan teknis: browser baru mengizinkan audio setelah ada interaksi pengguna, jadi keduanya baru
berbunyi saat klik pertama (bukan saat halaman dibuka). Ini aturan browser dan tidak bisa dilewati.
Nilai `musicEnabled`/`soundEnabled` tersimpan di `localStorage` browser.

---

## 🎨 Arah Desain

- Gaya **modern + playful + energik**, seperti game show kelas — bukan aplikasi anak TK atau dashboard korporat.
- Palet warna terkontrol: latar terang, biru/ungu sebagai warna utama, kuning sebagai aksen,
  hijau untuk jawaban benar, oranye untuk perhatian, merah hanya untuk aksi merusak/error.
- Font tunggal: **Plus Jakarta Sans**.
- Animasi singkat (300–600 ms) dan konfeti ringan; tidak berlebihan.
- Diprioritaskan untuk tampilan desktop/proyektor 16:9, tetap responsif di tablet.

---

## 🔐 Keamanan (Penting)

`schema.sql` mengaktifkan **RLS** dengan policy terbuka (`anon` boleh membaca & mengubah)
supaya cocok untuk demo kelas. Artinya, siapa pun yang memegang anon key bisa mengubah data.

Untuk aplikasi **produksi**:

1. Gunakan **Supabase Auth** (login guru) — jangan hanya mengandalkan PIN di sisi klien.
2. Batasi policy tulis (`insert`/`update`/`delete`) hanya untuk peran guru yang terautentikasi,
   misalnya `to authenticated using (public.is_teacher())`.
3. Biarkan siswa hanya memiliki akses `select`.
4. Jangan pernah mengekspos `SUPABASE_SERVICE_ROLE_KEY` di frontend.

Halaman `/admin` memakai PIN sederhana di sisi klien (`VITE_ADMIN_PIN`).
Ini **bukan** proteksi yang aman — nilainya ikut ter-bundle ke browser.

---

## 📜 Skrip

| Perintah          | Kegunaan                       |
| ----------------- | ------------------------------ |
| `npm run dev`     | Menjalankan server development |
| `npm run build`   | Build produksi ke `dist/`      |
| `npm run preview` | Melihat hasil build            |
| `npm run lint`    | Cek kode dengan ESLint         |
| `npm run test`    | Jalankan unit test (Vitest)    |
| `npm run format`  | Rapikan format dengan Prettier |

> Unit test menutup fungsi murni (mis. `normalizeAnswer`, `sanitizeQuestion`, `shuffleArray`).
> Prettier disetel **opt-in** (`npm run format`) — belum dijadikan gate otomatis supaya tidak
> mengubah format template Vue yang sudah ada.
