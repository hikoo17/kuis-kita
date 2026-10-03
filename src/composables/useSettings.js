import { ref } from 'vue'

const STORAGE_KEY = 'kuis-kita:settings'

// Naikkan angka ini kalau default volume berubah, supaya setelan lama ikut naik.
const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS = {
  pointsPerCorrect: 10,
  questionCountPerQuiz: 10,
  shuffleQuestions: true,
  shuffleOptions: false,
  soundEnabled: true,
  soundVolume: 100,
  musicEnabled: true,
  musicVolume: 80,
  answerTimeLimit: 30,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const stored = JSON.parse(raw) ?? {}
    const merged = { ...DEFAULT_SETTINGS, ...stored }

    // Migrasi: kalau guru belum pernah mengubah volume (masih nilai default lama),
    // naikkan ke default baru yang lebih besar. Setelan yang sudah disesuaikan dibiarkan.
    if ((stored.version ?? 0) < SETTINGS_VERSION) {
      if (stored.soundVolume === 70) merged.soundVolume = DEFAULT_SETTINGS.soundVolume
      if (stored.musicVolume === 45) merged.musicVolume = DEFAULT_SETTINGS.musicVolume
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...merged, version: SETTINGS_VERSION }))
      } catch {
        // Abaikan: mode privat / kuota penuh.
      }
    }

    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// Shared, lightweight state — no Pinia needed for this small app.
const settings = ref(loadSettings())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings.value, version: SETTINGS_VERSION }))
  } catch {
    // Ignore storage errors (private mode, quota, ...).
  }
}

export function useSettings() {
  function updateSettings(patch) {
    settings.value = { ...settings.value, ...patch }
    persist()
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    persist()
  }

  return { settings, updateSettings, resetSettings }
}
