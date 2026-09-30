import { ref } from 'vue'

const STORAGE_KEY = 'kuis-kita:settings'

export const DEFAULT_SETTINGS = {
  pointsPerCorrect: 10,
  questionCountPerQuiz: 10,
  shuffleQuestions: true,
  shuffleOptions: false,
  soundEnabled: true,
  soundVolume: 70,
  musicEnabled: true,
  musicVolume: 45,
  answerTimeLimit: 30,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// Shared, lightweight state — no Pinia needed for this small app.
const settings = ref(loadSettings())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
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
