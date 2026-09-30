import { ref } from 'vue'
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from '@/lib/supabaseClient'
import { useStudents } from './useStudents'

// One row per student × subject pair: { id, student_id, subject, score }.
const subjectScores = ref([])
const isLoading = ref(false)
const error = ref('')

export function useSubjectScores() {
  const { fetchStudents } = useStudents()

  async function fetchSubjectScores() {
    if (!isSupabaseConfigured) {
      subjectScores.value = []
      error.value = SUPABASE_SETUP_MESSAGE
      return []
    }

    isLoading.value = true
    error.value = ''
    try {
      const { data, error: fetchError } = await supabase.from('subject_scores').select('*')

      if (fetchError) throw fetchError
      subjectScores.value = data ?? []
      return subjectScores.value
    } catch (err) {
      console.error('[KuisKita] Gagal memuat skor per materi:', err)
      error.value = 'Data skor belum berhasil dimuat. Silakan coba lagi.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  /** Points of one student in one subject (0 when never played). */
  function scoreFor(studentId, subject) {
    const row = subjectScores.value.find(
      (item) => item.student_id === studentId && item.subject === subject,
    )
    return row ? row.score : 0
  }

  /**
   * Add points to the total AND to the subject, inside one database
   * transaction (RPC), so a double click can never count twice.
   */
  async function addScore(studentId, points, subject) {
    if (!isSupabaseConfigured) throw new Error(SUPABASE_SETUP_MESSAGE)

    const { data, error: rpcError } = await supabase.rpc('increment_student_score', {
      p_student_id: studentId,
      p_points: points,
      p_subject: subject ?? null,
    })

    if (rpcError) {
      console.error('[KuisKita] Gagal menambah poin:', rpcError)
      throw new Error('Poin belum berhasil disimpan. Periksa koneksi lalu coba lagi.')
    }

    const updated = Array.isArray(data) ? data[0] : data

    // Refresh the totals; bump the per-subject row locally for instant UI.
    await fetchStudents()
    const cleanSubject = String(subject ?? '').trim()
    if (cleanSubject) {
      const existing = subjectScores.value.find(
        (item) => item.student_id === studentId && item.subject === cleanSubject,
      )
      if (existing) {
        existing.score += points
      } else {
        subjectScores.value = [
          ...subjectScores.value,
          { id: `local-${studentId}-${cleanSubject}`, student_id: studentId, subject: cleanSubject, score: points },
        ]
      }
    }

    return updated
  }

  function setSubjectScores(list) {
    subjectScores.value = list ?? []
  }

  return {
    subjectScores,
    isLoading,
    error,
    fetchSubjectScores,
    scoreFor,
    addScore,
    setSubjectScores,
  }
}
