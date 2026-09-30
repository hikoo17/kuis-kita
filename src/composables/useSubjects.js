import { ref } from 'vue'
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from '@/lib/supabaseClient'
import { useQuestions } from './useQuestions'

// Source of truth for subject names. Each item: { id, name }.
// (In fallback mode — before the migration is run — id equals the name.)
const subjectList = ref([])
const isLoading = ref(false)
const error = ref('')
const needsMigration = ref(false)

/** True when the error means the `subjects` table does not exist yet. */
function isMissingTableError(err) {
  if (!err) return false
  const code = String(err.code ?? '')
  const message = String(err.message ?? '')
  if (['42P01', 'PGRST205'].includes(code)) return true
  return /subjects/i.test(message) && /(schema cache|does not exist|could not find|relation)/i.test(message)
}

function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
}

export function useSubjects() {
  async function fetchSubjects() {
    if (!isSupabaseConfigured) {
      subjectList.value = []
      error.value = SUPABASE_SETUP_MESSAGE
      return []
    }

    isLoading.value = true
    error.value = ''
    needsMigration.value = false

    try {
      const { data, error: fetchError } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      subjectList.value = data ?? []
      return subjectList.value
    } catch (err) {
      if (isMissingTableError(err)) {
        // The migration has not been run yet: fall back to the subjects
        // already used by existing questions, and tell the teacher what to do.
        needsMigration.value = true
        const { questions, fetchQuestions } = useQuestions()
        try {
          if (questions.value.length === 0) await fetchQuestions()
        } catch {
          // Ignore: an empty list is a fine fallback.
        }
        const unique = new Set()
        questions.value.forEach((question) => {
          const name = String(question.subject ?? '').trim()
          if (name) unique.add(name)
        })
        subjectList.value = [...unique]
          .sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }))
          .map((name) => ({ id: name, name }))
        error.value = ''
        return subjectList.value
      }

      console.error('[KuisKita] Gagal memuat materi:', err)
      error.value = 'Data materi belum berhasil dimuat. Silakan coba lagi.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  function requireTable() {
    if (needsMigration.value) {
      throw new Error('Tabel materi belum ada. Jalankan supabase/migration_subjects.sql di SQL Editor Supabase.')
    }
  }

  async function addSubject(name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) throw new Error('Nama materi wajib diisi.')
    requireTable()

    const { data, error: insertError } = await supabase
      .from('subjects')
      .insert({ name: trimmed })
      .select()
      .single()

    if (insertError) {
      // 23505 = unique_violation (nama materi sudah terdaftar).
      if (insertError.code === '23505') throw new Error('Materi itu sudah ada di daftar.')
      console.error('[KuisKita] Gagal menambah materi:', insertError)
      throw new Error('Materi belum berhasil ditambahkan. Silakan coba lagi.')
    }

    subjectList.value = sortByName([...subjectList.value, data])
    return data
  }

  /**
   * Rename a subject and move all of its questions along, so nothing is lost.
   */
  async function renameSubject(id, newName) {
    const trimmed = String(newName ?? '').trim()
    if (!trimmed) throw new Error('Nama materi wajib diisi.')
    requireTable()

    const target = subjectList.value.find((subject) => subject.id === id)
    if (!target) throw new Error('Materi tidak ditemukan.')
    if (target.name === trimmed) return target

    const { data, error: updateError } = await supabase
      .from('subjects')
      .update({ name: trimmed })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') throw new Error('Materi itu sudah ada di daftar.')
      console.error('[KuisKita] Gagal mengubah materi:', updateError)
      throw new Error('Perubahan materi belum berhasil disimpan. Silakan coba lagi.')
    }

    // Move the questions to the new name.
    const { error: moveError } = await supabase
      .from('questions')
      .update({ subject: trimmed })
      .eq('subject', target.name)

    if (moveError) {
      console.error('[KuisKita] Gagal memindahkan soal:', moveError)
      throw new Error('Nama materi tersimpan, tetapi soalnya belum berhasil dipindahkan. Silakan coba lagi.')
    }

    subjectList.value = sortByName(
      subjectList.value.map((subject) => (subject.id === id ? data : subject)),
    )

    // Keep the in-memory question list in sync.
    const { questions, fetchQuestions } = useQuestions()
    if (questions.value.length > 0) {
      questions.value = questions.value.map((question) =>
        question.subject === target.name ? { ...question, subject: trimmed } : question,
      )
    } else {
      await fetchQuestions().catch(() => {})
    }

    return data
  }

  /**
   * Delete a subject together with all of its questions.
   */
  async function deleteSubject(id) {
    requireTable()

    const target = subjectList.value.find((subject) => subject.id === id)
    if (!target) throw new Error('Materi tidak ditemukan.')

    const { error: deleteQuestionsError } = await supabase
      .from('questions')
      .delete()
      .eq('subject', target.name)

    if (deleteQuestionsError) {
      console.error('[KuisKita] Gagal menghapus soal materi:', deleteQuestionsError)
      throw new Error('Soal-soal materi belum berhasil dihapus. Silakan coba lagi.')
    }

    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', id)
    if (deleteError) {
      console.error('[KuisKita] Gagal menghapus materi:', deleteError)
      throw new Error('Materi belum berhasil dihapus. Silakan coba lagi.')
    }

    subjectList.value = subjectList.value.filter((subject) => subject.id !== id)

    const { questions, fetchQuestions } = useQuestions()
    if (questions.value.length > 0) {
      questions.value = questions.value.filter((question) => question.subject !== target.name)
    } else {
      await fetchQuestions().catch(() => {})
    }
  }

  return {
    subjectList,
    isLoading,
    error,
    needsMigration,
    fetchSubjects,
    addSubject,
    renameSubject,
    deleteSubject,
  }
}
