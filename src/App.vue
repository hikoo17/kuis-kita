<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ChevronDown, Home, LayoutDashboard, LogIn, LogOut, Maximize, Minimize, Music, Target, User, Volume2, VolumeX } from '@lucide/vue'
import { useAdminAuth } from '@/composables/useAdminAuth'
import { isAnswering } from '@/composables/useQuiz'
import { useSettings } from '@/composables/useSettings'
import { useSound } from '@/composables/useSound'
import { useMusic } from '@/composables/useMusic'
import { useFullscreen } from '@/composables/useFullscreen'

const { settings, updateSettings } = useSettings()
const { play } = useSound()
const { isAdmin, logout } = useAdminAuth()
const { isFullscreen, toggleFullscreen } = useFullscreen()
const router = useRouter()
const showAdminMenu = ref(false)

function handleLogout() {
  showAdminMenu.value = false
  logout()
  router.push('/admin')
}

const route = useRoute()

/** Highlight for every /admin page (login + dashboard). */
const isDashboardSection = computed(() => route.path.startsWith('/admin'))
const { stop: stopMusic } = useMusic()

const fullscreenLabel = computed(() =>
  isFullscreen.value ? 'Keluar layar penuh (F)' : 'Layar penuh (F)',
)

/** Shortcut global: F untuk layar penuh. Diabaikan saat sedang mengetik. */
function onGlobalKeydown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  const tag = event.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
    return
  }
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault()
    toggleFullscreen()
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))

const soundIcon = computed(() => (settings.value.soundEnabled ? Volume2 : VolumeX))
const soundLabel = computed(() =>
  settings.value.soundEnabled
    ? 'Efek suara aktif — klik untuk menonaktifkan'
    : 'Efek suara nonaktif — klik untuk mengaktifkan',
)

const musicLabel = computed(() =>
  settings.value.musicEnabled
    ? 'Musik latar aktif — klik untuk menonaktifkan'
    : 'Musik latar nonaktif — klik untuk mengaktifkan',
)

function toggleSound() {
  const next = !settings.value.soundEnabled
  updateSettings({ soundEnabled: next })
  // Short confirmation when turning the sound effects back on.
  if (next) play('select', { force: true })
}

function toggleMusic() {
  const next = !settings.value.musicEnabled
  updateSettings({ musicEnabled: next })
  // Saat dinonaktifkan, hentikan langsung. Saat diaktifkan, QuizView memilih
  // track yang tepat (menu/game) lewat watcher-nya.
  if (!next) stopMusic()
}
</script>

