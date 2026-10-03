import { nextTick, onBeforeUnmount, watch } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])'

let lockCount = 0

/**
 * Aksesibilitas modal:
 * - memindahkan fokus ke modal saat terbuka,
 * - mengunci Tab di dalam modal,
 * - menutup dengan Esc (opsional),
 * - mengembalikan fokus ke elemen pemicu saat ditutup.
 *
 * @param {() => boolean} isOpen   getter status buka
 * @param {import('vue').Ref} containerRef ref ke elemen pembungkus modal
 * @param {() => void} onClose     dipanggil saat Esc ditekan
 * @param {{ closeOnEscape?: boolean }} [options]
 */
export function useModalFocus(isOpen, containerRef, onClose, { closeOnEscape = true } = {}) {
  let previouslyFocused = null
  let scrollLocked = false

  function lockScroll() {
    if (scrollLocked) return
    scrollLocked = true
    lockCount += 1
    if (lockCount === 1) document.body.style.overflow = 'hidden'
  }

  function unlockScroll() {
    if (!scrollLocked) return
    scrollLocked = false
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) document.body.style.overflow = ''
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (!closeOnEscape) return
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const container = containerRef.value
    if (!container) return

    const nodes = [...container.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
    if (nodes.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }

    const first = nodes[0]
    const last = nodes[nodes.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(
    isOpen,
    async (open) => {
      if (open) {
        previouslyFocused = document.activeElement
        lockScroll()
        await nextTick()
        const container = containerRef.value
        const first = container ? container.querySelector(FOCUSABLE) : null
        ;(first || container)?.focus()
        document.addEventListener('keydown', onKeydown, true)
      } else {
        document.removeEventListener('keydown', onKeydown, true)
        unlockScroll()
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus()
        }
        previouslyFocused = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown, true)
    unlockScroll()
  })
}
