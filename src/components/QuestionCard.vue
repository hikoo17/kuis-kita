<script setup>
import MathText from '@/components/MathText.vue'

defineProps({
  question: { type: Object, required: true },
  questionNumber: { type: Number, default: 1 },
  totalQuestions: { type: Number, default: 0 },
  // Seconds left on the answer timer. Null hides the pill.
  timeLeft: { type: Number, default: null },
})
</script>

<template>
  <article class="rounded-3xl bg-white p-4 shadow-card sm:p-6 lg:p-7">
    <header class="flex items-center justify-between gap-3">
      <span class="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-600">
        Soal {{ questionNumber }}<template v-if="totalQuestions"> dari {{ totalQuestions }}</template>
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

    <h2 class="mt-3 text-xl font-extrabold leading-snug text-slate-900 preserve-lines sm:text-2xl lg:text-3xl">
      <MathText :text="question.question_text" />
    </h2>

    <img
      v-if="question.image_url"
      :src="question.image_url"
      :alt="question.question_text ? `Gambar untuk soal: ${question.question_text}` : 'Gambar soal'"
      class="mx-auto mt-4 max-h-48 w-auto rounded-2xl object-contain ring-1 ring-slate-200"
    />

    <div class="mt-5">
      <slot />
    </div>
  </article>
</template>
