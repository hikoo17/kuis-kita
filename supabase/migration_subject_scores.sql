-- ============================================================================
--  KuisKita — Migrasi: skor per materi (tabel "subject_scores")
--
--  Jalankan SEKALI di Supabase Dashboard -> SQL Editor -> New query -> Run.
--
--  Kenapa perlu? Sebelumnya setiap siswa hanya punya satu skor total.
--  Dengan tabel ini, poin dicatat per materi (mis. Matriks: 30, Aljabar: 10),
--  sehingga tiap materi punya papan skornya sendiri. Kolom students.score
--  tetap dipakai sebagai TOTAL gabungan.
--
--  Skrip ini aman dijalankan ulang (idempotent).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel subject_scores
-- ----------------------------------------------------------------------------
create table if not exists public.subject_scores (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject    text not null,
  score      integer not null default 0,
  created_at timestamptz not null default now(),
  constraint subject_scores_subject_not_blank check (char_length(btrim(subject)) between 1 and 60),
  constraint subject_scores_score_not_negative check (score >= 0),
  constraint subject_scores_student_subject_unique unique (student_id, subject)
);

create index if not exists subject_scores_student_idx on public.subject_scores (student_id);
create index if not exists subject_scores_subject_score_idx on public.subject_scores (subject, score desc);

-- ----------------------------------------------------------------------------
-- 2. Row Level Security (sama seperti tabel lain: terbuka untuk demo kelas)
-- ----------------------------------------------------------------------------
alter table public.subject_scores enable row level security;

drop policy if exists subject_scores_select_public on public.subject_scores;
drop policy if exists subject_scores_insert_public on public.subject_scores;
drop policy if exists subject_scores_update_public on public.subject_scores;
drop policy if exists subject_scores_delete_public on public.subject_scores;

create policy subject_scores_select_public on public.subject_scores
  for select to anon, authenticated using (true);

create policy subject_scores_insert_public on public.subject_scores
  for insert to anon, authenticated with check (true);

create policy subject_scores_update_public on public.subject_scores
  for update to anon, authenticated using (true) with check (true);

create policy subject_scores_delete_public on public.subject_scores
  for delete to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- 3. RPC tambah poin: total (students.score) + per materi (subject_scores)
--    dalam satu transaksi database, jadi klik ganda tetap aman.
-- ----------------------------------------------------------------------------
create or replace function public.increment_student_score(
  p_student_id uuid,
  p_points integer,
  p_subject text default null
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_student public.students;
  clean_subject text;
begin
  if p_points is null or p_points < 1 then
    raise exception 'Poin harus minimal 1.';
  end if;

  update public.students
     set score = score + p_points
   where id = p_student_id
  returning * into updated_student;

  if updated_student.id is null then
    raise exception 'Siswa tidak ditemukan.';
  end if;

  clean_subject := btrim(coalesce(p_subject, ''));
  if clean_subject <> '' then
    insert into public.subject_scores (student_id, subject, score)
    values (p_student_id, clean_subject, p_points)
    on conflict (student_id, subject)
    do update set score = public.subject_scores.score + excluded.score;
  end if;

  return updated_student;
end;
$$;

grant execute on function public.increment_student_score(uuid, integer, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Realtime — agar papan skor per materi ikut berubah tanpa refresh.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subject_scores'
  ) then
    alter publication supabase_realtime add table public.subject_scores;
  end if;
end
$$;

alter table public.subject_scores replica identity full;

-- Selesai. Skor lama (students.score) tetap menjadi total dan tidak diubah.
-- Skor per materi mulai tercatat dari jawaban benar berikutnya.
