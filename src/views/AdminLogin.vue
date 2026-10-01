<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Target } from '@lucide/vue'
import { useAdminAuth, isAdminAuthenticated } from '@/composables/useAdminAuth'
import { useSound } from '@/composables/useSound'

const router = useRouter()
const { login } = useAdminAuth()
const { play } = useSound()

const pin = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const isDev = import.meta.env.DEV
const defaultPin = import.meta.env.VITE_ADMIN_PIN || '1234'

function submit() {
  errorMessage.value = ''
  if (!pin.value.trim()) {
    errorMessage.value = 'PIN wajib diisi.'
    return
  }

  isSubmitting.value = true
  // Small delay so the button feedback is visible.
  window.setTimeout(() => {
    const success = login(pin.value)
    isSubmitting.value = false
    if (!success) {
      play('error')
      errorMessage.value = 'PIN yang kamu masukkan salah. Coba lagi ya.'
      pin.value = ''
      return
    }
    play('success')
    router.push('/')
  }, 250)
}

onMounted(() => {
  if (isAdminAuthenticated()) router.replace('/admin/dashboard')
})
</script>

<template>
  <div class="relative overflow-hidden">
    <!-- Latar dekoratif -->
    <div aria-hidden="true" class="pointer-events-none absolute inset-0">
      <div class="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-100 blur-3xl"></div>
      <div class="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-brand-100 blur-3xl"></div>
      <div class="absolute -right-10 top-1/3 h-40 w-40 rounded-full bg-accent-100 blur-3xl"></div>
    </div>

    <div class="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center justify-center px-4 py-10">
      <div class="w-full animate-pop">
        <div class="card !p-8 text-center shadow-card-hover sm:!p-10">
          <span
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br
                   from-brand-500 to-brand-700 text-white shadow-card"
          >
            <Target :size="30" aria-hidden="true" />
          </span>
          <p class="mt-4 text-xs font-extrabold uppercase tracking-[0.22em] text-brand-600">KuisKita</p>
          <h1 class="mt-2 text-3xl font-extrabold text-slate-900">Masuk Guru</h1>
          <p class="mt-2 text-slate-500">Masukkan PIN untuk membuka menu kuis & dashboard.</p>

          <form class="mt-8 space-y-4" @submit.prevent="submit">
            <input
              v-model="pin"
              type="password"
              inputmode="numeric"
              class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-5 text-center text-3xl
                     font-extrabold tracking-[0.4em] text-slate-800 placeholder:tracking-widest
                     placeholder:text-slate-300 focus:border-brand-400 focus:bg-white focus:outline-none
                     focus:ring-4 focus:ring-brand-100"
              placeholder="••••"
              aria-label="PIN Guru"
              autocomplete="off"
            />

            <p v-if="errorMessage" class="rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">
              {{ errorMessage }}
            </p>

            <button type="submit" class="btn-primary w-full py-4 text-xl" :disabled="isSubmitting">
              {{ isSubmitting ? 'Memeriksa...' : 'Masuk' }}
            </button>
          </form>

          <p v-if="isDev" class="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
            Mode pengembangan — PIN bawaan: <span class="font-extrabold text-slate-700">{{ defaultPin }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
