import { ref } from 'vue'
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from '@/lib/supabaseClient'

// Finished games archive. Sessions are plain snapshots so deleting or
// renaming students/classes never destroys history.
const sessions = ref([])
const isLoading = ref(false)
const error = ref('')

export function useQuizSessions() {
  async function fetchSessions() {
    if (!isSupabaseConfigured) {
      sessions.value = []
      error.value = SUPABASE_SETUP_MESSAGE
      return []
    }

    isLoading.value = true
    error.value = ''
    try {
      const { data, error: fetchError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .order('played_at', { ascending: false })

      if (fetchError) throw fetchError
      sessions.value = data ?? []
      return sessions.value
    } catch (err) {
      console.error('[KuisKita] Gagal memuat riwayat:', err)
      error.value = 'Data riwayat belum berhasil dimuat. Silakan coba lagi.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSessionScores(sessionId) {
    const { data, error: fetchError } = await supabase
      .from('session_scores')
      .select('*')
      .eq('session_id', sessionId)
      .order('score', { ascending: false })

    if (fetchError) {
      console.error('[KuisKita] Gagal memuat skor sesi:', fetchError)
      throw new Error('Rincian sesi belum berhasil dimuat. Silakan coba lagi.')
    }
    return data ?? []
  }

  /** Ambil semua skor untuk sekumpulan sesi (dipakai saat ekspor). */
  async function fetchScoresForSessions(sessionIds) {
    const ids = (sessionIds ?? []).filter(Boolean)
    if (ids.length === 0) return []

    const { data, error: fetchError } = await supabase
      .from('session_scores')
      .select('*')
      .in('session_id', ids)

    if (fetchError) {
      console.error('[KuisKita] Gagal memuat skor sesi:', fetchError)
      throw new Error('Rincian sesi belum berhasil dimuat. Silakan coba lagi.')
    }
    return data ?? []
  }

  /**
   * Archive one finished game: header row + one score row per player.
   * entries: [{ student_name, score }]
   */
  async function archiveSession({ className, subjectLabel, questionCount, entries }) {
    if (!isSupabaseConfigured) throw new Error(SUPABASE_SETUP_MESSAGE)

    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({
        class_name: String(className ?? '').trim() || 'Tanpa Kelas',
        subject_label: String(subjectLabel ?? '').trim() || 'Semua Materi',
        question_count: Number(questionCount) || 0,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('[KuisKita] Gagal mengarsipkan sesi:', sessionError)
      throw new Error('Hasil game belum berhasil diarsipkan. Silakan coba lagi.')
    }

    const rows = (entries ?? []).map((entry) => ({
      session_id: session.id,
      student_name: String(entry.student_name ?? '').trim(),
      score: Number(entry.score) || 0,
    }))

    if (rows.length > 0) {
      const { error: scoresError } = await supabase.from('session_scores').insert(rows)
      if (scoresError) {
        console.error('[KuisKita] Gagal mengarsipkan skor sesi:', scoresError)
        // Roll back the header so half an archive never lingers.
        await supabase.from('quiz_sessions').delete().eq('id', session.id)
        throw new Error('Hasil game belum berhasil diarsipkan. Silakan coba lagi.')
      }
    }

    sessions.value = [session, ...sessions.value]
    return session
  }

  async function deleteSession(id) {
    const { error: deleteError } = await supabase.from('quiz_sessions').delete().eq('id', id)
    if (deleteError) {
      console.error('[KuisKita] Gagal menghapus riwayat:', deleteError)
      throw new Error('Riwayat belum berhasil dihapus. Silakan coba lagi.')
    }
    sessions.value = sessions.value.filter((session) => session.id !== id)
  }

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    fetchSessionScores,
    fetchScoresForSessions,
    archiveSession,
    deleteSession,
  }
}
