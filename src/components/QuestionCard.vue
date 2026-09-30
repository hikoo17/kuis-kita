<script setup>
import MatrixText from '@/components/MatrixText.vue'

defineProps({
  question: { type: Object, required: true },
  questionNumber: { type: Number, default: 1 },
  totalQuestions: { type: Number, default: 0 },
  // Seconds left on the answer timer. Null hides the pill.
  timeLeft: { type: Number, default: null },
})
</script>

<template>
  <article class="rounded-3xl bg-white p-6 shadow-card sm:p-8 lg:p-10">
    <header class="flex items-center justify-between gap-3">
      <span class="text-sm font-bold tracking-widest text-slate-400">
        Soal {{ questionNumber }}
        <template v-if="totalQuestions">dari {{ totalQuestions }}</template>
      </span>

      <span
        v-if="timeLeft !== null"
        class="chip tabular-nums"
        :class="timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-brand-50 text-brand-700'"
      >
        <span aria-hidden="true">⏱</span>
        <span>{{ timeLeft }}</span>
      </span>
    </header>

    <h2 class="mt-6 text-2xl font-extrabold leading-snug text-slate-900 preserve-lines sm:text-3xl lg:text-4xl">
      <MatrixText :text="question.question_text" />
    </h2>

    <img
      v-if="question.image_url"
      :src="question.image_url"
      :alt="question.question_text ? `Gambar untuk soal: ${question.question_text}` : 'Gambar soal'"
      class="mx-auto mt-5 max-h-72 w-auto rounded-2xl object-contain ring-1 ring-slate-200"
    />

    <div class="mt-8">
      <slot />
    </div>
  </article>
</template>
