import { ref } from 'vue'
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from '@/lib/supabaseClient'

// School classes managed by the teacher. Each item: { id, name }.
const classList = ref([])
const isLoading = ref(false)
const error = ref('')
const needsMigration = ref(false)

/** True when the error means the `classes` table does not exist yet. */
function isMissingTableError(err) {
  if (!err) return false
  const code = String(err.code ?? '')
  const message = String(err.message ?? '')
  if (['42P01', 'PGRST205'].includes(code)) return true
  return /classes/i.test(message) && /(schema cache|does not exist|could not find|relation)/i.test(message)
}

function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
}

export function useClasses() {
  async function fetchClasses() {
    if (!isSupabaseConfigured) {
      classList.value = []
      error.value = SUPABASE_SETUP_MESSAGE
      return []
    }

    isLoading.value = true
    error.value = ''
    needsMigration.value = false

    try {
      const { data, error: fetchError } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      classList.value = data ?? []
      return classList.value
    } catch (err) {
      if (isMissingTableError(err)) {
        needsMigration.value = true
        classList.value = []
        error.value = ''
        return []
      }

      console.error('[KuisKita] Gagal memuat kelas:', err)
      error.value = 'Data kelas belum berhasil dimuat. Silakan coba lagi.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  function requireTable() {
    if (needsMigration.value) {
      throw new Error('Tabel kelas belum ada. Jalankan supabase/migration_classes.sql di SQL Editor Supabase.')
    }
  }

  async function addClass(name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) throw new Error('Nama kelas wajib diisi.')
    requireTable()

    const { data, error: insertError } = await supabase
      .from('classes')
      .insert({ name: trimmed })
      .select()
      .single()

    if (insertError) {
      // 23505 = unique_violation (nama kelas sudah terdaftar).
      if (insertError.code === '23505') throw new Error('Kelas itu sudah ada di daftar.')
      console.error('[KuisKita] Gagal menambah kelas:', insertError)
      throw new Error('Kelas belum berhasil ditambahkan. Silakan coba lagi.')
    }

    classList.value = sortByName([...classList.value, data])
    return data
  }

  async function renameClass(id, newName) {
    const trimmed = String(newName ?? '').trim()
    if (!trimmed) throw new Error('Nama kelas wajib diisi.')
    requireTable()

    const target = classList.value.find((item) => item.id === id)
    if (!target) throw new Error('Kelas tidak ditemukan.')
    if (target.name === trimmed) return target

    const { data, error: updateError } = await supabase
      .from('classes')
      .update({ name: trimmed })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') throw new Error('Kelas itu sudah ada di daftar.')
      console.error('[KuisKita] Gagal mengubah kelas:', updateError)
      throw new Error('Perubahan kelas belum berhasil disimpan. Silakan coba lagi.')
    }

    classList.value = sortByName(
      classList.value.map((item) => (item.id === id ? data : item)),
    )
    return data
  }

  /**
   * Delete a class. Its students and their scores are deleted as well
   * (database cascade) — the confirm dialog must say so.
   */
  async function deleteClass(id) {
    requireTable()

    const target = classList.value.find((item) => item.id === id)
    if (!target) throw new Error('Kelas tidak ditemukan.')

    const { error: deleteError } = await supabase.from('classes').delete().eq('id', id)
    if (deleteError) {
      console.error('[KuisKita] Gagal menghapus kelas:', deleteError)
      throw new Error('Kelas belum berhasil dihapus. Silakan coba lagi.')
    }

    classList.value = classList.value.filter((item) => item.id !== id)
  }

  return {
    classList,
    isLoading,
    error,
    needsMigration,
    fetchClasses,
    addClass,
    renameClass,
    deleteClass,
  }
}
