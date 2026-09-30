<script setup>
import { Info } from '@lucide/vue'

defineProps({
  label: { type: String, default: 'Info' },
})

defineEmits(['open'])
</script>

<template>
  <button
    type="button"
    class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500
           transition hover:bg-slate-300 hover:text-slate-700 focus:outline-none
           focus-visible:ring-4 focus-visible:ring-brand-200"
    :aria-label="label"
    @click="$emit('open')"
  >
    <Info :size="15" aria-hidden="true" />
  </button>
</template>
