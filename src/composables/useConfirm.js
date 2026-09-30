import { reactive } from 'vue'

/**
 * Dialog konfirmasi yang bisa dipakai komponen mana pun.
 * Setiap pemanggilan `useConfirm()` punya state sendiri, jadi dua komponen
 * tidak saling menimpa dialognya.
 *
 * Pemakaian:
 *   const { confirmState, askConfirm, runConfirm, cancelConfirm } = useConfirm()
 *   askConfirm({ title, message, ... }, async () => { ... })
 *   <ConfirmModal v-bind="modalProps" @confirm="runConfirm" @cancel="cancelConfirm" />
 */
export function useConfirm() {
  const confirmState = reactive({
    open: false,
    title: 'Konfirmasi',
    message: '',
    confirmLabel: 'Ya, Lanjutkan',
    cancelLabel: 'Batal',
    variant: 'danger',
    loading: false,
  })

  let pendingAction = null

  function askConfirm(options, action) {
    Object.assign(confirmState, options, { open: true, loading: false })
    pendingAction = action
  }

  async function runConfirm() {
    if (!pendingAction) return
    confirmState.loading = true
    try {
      await pendingAction()
    } catch (err) {
      console.error('[KuisKita] Aksi konfirmasi gagal:', err)
    } finally {
      confirmState.loading = false
      confirmState.open = false
      pendingAction = null
    }
  }

  function cancelConfirm() {
    confirmState.open = false
    pendingAction = null
  }

  return { confirmState, askConfirm, runConfirm, cancelConfirm }
}
