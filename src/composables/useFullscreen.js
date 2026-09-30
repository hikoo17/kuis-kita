import { ref } from 'vue'

/** True saat dokumen sedang dalam mode layar penuh. */
export const isFullscreen = ref(false)

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = Boolean(document.fullscreenElement)
  })
}

export function useFullscreen() {
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch (err) {
      console.warn('[KuisKita] Mode layar penuh tidak tersedia:', err)
    }
  }

  return { isFullscreen, toggleFullscreen }
}
