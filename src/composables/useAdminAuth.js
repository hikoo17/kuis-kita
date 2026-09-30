import { ref } from 'vue'

const STORAGE_KEY = 'kuis-kita:admin'
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'

const isAdmin = ref(sessionStorage.getItem(STORAGE_KEY) === 'true')

/**
 * Client-side PIN gate. Good enough for a class demo, but NOT real security:
 * anyone can inspect the bundle. Use Supabase Auth for a production app.
 */
export function useAdminAuth() {
  function login(pin) {
    if (String(pin ?? '').trim() !== String(ADMIN_PIN).trim()) {
      return false
    }
    isAdmin.value = true
    sessionStorage.setItem(STORAGE_KEY, 'true')
    return true
  }

  function logout() {
    isAdmin.value = false
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return { isAdmin, login, logout }
}

export function isAdminAuthenticated() {
  return sessionStorage.getItem(STORAGE_KEY) === 'true'
}
