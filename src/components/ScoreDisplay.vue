<script setup>
defineProps({
  streak: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="flex items-center gap-3">
    <div v-if="streak > 1" class="chip bg-orange-100 text-orange-600" :class="compact ? 'text-xs' : 'text-sm'">
      <span aria-hidden="true">🔥</span>
      <span>{{ streak }} Streak!</span>
    </div>
  </div>
</template>
