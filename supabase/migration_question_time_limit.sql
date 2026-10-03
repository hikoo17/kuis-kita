-- ============================================================================
--  Batas waktu per soal (opsional)
--  Menambahkan kolom time_limit pada tabel questions supaya guru bisa
--  mengatur durasi menjawab tiap soal (detik). NULL = ikut pengaturan
--  global, 0 = tanpa batas waktu untuk soal itu.
--  Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================================

-- 1. Kolom batas waktu pada soal. Aman dijalankan berulang.
alter table public.questions
  add column if not exists time_limit integer;

-- 2. Batas wajar: tidak boleh negatif.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questions_time_limit_valid'
  ) then
    alter table public.questions
      add constraint questions_time_limit_valid
      check (time_limit is null or time_limit >= 0);
  end if;
end
$$;
