import { ref } from 'vue'

const STORAGE_KEY = 'kuis-kita:admin'
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'

/**
 * Login guru disimpan di localStorage supaya tetap tersimpan setelah
 * halaman di-refresh atau dibuka kembali (tidak perlu login ulang).
 * Hilang hanya saat guru menekan Logout (atau membersihkan data browser).
 */
function readStoredFlag() {
  try {
    // Pindahkan sesi lama (sessionStorage) ke localStorage agar tidak perlu login ulang.
    if (localStorage.getItem(STORAGE_KEY) !== 'true' && sessionStorage.getItem(STORAGE_KEY) === 'true') {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const isAdmin = ref(readStoredFlag())

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
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Abaikan: mode privat / storage penuh.
    }
    return true
  }

  function logout() {
    isAdmin.value = false
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Abaikan.
    }
  }

  return { isAdmin, login, logout }
}

export function isAdminAuthenticated() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
