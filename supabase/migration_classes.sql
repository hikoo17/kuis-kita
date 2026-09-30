-- ============================================================================
--  KuisKita — Migrasi: kelas (tabel "classes")
--
--  Jalankan SEKALI di Supabase Dashboard -> SQL Editor -> New query -> Run.
--
--  Satu guru bisa memegang banyak kelas. Siswa (dan skornya) menjadi milik
--  satu kelas; bank soal/materi tetap dipakai bareng semua kelas.
--  Siswa lama yang belum punya kelas otomatis dimasukkan ke "Kelas A"
--  (bisa diganti namanya lewat Dashboard Guru).
--
--  Skrip ini aman dijalankan ulang (idempotent).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel classes
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint classes_name_not_blank check (char_length(btrim(name)) between 1 and 60)
);

-- Nama kelas tidak boleh sama (tanpa membedakan huruf besar/kecil dan spasi tepi).
create unique index if not exists classes_name_unique_idx
  on public.classes (lower(btrim(name)));

create index if not exists classes_name_idx on public.classes (name);

-- ----------------------------------------------------------------------------
-- 2. Kolom class_id di students
--    Hapus kelas = hapus siswa-siswinya beserta skornya (cascade).
--    Nama siswa boleh sama asal beda kelas.
-- ----------------------------------------------------------------------------
alter table public.students
  add column if not exists class_id uuid references public.classes (id) on delete cascade;

create index if not exists students_class_idx on public.students (class_id);

drop index if exists public.students_name_unique_idx;

create unique index if not exists students_class_name_unique_idx
  on public.students (class_id, lower(btrim(name)));

-- ----------------------------------------------------------------------------
-- 3. Kelas bawaan untuk siswa yang sudah ada
-- ----------------------------------------------------------------------------
insert into public.classes (name)
select 'Kelas A'
where not exists (
  select 1 from public.classes where lower(btrim(name)) = 'kelas a'
);

update public.students
   set class_id = (select c.id from public.classes c order by c.created_at limit 1)
 where class_id is null;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (sama seperti tabel lain: terbuka untuk demo kelas)
-- ----------------------------------------------------------------------------
alter table public.classes enable row level security;

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

-- ----------------------------------------------------------------------------
-- 5. Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ) then
    alter publication supabase_realtime add table public.classes;
  end if;
end
$$;

alter table public.classes replica identity full;

-- Selesai. Cek di Table Editor: tabel `classes` harus berisi "Kelas A",
-- dan semua siswa lama sudah punya class_id.
