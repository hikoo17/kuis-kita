-- ============================================================================
--  KuisKita — Skema Database Supabase
--  Salin seluruh isi file ini ke Supabase Dashboard -> SQL Editor -> New query
--  lalu klik "Run".
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel students
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  score      integer not null default 0,
  created_at timestamptz not null default now(),
  constraint students_name_not_blank check (char_length(btrim(name)) between 1 and 60),
  constraint students_score_not_negative check (score >= 0)
);

-- Nama siswa tidak boleh sama dalam satu kelas
-- (tanpa membedakan huruf besar/kecil dan spasi tepi).
-- Index lama (nama unik global) dihapus oleh migrasi kelas.
drop index if exists public.students_name_unique_idx;

create unique index if not exists students_class_name_unique_idx
  on public.students (class_id, lower(btrim(name)));

-- Membantu pengurutan papan skor.
create index if not exists students_score_idx
  on public.students (score desc);

-- ----------------------------------------------------------------------------
-- 2. Tabel questions
-- ----------------------------------------------------------------------------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  subject        text not null,
  type           text not null,
  question_text  text not null,
  options        jsonb,
  correct_answer text not null,
  image_url      text,
  created_at     timestamptz not null default now(),
  constraint questions_subject_not_blank check (char_length(btrim(subject)) between 1 and 60),
  constraint questions_type_valid check (type in ('multiple_choice', 'short_answer')),
  constraint questions_text_not_blank check (char_length(btrim(question_text)) >= 1),
  constraint questions_answer_not_blank check (char_length(btrim(correct_answer)) >= 1),
  -- Pilihan ganda wajib memiliki minimal 2 opsi berupa array JSON.
  constraint questions_options_valid check (
    type = 'short_answer'
    or (
      type = 'multiple_choice'
      and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) >= 2
    )
  )
);

create index if not exists questions_subject_idx      on public.questions (subject);
create index if not exists questions_type_idx         on public.questions (type);
create index if not exists questions_subject_type_idx on public.questions (subject, type);

-- ----------------------------------------------------------------------------
-- 2b. Tabel subjects (materi)
--     Materi disimpan sendiri supaya guru bisa menambah materi lebih dulu,
--     baru mengisinya dengan soal. Kolom questions.subject merujuk ke
--     subjects.name (dicocokkan persis).
-- ----------------------------------------------------------------------------
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint subjects_name_not_blank check (char_length(btrim(name)) between 1 and 60)
);

-- Nama materi tidak boleh sama (tanpa membedakan huruf besar/kecil dan spasi tepi).
create unique index if not exists subjects_name_unique_idx
  on public.subjects (lower(btrim(name)));

create index if not exists subjects_name_idx on public.subjects (name);

-- ----------------------------------------------------------------------------
-- 2c. Tabel subject_scores (poin per materi)
--     Satu baris per pasangan siswa × materi. Kolom students.score tetap
--     dipakai sebagai TOTAL gabungan.
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
-- 2d. Tabel classes (satu guru, banyak kelas)
--     Siswa (dan skornya) menjadi milik satu kelas; bank soal/materi
--     tetap dipakai bareng semua kelas.
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint classes_name_not_blank check (char_length(btrim(name)) between 1 and 60)
);

create unique index if not exists classes_name_unique_idx
  on public.classes (lower(btrim(name)));

create index if not exists classes_name_idx on public.classes (name);

-- Hapus kelas = hapus siswa-siswinya beserta skornya (cascade).
alter table public.students
  add column if not exists class_id uuid references public.classes (id) on delete cascade;

create index if not exists students_class_idx on public.students (class_id);

