import { computed, ref } from 'vue'
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from '@/lib/supabaseClient'

// All questions are kept in memory for the admin dashboard and for the
// subject list. The quiz itself queries per subject (see fetchQuestionsBySubject).
/** Sentinel used by the "Semua Materi" option in the subject selector. */
export const ALL_SUBJECTS = '__all__'

/** Petunjuk ketika kolom gambar belum tersedia di database. */
export const MISSING_IMAGE_COLUMN_MESSAGE =
  'Kolom gambar belum tersedia di database. Jalankan supabase/migration_question_images.sql ' +
  'di SQL Editor Supabase terlebih dahulu.'

/** Deteksi error Postgres/PostgREST "kolom image_url tidak ada". */
function isMissingImageColumn(error) {
  if (!error) return false
  const code = error.code || ''
  const message = error.message || ''
  return code === 'PGRST204' || code === '42703' || message.includes('image_url')
}

/** Supabase Storage bucket that holds optional question images. */
export const QUESTION_IMAGE_BUCKET = 'question-images'

/** Batas ukuran file gambar soal (5 MB). */
export const QUESTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const questions = ref([])
const isLoading = ref(false)
const error = ref('')

// null = belum diketahui, true/false = hasil deteksi kolom image_url.
const imageColumnAvailable = ref(null)

/** Buang kolom gambar dari payload (dipakai saat kolom belum dimigrasi). */
function withoutImageColumn(clean) {
  const { image_url: _skip, ...rest } = clean
  return rest
}

const subjects = computed(() => {
  const unique = new Set()
  questions.value.forEach((question) => {
    const subject = String(question.subject ?? '').trim()
    if (subject) unique.add(subject)
  })
  return [...unique].sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }))
})

