import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both public Supabase environment variables are present.
 * We never read the service role key here: it must stay on the server only.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const SUPABASE_SETUP_MESSAGE =
  'Aplikasi belum terhubung ke Supabase. Salin .env.example menjadi .env, ' +
  'lalu isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.'

if (!isSupabaseConfigured) {
  // Friendly warning instead of a white screen when .env is missing.
  console.warn(`[KuisKita] ${SUPABASE_SETUP_MESSAGE}`)
}

/**
 * Placeholder values keep createClient from throwing, so the app still renders
 * and can show an Indonesian setup message to the user.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  },
)