-- ----------------------------------------------------------------------------
-- 2e. Tabel riwayat sesi kuis (arsip tiap game yang selesai)
--     Snapshot teks biasa (tanpa foreign key ke students/classes) supaya
--     riwayat tidak ikut hilang saat siswa/kelas dihapus atau diganti nama.
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
-- 3. Fungsi RPC: menambah poin secara atomik (aman dari klik ganda)
--    Total (students.score) + per materi (subject_scores) dicatat dalam
--    satu transaksi database.
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
-- 4. Row Level Security (RLS)
--    CATATAN KEAMANAN:
--    Policy di bawah ini SENGAJA terbuka (demo kelas / sekolah).
--    Siapa pun yang memiliki anon key dapat membaca & mengubah data.
--    Untuk produksi: aktifkan Supabase Auth, lalu batasi policy dengan
--    "to authenticated" dan peran guru yang sesungguhnya. Jangan pernah
--    menaruh Service Role Key di kode frontend.
-- ----------------------------------------------------------------------------
alter table public.students  enable row level security;
alter table public.questions enable row level security;
alter table public.subjects  enable row level security;
alter table public.subject_scores enable row level security;
alter table public.classes enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.session_scores enable row level security;

-- students
drop policy if exists students_select_public on public.students;
drop policy if exists students_insert_public on public.students;
drop policy if exists students_update_public on public.students;
drop policy if exists students_delete_public on public.students;

create policy students_select_public on public.students
  for select to anon, authenticated using (true);

create policy students_insert_public on public.students
  for insert to anon, authenticated with check (true);

create policy students_update_public on public.students
  for update to anon, authenticated using (true) with check (true);

create policy students_delete_public on public.students
  for delete to anon, authenticated using (true);

-- questions
drop policy if exists questions_select_public on public.questions;
drop policy if exists questions_insert_public on public.questions;
drop policy if exists questions_update_public on public.questions;
drop policy if exists questions_delete_public on public.questions;

create policy questions_select_public on public.questions
  for select to anon, authenticated using (true);

create policy questions_insert_public on public.questions
  for insert to anon, authenticated with check (true);

create policy questions_update_public on public.questions
  for update to anon, authenticated using (true) with check (true);

create policy questions_delete_public on public.questions
  for delete to anon, authenticated using (true);

-- subjects
drop policy if exists subjects_select_public on public.subjects;
drop policy if exists subjects_insert_public on public.subjects;
drop policy if exists subjects_update_public on public.subjects;
drop policy if exists subjects_delete_public on public.subjects;

create policy subjects_select_public on public.subjects
  for select to anon, authenticated using (true);

create policy subjects_insert_public on public.subjects
  for insert to anon, authenticated with check (true);

create policy subjects_update_public on public.subjects
  for update to anon, authenticated using (true) with check (true);

create policy subjects_delete_public on public.subjects
  for delete to anon, authenticated using (true);

-- subject_scores
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

-- classes
drop policy if exists classes_select_public on public.classes;
drop policy if exists classes_insert_public on public.classes;
drop policy if exists classes_update_public on public.classes;
drop policy if exists classes_delete_public on public.classes;

create policy classes_select_public on public.classes
  for select to anon, authenticated using (true);

create policy classes_insert_public on public.classes
  for insert to anon, authenticated with check (true);

create policy classes_update_public on public.classes
  for update to anon, authenticated using (true) with check (true);

create policy classes_delete_public on public.classes
  for delete to anon, authenticated using (true);

-- quiz_sessions
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

-- session_scores
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

-- ----------------------------------------------------------------------------
-- 5. Realtime — agar papan skor ikut berubah tanpa refresh manual.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'students'
  ) then
    alter publication supabase_realtime add table public.students;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'questions'
  ) then
    alter publication supabase_realtime add table public.questions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subjects'
  ) then
    alter publication supabase_realtime add table public.subjects;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subject_scores'
  ) then
    alter publication supabase_realtime add table public.subject_scores;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ) then
    alter publication supabase_realtime add table public.classes;
  end if;
end
$$;

alter table public.students  replica identity full;
alter table public.questions replica identity full;
alter table public.subjects  replica identity full;
alter table public.subject_scores replica identity full;
alter table public.classes replica identity full;

