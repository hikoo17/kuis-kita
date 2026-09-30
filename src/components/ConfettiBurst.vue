<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  count: { type: Number, default: 24 },
})

const pieces = ref([])

const CONFETTI_COLORS = ['#6366f1', '#fbbf24', '#10b981', '#f97316', '#ec4899', '#3b82f6']

onMounted(() => {
  // Lightweight confetti: absolutely positioned divs animated with CSS.
  pieces.value = Array.from({ length: props.count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 350,
    duration: 1200 + Math.random() * 700,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    size: 7 + Math.random() * 8,
    drift: Math.random() * 120 - 60,
  }))
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <span
      v-for="piece in pieces"
      :key="piece.id"
      class="absolute top-0 block animate-confetti"
      :style="{
        left: piece.left + '%',
        width: piece.size + 'px',
        height: piece.size + 'px',
        backgroundColor: piece.color,
        animationDelay: piece.delay + 'ms',
        animationDuration: piece.duration + 'ms',
        borderRadius: '2px',
        '--confetti-x': piece.drift + 'px',
      }"
    />
  </div>
</template>