<template>
  <div class="flex min-h-screen flex-col" :class="isAdmin ? 'pb-24 sm:pb-0' : ''">
    <header class="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 shadow-card backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <RouterLink to="/" class="flex items-center gap-2 text-xl font-extrabold text-brand-700">
          <Target :size="24" aria-hidden="true" class="text-brand-600" />
          <span>KuisKita</span>
        </RouterLink>

        <!-- Kontrol mobile: ikon perbesar & suara di kanan navbar atas. -->
        <div class="flex items-center gap-1 sm:hidden">
          <button
            type="button"
            class="rounded-xl px-2.5 py-2 text-lg leading-none text-slate-600 transition hover:bg-slate-100
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            :title="fullscreenLabel"
            :aria-label="fullscreenLabel"
            :aria-pressed="isFullscreen"
            @click="toggleFullscreen"
          >
            <component :is="isFullscreen ? Minimize : Maximize" :size="20" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="rounded-xl px-2.5 py-2 text-lg leading-none transition hover:bg-slate-100
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            :class="settings.soundEnabled ? 'text-slate-700' : 'text-slate-300'"
            :title="soundLabel"
            :aria-label="soundLabel"
            :aria-pressed="settings.soundEnabled"
            @click="toggleSound"
          >
            <component :is="soundIcon" :size="20" aria-hidden="true" />
          </button>

          <button
            v-if="isAnswering"
            type="button"
            class="rounded-xl px-2.5 py-2 text-lg leading-none transition hover:bg-slate-100
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            :class="settings.musicEnabled ? 'text-slate-700' : 'text-slate-300'"
            :title="musicLabel"
            :aria-label="musicLabel"
            :aria-pressed="settings.musicEnabled"
            @click="toggleMusic"
          >
            <Music
              :size="20"
              aria-hidden="true"
              :class="settings.musicEnabled ? '' : 'opacity-40'"
              :stroke-width="settings.musicEnabled ? 2 : 1.5"
            />
          </button>
        </div>

        <!-- Menu utama: hanya tampil setelah guru masuk. -->
        <nav class="hidden items-center gap-1 text-sm font-bold sm:flex">
          <template v-if="isAdmin">
            <RouterLink
              to="/"
              class="rounded-xl px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-brand-700"
              active-class="bg-brand-50 text-brand-700"
            >
              Kuis
            </RouterLink>
            <RouterLink
              :to="isAdmin ? '/admin/dashboard' : '/admin'"
              class="rounded-xl px-3 py-2 transition"
              :class="isDashboardSection
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-brand-700'"
              :title="isAdmin ? 'Buka Dashboard Guru' : 'Masuk sebagai Guru'"
            >
              {{ isAdmin ? 'Dashboard' : 'Login' }}
            </RouterLink>
            <!-- Pemisah: menu | kontrol kelas -->
            <span class="mx-1.5 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
          </template>

          <button
            type="button"
            class="rounded-xl px-2.5 py-2 text-lg leading-none text-slate-600 transition hover:bg-slate-100
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            :title="fullscreenLabel"
            :aria-label="fullscreenLabel"
            :aria-pressed="isFullscreen"
            @click="toggleFullscreen"
          >
            <component :is="isFullscreen ? Minimize : Maximize" :size="20" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="rounded-xl px-2.5 py-2 text-lg leading-none transition hover:bg-slate-100
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            :class="settings.soundEnabled ? 'text-slate-700' : 'text-slate-300'"
            :title="soundLabel"
            :aria-label="soundLabel"
            :aria-pressed="settings.soundEnabled"
            @click="toggleSound"
          >
            <component :is="soundIcon" :size="20" aria-hidden="true" />
          </button>

          <button
            v-if="isAnswering"
            type="button"
            class="rounded-xl px-2.5 py-2 text-lg leading-none transition hover:bg-slate-100
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            :class="settings.musicEnabled ? 'text-slate-700' : 'text-slate-300'"
            :title="musicLabel"
            :aria-label="musicLabel"
            :aria-pressed="settings.musicEnabled"
            @click="toggleMusic"
          >
            <Music
              :size="20"
              aria-hidden="true"
              :class="settings.musicEnabled ? '' : 'opacity-40'"
              :stroke-width="settings.musicEnabled ? 2 : 1.5"
            />
          </button>

          <!-- Menu admin: logout pindah ke sini. -->
          <div v-if="isAdmin" class="relative" @keydown.escape="showAdminMenu = false">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition
                     hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
              :aria-expanded="showAdminMenu"
              aria-haspopup="menu"
              @click="showAdminMenu = !showAdminMenu"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <User :size="16" aria-hidden="true" />
              </span>
              <span>Admin</span>
              <ChevronDown :size="16" aria-hidden="true" />
            </button>
            <div
              v-if="showAdminMenu"
              role="menu"
              class="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl bg-white py-1.5 shadow-card-hover ring-1 ring-slate-200"
            >
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                @click="handleLogout"
              >
                <LogOut :size="16" aria-hidden="true" />
                Logout
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="hidden border-t border-slate-200/70 py-4 text-center text-sm font-semibold text-slate-400 sm:block">
      KuisKita — belajar jadi seru 🎉
    </footer>

    <!-- Menu untuk layar kecil: bottom bar (hanya setelah masuk). -->
    <nav
      v-if="isAdmin"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden"
      aria-label="Menu utama"
    >
      <div class="mx-auto flex max-w-7xl items-stretch">
        <RouterLink
          to="/"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-slate-600 transition"
          active-class="text-brand-700"
        >
          <Home :size="20" aria-hidden="true" />
          <span>Kuis</span>
        </RouterLink>

        <RouterLink
          :to="isAdmin ? '/admin/dashboard' : '/admin'"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition"
          :class="isDashboardSection ? 'text-brand-700' : 'text-slate-600'"
        >
          <component :is="isAdmin ? LayoutDashboard : LogIn" :size="20" aria-hidden="true" />
          <span>{{ isAdmin ? 'Dashboard' : 'Login' }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
