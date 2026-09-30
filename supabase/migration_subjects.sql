-- ============================================================================
--  KuisKita — Migrasi: tabel "subjects" (materi)
--
--  Jalankan SEKALI di Supabase Dashboard -> SQL Editor -> New query -> Run.
--
--  Kenapa perlu? Sebelumnya daftar materi diambil dari kolom `questions.subject`,
--  jadi materi hanya ada kalau sudah punya soal. Dengan tabel ini, guru bisa
--  menambah materi lebih dulu, baru mengisinya dengan soal.
--
--  Skrip ini aman dijalankan ulang (idempotent).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel subjects
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
-- 2. Row Level Security
--    Sama seperti tabel lain: policy terbuka untuk demo kelas.
--    Untuk produksi, batasi tulis hanya untuk guru yang terautentikasi.
-- ----------------------------------------------------------------------------
alter table public.subjects enable row level security;

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

-- ----------------------------------------------------------------------------
-- 3. Isi otomatis dari materi yang sudah dipakai di tabel questions,
--    supaya materi yang sudah ada tidak hilang setelah migrasi.
-- ----------------------------------------------------------------------------
insert into public.subjects (name)
select distinct btrim(q.subject)
from public.questions q
where btrim(q.subject) <> ''
  and not exists (
    select 1 from public.subjects s
    where lower(btrim(s.name)) = lower(btrim(q.subject))
  );

-- ----------------------------------------------------------------------------
-- 4. Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subjects'
  ) then
    alter publication supabase_realtime add table public.subjects;
  end if;
end
$$;

alter table public.subjects replica identity full;

-- Selesai. Cek di Table Editor: tabel `subjects` harus berisi
-- Matriks, Aljabar, Fungsi, dan Sistem Persamaan.
