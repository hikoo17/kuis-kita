<script setup>
import { computed } from 'vue'

const props = defineProps({
  students: { type: Array, default: () => [] },
  limit: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
  highlightId: { type: String, default: '' },
})

const medals = ['🥇', '🥈', '🥉']

const visibleStudents = computed(() => (props.limit > 0 ? props.students.slice(0, props.limit) : props.students))

function rowClasses(index) {
  if (index === 0) return 'bg-accent-100/70 ring-2 ring-accent-400'
  if (index === 1) return 'bg-slate-100 ring-2 ring-slate-300'
  if (index === 2) return 'bg-orange-50 ring-2 ring-orange-300'
  return 'bg-white ring-1 ring-slate-100'
}

function rankClasses(index) {
  if (index === 0) return 'text-accent-600'
  if (index === 1) return 'text-slate-500'
  if (index === 2) return 'text-orange-500'
  return 'text-slate-400'
}
</script>

<template>
  <div class="space-y-2.5" role="list" aria-label="Papan skor">
    <div
      v-for="(student, index) in visibleStudents"
      :key="student.id"
      role="listitem"
      class="flex items-center gap-4 rounded-2xl px-4 transition duration-300 animate-slide-up"
      :class="[
        rowClasses(index),
        compact ? 'py-2.5' : 'py-3.5',
        student.id === highlightId ? 'ring-4 ring-brand-400' : '',
      ]"
    >
      <span
        class="flex w-10 shrink-0 items-center justify-center font-extrabold"
        :class="[rankClasses(index), compact ? 'text-lg' : 'text-2xl']"
      >
        {{ medals[index] ?? index + 1 }}
      </span>

      <span
        class="min-w-0 flex-1 truncate font-extrabold text-slate-800"
        :class="compact ? 'text-base' : 'text-xl'"
      >
        {{ student.name }}
      </span>

      <span
        class="shrink-0 font-extrabold tabular-nums text-slate-700"
        :class="compact ? 'text-sm' : 'text-lg'"
      >
        {{ student.score }} <span class="text-slate-400">Poin</span>
      </span>
    </div>
  </div>
</template>
