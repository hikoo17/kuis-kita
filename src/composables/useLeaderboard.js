import { computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useStudents } from './useStudents'
import { useSubjectScores } from './useSubjectScores'
import { useClasses } from './useClasses'

const { students } = useStudents()
const { subjectScores } = useSubjectScores()

/**
 * Leaderboard for one subject in one class.
 * subject: 'all' = totals. classId: null = all classes.
 * Each row keeps the student shape ({ id, name, score }) so the same
 * Leaderboard component can render every combination.
 */
function leaderboardFor(subject = 'all', classId = null) {
  return computed(() => {
    const pool = classId ? students.value.filter((s) => s.class_id === classId) : [...students.value]

    if (!subject || subject === 'all') {
      return [...pool].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
      })
    }

    const rows = pool.map((student) => {
      const row = subjectScores.value.find(
        (item) => item.student_id === student.id && item.subject === subject,
      )
      return { ...student, score: row ? row.score : 0 }
    })

    return rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
    })
  })
}

let channel = null

export function useLeaderboard() {
  const { fetchStudents } = useStudents()
  const { fetchSubjectScores } = useSubjectScores()
  const { fetchClasses } = useClasses()

  /**
   * Listen to score changes so points and leaderboards refresh
   * automatically on the projector, without pressing reload.
   * The channel is a singleton to avoid duplicate subscriptions.
   */
  function startRealtime() {
    if (!isSupabaseConfigured || channel) return

    const refresh = () => {
      fetchStudents()
      fetchSubjectScores()
      fetchClasses()
    }

    channel = supabase
      .channel('kuis-kita-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_scores' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, refresh)
      .subscribe()
  }

  function stopRealtime() {
    if (!channel) return
    supabase.removeChannel(channel)
    channel = null
  }

  return { leaderboardFor, startRealtime, stopRealtime }
}