export function useQuestions() {
  async function fetchQuestions() {
    if (!isSupabaseConfigured) {
      questions.value = []
      error.value = SUPABASE_SETUP_MESSAGE
      return []
    }

    isLoading.value = true
    error.value = ''
    try {
      const { data, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .order('subject', { ascending: true })
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError
      questions.value = data ?? []
      return questions.value
    } catch (err) {
      console.error('[KuisKita] Gagal memuat soal:', err)
      error.value = 'Data soal belum berhasil dimuat. Silakan coba lagi.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load questions for one subject only. Shuffling and limiting happen on the
   * client so a classroom-sized question bank stays simple and predictable.
   */
  async function fetchQuestionsBySubject(subject, { limit = 0, shuffle = false } = {}) {
    if (!isSupabaseConfigured) throw new Error(SUPABASE_SETUP_MESSAGE)

    let query = supabase.from('questions').select('*')
    // "Semua Materi" loads every question; otherwise filter by one subject.
    if (subject !== ALL_SUBJECTS) query = query.eq('subject', subject)

    const { data, error: fetchError } = await query

    if (fetchError) {
      console.error('[KuisKita] Gagal memuat soal:', fetchError)
      throw new Error('Soal belum berhasil dimuat. Silakan coba lagi.')
    }

    let list = data ?? []
    if (shuffle) list = shuffleArray(list)
    if (limit > 0) list = list.slice(0, limit)
    return list
  }

  async function addQuestion(payload) {
    const clean = sanitizeQuestion(payload)

    // Kolom gambar belum dimigrasi: tetap izinkan soal tanpa gambar, tapi
    // tolak dengan pesan jelas kalau guru memang melampirkan gambar.
    if (imageColumnAvailable.value === false) {
      if (clean.image_url) throw new Error(MISSING_IMAGE_COLUMN_MESSAGE)
      const { data, error } = await supabase
        .from('questions')
        .insert(withoutImageColumn(clean))
        .select()
        .single()
      if (error) throw new Error('Soal belum berhasil disimpan. Silakan coba lagi.')
      questions.value = [...questions.value, data]
      return data
    }

    let { data, error: insertError } = await supabase.from('questions').insert(clean).select().single()

    if (insertError && isMissingImageColumn(insertError)) {
      imageColumnAvailable.value = false
      if (clean.image_url) throw new Error(MISSING_IMAGE_COLUMN_MESSAGE)
      const retry = await supabase
        .from('questions')
        .insert(withoutImageColumn(clean))
        .select()
        .single()
      data = retry.data
      insertError = retry.error
    }

    if (insertError) {
      console.error('[KuisKita] Gagal menambah soal:', insertError)
      throw new Error('Soal belum berhasil disimpan. Silakan coba lagi.')
    }
    imageColumnAvailable.value = true
    questions.value = [...questions.value, data]
    return data
  }

  async function updateQuestion(id, payload) {
    const clean = sanitizeQuestion(payload)

    if (imageColumnAvailable.value === false) {
      if (clean.image_url) throw new Error(MISSING_IMAGE_COLUMN_MESSAGE)
      const { data, error } = await supabase
        .from('questions')
        .update(withoutImageColumn(clean))
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error('Perubahan soal belum berhasil disimpan. Silakan coba lagi.')
      questions.value = questions.value.map((question) => (question.id === id ? data : question))
      return data
    }

    let { data, error: updateError } = await supabase
      .from('questions')
      .update(clean)
      .eq('id', id)
      .select()
      .single()

    if (updateError && isMissingImageColumn(updateError)) {
      imageColumnAvailable.value = false
      if (clean.image_url) throw new Error(MISSING_IMAGE_COLUMN_MESSAGE)
      const retry = await supabase
        .from('questions')
        .update(withoutImageColumn(clean))
        .eq('id', id)
        .select()
        .single()
      data = retry.data
      updateError = retry.error
    }

    if (updateError) {
      console.error('[KuisKita] Gagal memperbarui soal:', updateError)
      throw new Error('Perubahan soal belum berhasil disimpan. Silakan coba lagi.')
    }
    imageColumnAvailable.value = true
    questions.value = questions.value.map((question) => (question.id === id ? data : question))
    return data
  }

  async function deleteQuestion(id) {
    const { error: deleteError } = await supabase.from('questions').delete().eq('id', id)
    if (deleteError) {
      console.error('[KuisKita] Gagal menghapus soal:', deleteError)
      throw new Error('Soal belum berhasil dihapus. Silakan coba lagi.')
    }
    questions.value = questions.value.filter((question) => question.id !== id)
  }

  /** Hapus semua soal pada satu materi. Mengembalikan jumlah yang terhapus. */
  async function deleteQuestionsBySubject(subject) {
    const clean = String(subject ?? '').trim()
    if (!clean) return 0

    const removed = questions.value.filter((question) => question.subject === clean).length
    const { error: deleteError } = await supabase.from('questions').delete().eq('subject', clean)
    if (deleteError) {
      console.error('[KuisKita] Gagal menghapus soal materi:', deleteError)
      throw new Error('Soal-soal materi belum berhasil dihapus. Silakan coba lagi.')
    }
    questions.value = questions.value.filter((question) => question.subject !== clean)
    return removed
  }

  function setQuestions(list) {
    questions.value = list ?? []
  }

  /**
   * Cek apakah kolom gambar sudah tersedia (migrasi sudah dijalankan).
   * Dipakai dashboard untuk menampilkan peringatan sebelum guru menyimpan.
   */
  async function checkImageSupport() {
    if (!isSupabaseConfigured) {
      imageColumnAvailable.value = false
      return false
    }
    const { error: checkError } = await supabase.from('questions').select('image_url').limit(1)
    imageColumnAvailable.value = !checkError
    return imageColumnAvailable.value
  }

  /**
   * Upload one image to the public bucket and return its URL.
   * A random filename avoids clashes and keeps the original path opaque.
   */
  async function uploadQuestionImage(file) {
    if (!isSupabaseConfigured) throw new Error(SUPABASE_SETUP_MESSAGE)
    if (!file) return null

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

    if (uploadError) {
      console.error('[KuisKita] Gagal mengunggah gambar soal:', uploadError)
      throw new Error(
        'Gambar belum berhasil diunggah. Pastikan bucket "question-images" sudah dibuat ' +
          '(jalankan supabase/migration_question_images.sql).',
      )
    }

    const { data } = supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path)
    return data?.publicUrl ?? null
  }

  /** Best-effort removal of an uploaded image. Never blocks the main action. */
  async function deleteQuestionImage(url) {
    if (!isSupabaseConfigured || !url) return
    const marker = `/object/public/${QUESTION_IMAGE_BUCKET}/`
    const index = String(url).indexOf(marker)
    if (index === -1) return
    const path = decodeURIComponent(String(url).slice(index + marker.length).split('?')[0])
    const { error: removeError } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove([path])
    if (removeError) console.warn('[KuisKita] Gagal menghapus gambar lama:', removeError)
  }

  return {
    questions,
    subjects,
    isLoading,
    error,
    fetchQuestions,
    fetchQuestionsBySubject,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    deleteQuestionsBySubject,
    setQuestions,
    uploadQuestionImage,
    deleteQuestionImage,
    imageColumnAvailable,
    checkImageSupport,
  }
}

export function shuffleArray(input) {
  const list = [...input]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** Keep only the columns the table expects and trim user input. */
export function sanitizeQuestion(payload) {
  const isMultipleChoice = payload.type === 'multiple_choice'

  const options = isMultipleChoice
    ? (payload.options ?? [])
        .map((option) => ({
          label: String(option.label ?? '').trim().toUpperCase(),
          text: String(option.text ?? '').trim(),
        }))
        .filter((option) => option.label && option.text)
    : null

  return {
    subject: String(payload.subject ?? '').trim(),
    type: payload.type,
    question_text: String(payload.question_text ?? '').trim(),
    options,
    correct_answer: String(payload.correct_answer ?? '').trim(),
    image_url: String(payload.image_url ?? '').trim() || null,
  }
}
