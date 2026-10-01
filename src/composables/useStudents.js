import { ref } from 'vue'
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from '@/lib/supabaseClient'

// Shared state: several components (quiz, leaderboard, admin) read the same list.
const students = ref([])
const isLoading = ref(false)
const error = ref('')

function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
}

function applyStudent(updated) {
  if (!updated) return
  students.value = students.value.map((student) =>
    student.id === updated.id ? { ...student, ...updated } : student,
  )
}

export function useStudents() {
  async function fetchStudents() {
    if (!isSupabaseConfigured) {
      students.value = []
      error.value = SUPABASE_SETUP_MESSAGE
      return []
    }

    isLoading.value = true
    error.value = ''
    try {
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      students.value = data ?? []
      return students.value
    } catch (err) {
      console.error('[KuisKita] Gagal memuat siswa:', err)
      error.value = 'Data siswa belum berhasil dimuat. Silakan coba lagi.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function addStudent(name, classId) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) throw new Error('Nama siswa wajib diisi.')
    if (!classId) throw new Error('Pilih kelasnya dulu.')

    const { data, error: insertError } = await supabase
      .from('students')
      .insert({ name: trimmed, class_id: classId })
      .select()
      .single()

    if (insertError) {
      // 23505 = unique_violation (nama siswa sudah terdaftar di kelas ini).
      if (insertError.code === '23505') throw new Error('Nama siswa itu sudah ada di kelas ini.')
      console.error('[KuisKita] Gagal menambah siswa:', insertError)
      throw new Error('Siswa belum berhasil ditambahkan. Silakan coba lagi.')
    }

    students.value = sortByName([...students.value, data])
    return data
  }

  async function deleteStudent(id) {
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id)
    if (deleteError) {
      console.error('[KuisKita] Gagal menghapus siswa:', deleteError)
      throw new Error('Siswa belum berhasil dihapus. Silakan coba lagi.')
    }
    students.value = students.value.filter((student) => student.id !== id)
  }

  async function renameStudent(id, name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) throw new Error('Nama siswa wajib diisi.')

    const { data, error: updateError } = await supabase
      .from('students')
      .update({ name: trimmed })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      // 23505 = unique_violation (nama sudah dipakai siswa lain di kelas ini).
      if (updateError.code === '23505') throw new Error('Nama siswa itu sudah ada di kelas ini.')
      console.error('[KuisKita] Gagal mengubah nama siswa:', updateError)
      throw new Error('Nama siswa belum berhasil diubah. Silakan coba lagi.')
    }

    students.value = sortByName(
      students.value.map((student) => (student.id === id ? data : student)),
    )
    return data
  }

  /** Move a student to another class (scores move along untouched). */
  async function updateStudentClass(id, classId) {
    if (!classId) throw new Error('Pilih kelasnya dulu.')

    const { data, error: updateError } = await supabase
      .from('students')
      .update({ class_id: classId })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        throw new Error('Nama siswa itu sudah ada di kelas tujuan.')
      }
      console.error('[KuisKita] Gagal memindahkan siswa:', updateError)
      throw new Error('Siswa belum berhasil dipindahkan. Silakan coba lagi.')
    }

    applyStudent(data)
    return data
  }

  async function resetStudentScore(id) {
    // Clear the per-subject scores FIRST: if anything fails below,
    // the totals are left untouched and the data stays consistent.
    const { error: deleteScoresError } = await supabase
      .from('subject_scores')
      .delete()
      .eq('student_id', id)

    if (deleteScoresError) {
      console.error('[KuisKita] Gagal mereset skor per materi:', deleteScoresError)
      throw new Error('Poin siswa belum berhasil direset. Silakan coba lagi.')
    }

    const { data, error: updateError } = await supabase
      .from('students')
      .update({ score: 0 })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[KuisKita] Gagal mereset poin siswa:', updateError)
      throw new Error('Poin siswa belum berhasil direset. Silakan coba lagi.')
    }

    applyStudent(data)
    return data
  }

  async function resetAllScores() {
    const { error: deleteScoresError } = await supabase
      .from('subject_scores')
      .delete()
      .not('id', 'is', null)

    if (deleteScoresError) {
      console.error('[KuisKita] Gagal mereset skor per materi:', deleteScoresError)
      throw new Error('Semua poin belum berhasil direset. Silakan coba lagi.')
    }

    // Supabase requires a filter for update queries; this one matches every row.
    const { error: updateError } = await supabase
      .from('students')
      .update({ score: 0 })
      .not('id', 'is', null)

    if (updateError) {
      console.error('[KuisKita] Gagal mereset semua poin:', updateError)
      throw new Error('Semua poin belum berhasil direset. Silakan coba lagi.')
    }

    students.value = students.value.map((student) => ({ ...student, score: 0 }))
  }

  /**
   * Reset one class only (used when a new game starts): clears the
   * per-subject rows first, then zeroes the totals, so a failure
   * never leaves the two out of sync.
   */
  async function resetClassScores(classId) {
    const ids = students.value.filter((s) => s.class_id === classId).map((s) => s.id)
    if (ids.length === 0) return

    const { error: deleteScoresError } = await supabase
      .from('subject_scores')
      .delete()
      .in('student_id', ids)

    if (deleteScoresError) {
      console.error('[KuisKita] Gagal mereset skor per materi:', deleteScoresError)
      throw new Error('Poin belum berhasil direset. Silakan coba lagi.')
    }

    const { error: updateError } = await supabase
      .from('students')
      .update({ score: 0 })
      .in('id', ids)

    if (updateError) {
      console.error('[KuisKita] Gagal mereset poin kelas:', updateError)
      throw new Error('Poin belum berhasil direset. Silakan coba lagi.')
    }

    const idSet = new Set(ids)
    students.value = students.value.map((student) =>
      idSet.has(student.id) ? { ...student, score: 0 } : student,
    )
  }

  /** Replace the whole list, e.g. after a Realtime event. */
  function setStudents(list) {
    students.value = list ?? []
  }

  return {
    students,
    isLoading,
    error,
    fetchStudents,
    addStudent,
    deleteStudent,
    renameStudent,
    updateStudentClass,
    resetStudentScore,
    resetAllScores,
    resetClassScores,
    setStudents,
  }
}
