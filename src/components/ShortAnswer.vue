<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const value = ref('')
const inputRef = ref(null)

function submit() {
  const answer = value.value.trim()
  if (!answer || props.disabled || props.isLoading) return
  emit('submit', answer)
}

function focus() {
  inputRef.value?.focus()
}

/** Clear the field, e.g. after "Coba Lagi". */
function reset() {
  value.value = ''
  focus()
}

defineExpose({ focus, reset })
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <input
      ref="inputRef"
      v-model="value"
      type="text"
      class="w-full rounded-3xl border-2 border-slate-200 bg-slate-50 px-6 py-6 text-center text-2xl
             font-bold text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white
             focus:outline-none focus:ring-4 focus:ring-brand-100 sm:text-3xl"
      placeholder="Tulis jawabanmu di sini..."
      :disabled="disabled || isLoading"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label="Jawaban"
    />

    <div class="text-center">
      <button type="submit" class="btn-primary w-full px-10 py-5 text-xl sm:w-auto" :disabled="disabled || isLoading">
        <span v-if="isLoading">Memeriksa...</span>
        <span v-else>Kirim Jawaban</span>
      </button>
    </div>

    <p class="text-center text-sm font-semibold text-slate-400">
      Tekan <kbd class="rounded-md bg-slate-200 px-2 py-0.5 text-slate-600">Enter</kbd> untuk mengirim jawaban.
    </p>
  </form>
</template>
