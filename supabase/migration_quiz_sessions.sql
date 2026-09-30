-- ============================================================================
--  KuisKita — Migrasi: riwayat sesi kuis (tabel "quiz_sessions")
--
--  Jalankan SEKALI di Supabase Dashboard -> SQL Editor -> New query -> Run.
--
--  Setiap game selesai, skor akhir game itu otomatis disalin ke arsip
--  (siapa, berapa, kelas & materi apa, kapan), lalu semua poin kelas tersebut
--  dinol-kan supaya game berikutnya mulai dari 0. Games yang belum selesai
--  (guru keluar di tengah kuis) tidak diarsipkan.
--  Sengaja disimpan sebagai snapshot teks (tanpa foreign key ke
--  students/classes) supaya riwayat tidak ikut hilang saat siswa/kelas
--  dihapus atau diganti namanya.
--
--  Skrip ini aman dijalankan ulang (idempotent).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel quiz_sessions (satu baris per game yang selesai)
-- ----------------------------------------------------------------------------
create table if not exists public.quiz_sessions (
  id             uuid primary key default gen_random_uuid(),
  class_name     text not null,
  subject_label  text not null,
  question_count integer not null default 0,
  played_at      timestamptz not null default now(),
  constraint quiz_sessions_names_not_blank
    check (char_length(btrim(class_name)) between 1 and 60
       and char_length(btrim(subject_label)) between 1 and 60)
);

create index if not exists quiz_sessions_played_idx
  on public.quiz_sessions (played_at desc);

-- ----------------------------------------------------------------------------
-- 2. Tabel session_scores (peringkat akhir tiap game)
-- ----------------------------------------------------------------------------
create table if not exists public.session_scores (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.quiz_sessions (id) on delete cascade,
  student_name text not null,
  score        integer not null default 0,
  constraint session_scores_score_not_negative check (score >= 0)
);

create index if not exists session_scores_session_score_idx
  on public.session_scores (session_id, score desc);

-- ----------------------------------------------------------------------------
-- 3. Row Level Security (sama seperti tabel lain: terbuka untuk demo kelas)
-- ----------------------------------------------------------------------------
alter table public.quiz_sessions enable row level security;
alter table public.session_scores enable row level security;

drop policy if exists quiz_sessions_select_public on public.quiz_sessions;
drop policy if exists quiz_sessions_insert_public on public.quiz_sessions;
drop policy if exists quiz_sessions_update_public on public.quiz_sessions;
drop policy if exists quiz_sessions_delete_public on public.quiz_sessions;

create policy quiz_sessions_select_public on public.quiz_sessions
  for select to anon, authenticated using (true);

create policy quiz_sessions_insert_public on public.quiz_sessions
  for insert to anon, authenticated with check (true);

create policy quiz_sessions_update_public on public.quiz_sessions
  for update to anon, authenticated using (true) with check (true);

create policy quiz_sessions_delete_public on public.quiz_sessions
  for delete to anon, authenticated using (true);

drop policy if exists session_scores_select_public on public.session_scores;
drop policy if exists session_scores_insert_public on public.session_scores;
drop policy if exists session_scores_update_public on public.session_scores;
drop policy if exists session_scores_delete_public on public.session_scores;

create policy session_scores_select_public on public.session_scores
  for select to anon, authenticated using (true);

create policy session_scores_insert_public on public.session_scores
  for insert to anon, authenticated with check (true);

create policy session_scores_update_public on public.session_scores
  for update to anon, authenticated using (true) with check (true);

create policy session_scores_delete_public on public.session_scores
  for delete to anon, authenticated using (true);

-- Selesai. Riwayat mulai terisi otomatis begitu ada game yang selesai.
