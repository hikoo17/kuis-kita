<script setup>
defineProps({
  classes: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const classEmojis = ['🏫', '📚', '🎒', '📝', '🎓', '📖', '✏️', '🧮']

function emojiFor(index) {
  return classEmojis[index % classEmojis.length]
}
</script>

<template>
  <section class="animate-fade-in">
    <div class="text-center">
      <h2 class="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">Pilih Kelas</h2>
      <p class="mt-2 text-lg text-slate-500">Kelas mana yang mau main kuis hari ini?</p>
    </div>

    <div v-if="error" class="mx-auto mt-8 max-w-xl rounded-3xl bg-red-50 p-6 text-center ring-1 ring-red-200">
      <p class="text-3xl" aria-hidden="true">⚠️</p>
      <p class="mt-2 text-lg font-semibold text-red-700">{{ error }}</p>
    </div>

    <div v-else-if="isLoading" class="mt-10 text-center">
      <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"></div>
      <p class="mt-4 text-lg font-semibold text-slate-500">Memuat...</p>
    </div>

    <div v-else-if="classes.length === 0" class="mx-auto mt-8 max-w-xl rounded-3xl bg-white p-10 text-center shadow-card">
      <p class="text-5xl" aria-hidden="true">❓</p>
      <h3 class="mt-4 text-2xl font-extrabold text-slate-900">Belum Ada Kelas</h3>
      <p class="mt-3 text-lg text-slate-500 preserve-lines">
        Guru dapat menambahkan kelas melalui Dashboard Guru.
      </p>
      <RouterLink to="/admin" class="btn-primary mt-6">Buka Dashboard Guru</RouterLink>
    </div>

    <div v-else class="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="(schoolClass, index) in classes"
        :key="schoolClass.id"
        type="button"
        class="group flex min-h-[6.5rem] items-center justify-center gap-3 rounded-3xl bg-white px-6 py-6
               shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-card-hover
               focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 active:scale-95 active:bg-brand-50"
        @click="emit('select', schoolClass)"
      >
        <span class="text-3xl" aria-hidden="true">{{ emojiFor(index) }}</span>
        <span class="text-xl font-extrabold text-slate-800 group-hover:text-brand-700 sm:text-2xl">
          {{ schoolClass.name }}
        </span>
      </button>
    </div>
  </section>
</template>
