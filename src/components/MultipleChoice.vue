<script setup>
import { Check, X } from '@lucide/vue'
import MathText from '@/components/MathText.vue'

const props = defineProps({
  options: { type: Array, default: () => [] },
  selectedAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' },
  revealed: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

/** Colour feedback after the answer has been checked.
 *  Only the picked option is ever highlighted: green when it is correct,
 *  red when it is wrong. The correct answer is never revealed for
 *  unanswered or wrongly answered questions, so the next student
 *  still has a fair chance. */
function optionClasses(option) {
  const isSelected = option.label === props.selectedAnswer

  if (!props.revealed) {
    // Belum bisa diklik (mis. siswa belum dipilih): tampil redup, tanpa hover.
    if (props.disabled) {
      return ['bg-white ring-2 ring-slate-200 opacity-60 cursor-not-allowed']
    }
    // The picked option stays bright blue until the answer is submitted.
    if (isSelected) return ['bg-brand-50 ring-2 ring-brand-500 shadow-card']
    return [
      'bg-white ring-2 ring-slate-200 hover:-translate-y-0.5 hover:ring-brand-400 hover:shadow-card',
      'active:scale-[0.98]',
    ]
  }

  const isCorrectPick = isSelected && option.label === props.correctAnswer
  if (isCorrectPick) return ['bg-emerald-50 ring-2 ring-emerald-400']
  if (isSelected) return ['bg-red-50 ring-2 ring-red-300']
  return ['bg-white ring-2 ring-slate-100 opacity-60']
}

function labelClasses(option) {
  const isSelected = option.label === props.selectedAnswer

  if (!props.revealed) {
    if (isSelected) return ['bg-brand-600 text-white']
    return ['bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white']
  }
  const isCorrectPick = isSelected && option.label === props.correctAnswer
  if (isCorrectPick) return ['bg-emerald-500 text-white']
  if (isSelected) return ['bg-red-500 text-white']
  return ['bg-slate-100 text-slate-400']
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <button
      v-for="option in options"
      :key="option.label"
      type="button"
      class="group relative flex min-h-[5.5rem] items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left
             transition duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
      :class="optionClasses(option)"
      :disabled="disabled || revealed"
      :aria-pressed="selectedAnswer === option.label"
      @click="emit('select', option.label)"
    >
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold transition duration-200"
        :class="labelClasses(option)"
      >
        {{ option.label }}
      </span>
      <span class="text-base font-bold leading-snug text-slate-800 sm:text-lg">
        <MathText :text="option.text" />
      </span>

      <!-- Penanda benar/salah, hanya pada pilihan yang dipilih. -->
      <span
        v-if="revealed && selectedAnswer === option.label"
        class="absolute right-3.5 top-3.5"
        aria-hidden="true"
      >
        <Check v-if="option.label === correctAnswer" :size="20" class="text-emerald-600" />
        <X v-else :size="20" class="text-red-500" />
      </span>
    </button>
  </div>
</template>
