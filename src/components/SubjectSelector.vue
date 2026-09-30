<script setup>
import { ArrowLeft } from '@lucide/vue'
import { ALL_SUBJECTS } from '@/composables/useQuestions'

defineProps({
  subjects: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['select', 'back'])

const subjectEmojis = ['📐', '➗', '📊', '🧮', '📚', '🔢', '🧠', '📈']

function emojiFor(index) {
  return subjectEmojis[index % subjectEmojis.length]
}
</script>

<template>
  <section class="animate-fade-in">
    <div class="text-center">
      <h2 class="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">Pilih Materi</h2>
      <p class="mt-2 text-lg text-slate-500">Materi mana yang mau kita kerjakan?</p>
    </div>

    <div class="mx-auto mt-6 max-w-3xl">
      <button
        type="button"
        class="btn-neutral !px-4 !py-2 !text-base shadow-card ring-0 hover:shadow-card-hover"
        title="Kembali untuk ganti kelas"
        @click="emit('back')"
      >
        <ArrowLeft :size="18" aria-hidden="true" />
        Kembali
      </button>
    </div>

    <div v-if="error" class="mx-auto mt-8 max-w-xl rounded-3xl bg-red-50 p-6 text-center ring-1 ring-red-200">
      <p class="text-3xl" aria-hidden="true">⚠️</p>
      <p class="mt-2 text-lg font-semibold text-red-700">{{ error }}</p>
    </div>

    <div v-else-if="isLoading" class="mt-10 text-center">
      <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"></div>
      <p class="mt-4 text-lg font-semibold text-slate-500">Memuat...</p>
    </div>

    <div v-else-if="subjects.length === 0" class="mx-auto mt-8 max-w-xl rounded-3xl bg-white p-10 text-center shadow-card">
      <p class="text-5xl" aria-hidden="true">❓</p>
      <h3 class="mt-4 text-2xl font-extrabold text-slate-900">Belum Ada Soal</h3>
      <p class="mt-3 text-lg text-slate-500 preserve-lines">
        Guru dapat menambahkan soal melalui Dashboard Guru.
      </p>
      <RouterLink to="/admin" class="btn-primary mt-6">Buka Dashboard Guru</RouterLink>
    </div>

    <div v-else class="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="(subject, index) in subjects"
        :key="subject"
        type="button"
        class="group flex min-h-[6.5rem] items-center justify-center gap-3 rounded-3xl bg-white px-6 py-6
               shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-card-hover
               focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 active:scale-95 active:bg-brand-50"
        @click="emit('select', subject)"
      >
        <span class="text-3xl" aria-hidden="true">{{ emojiFor(index) }}</span>
        <span class="text-xl font-extrabold text-slate-800 group-hover:text-brand-700 sm:text-2xl">
          {{ subject }}
        </span>
      </button>

      <button
        type="button"
        class="group flex min-h-[6.5rem] items-center justify-center gap-3 rounded-3xl bg-brand-600 px-6 py-6
               text-white shadow-card transition duration-200 hover:-translate-y-1 hover:bg-brand-700
               hover:shadow-card-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 active:scale-95"
        @click="emit('select', ALL_SUBJECTS)"
      >
        <span class="text-3xl" aria-hidden="true">🎲</span>
        <span class="text-xl font-extrabold sm:text-2xl">Semua Materi</span>
      </button>
    </div>
  </section>
</template>
