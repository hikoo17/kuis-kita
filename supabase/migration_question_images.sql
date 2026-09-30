-- ============================================================================
--  Gambar soal (opsional)
--  Menambahkan kolom image_url pada tabel questions dan bucket penyimpanan
--  "question-images" supaya guru bisa mengunggah gambar untuk sebuah soal.
--  Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================================

-- 1. Kolom gambar pada soal. Aman dijalankan berulang.
alter table public.questions
  add column if not exists image_url text;

-- 2. Bucket publik untuk gambar soal (siapa pun bisa melihat gambarnya).
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do update set public = true;

-- 3. Kebijakan akses storage.objects khusus bucket "question-images".
--    Aplikasi memakai anon key tanpa login, jadi izin dibuka seperti tabel lain.
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