-- ============================================================================
-- 6. (Opsional) Data contoh — hanya diisi jika tabel masih kosong.
-- ============================================================================
insert into public.classes (name)
select v.name
from (values ('Kelas A')) as v(name)
where not exists (
  select 1 from public.classes s where lower(btrim(s.name)) = lower(v.name)
);

insert into public.students (name, class_id)
select v.name, (select c.id from public.classes c order by c.created_at limit 1)
from (values ('Adit'), ('Budi'), ('Citra'), ('Dinda'), ('Fajar'), ('Gita')) as v(name)
where not exists (select 1 from public.students);

insert into public.questions (subject, type, question_text, options, correct_answer)
select * from (
  values
    (
      'Matriks',
      'multiple_choice',
      'Jika A = [[2, 1], [3, 4]], berapakah nilai determinan A?',
      '[{"label":"A","text":"2"},{"label":"B","text":"5"},{"label":"C","text":"8"},{"label":"D","text":"11"}]'::jsonb,
      'B'
    ),
    (
      'Matriks',
      'multiple_choice',
      'Ordo matriks [[1, 2, 3], [4, 5, 6]] adalah ...',
      '[{"label":"A","text":"2 x 3"},{"label":"B","text":"3 x 2"},{"label":"C","text":"2 x 2"},{"label":"D","text":"3 x 3"}]'::jsonb,
      'A'
    ),
    (
      'Matriks',
      'short_answer',
      'Hasil dari 3 + 4 x 2 adalah ...',
      null,
      '11'
    ),
    (
      'Aljabar',
      'multiple_choice',
      'Akar-akar dari x^2 - 5x + 6 = 0 adalah ...',
      '[{"label":"A","text":"1 dan 6"},{"label":"B","text":"2 dan 3"},{"label":"C","text":"-2 dan -3"},{"label":"D","text":"1 dan 5"}]'::jsonb,
      'B'
    ),
    (
      'Aljabar',
      'short_answer',
      'Jika x + 7 = 12, berapakah nilai x?',
      null,
      '5'
    ),
    (
      'Fungsi',
      'multiple_choice',
      'Jika f(x) = 2x + 3, maka f(4) = ...',
      '[{"label":"A","text":"8"},{"label":"B","text":"9"},{"label":"C","text":"11"},{"label":"D","text":"14"}]'::jsonb,
      'C'
    ),
    (
      'Sistem Persamaan',
      'short_answer',
      'Tentukan nilai y jika x + y = 10 dan x = 4.',
      null,
      '6'
    )
) as seed(subject, type, question_text, options, correct_answer)
where not exists (select 1 from public.questions);

-- Materi contoh + materi apa pun yang sudah dipakai oleh soal yang ada.
insert into public.subjects (name)
select v.name
from (values ('Matriks'), ('Aljabar'), ('Fungsi'), ('Sistem Persamaan')) as v(name)
where not exists (
  select 1 from public.subjects s where lower(btrim(s.name)) = lower(v.name)
);

insert into public.subjects (name)
select distinct btrim(q.subject)
from public.questions q
where btrim(q.subject) <> ''
  and not exists (
    select 1 from public.subjects s
    where lower(btrim(s.name)) = lower(btrim(q.subject))
  );

-- ----------------------------------------------------------------------------
-- 5. Gambar soal (opsional)
--    Bucket Storage publik untuk gambar soal. Kolom questions.image_url
--    menyimpan URL publik gambar tersebut.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do update set public = true;

drop policy if exists question_images_read on storage.objects;
create policy question_images_read
  on storage.objects for select
  using (bucket_id = 'question-images');

drop policy if exists question_images_insert on storage.objects;
create policy question_images_insert
  on storage.objects for insert
  with check (bucket_id = 'question-images');

drop policy if exists question_images_update on storage.objects;
create policy question_images_update
  on storage.objects for update
  using (bucket_id = 'question-images')
  with check (bucket_id = 'question-images');

drop policy if exists question_images_delete on storage.objects;
create policy question_images_delete
  on storage.objects for delete
  using (bucket_id = 'question-images');
