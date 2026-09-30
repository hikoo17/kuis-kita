<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSound } from '@/composables/useSound'

const emit = defineEmits(['done'])

const { play } = useSound()

// step: 3 -> 2 -> 1 -> 0 ("Mulai!")
const step = ref(3)
const STEP_MS = 700

let timers = []
let finished = false
let previousOverflow = ''

function finish() {
  if (finished) return
  finished = true
  timers.forEach((timer) => window.clearTimeout(timer))
  timers = []
  emit('done')
}

onMounted(() => {
  // Lock background scrolling while the countdown covers the screen.
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  play('countTick')
  timers.push(
    window.setTimeout(() => {
      step.value = 2
      play('countTick')
    }, STEP_MS),
    window.setTimeout(() => {
      step.value = 1
      play('countTick')
    }, STEP_MS * 2),
    window.setTimeout(() => {
      step.value = 0
      play('countGo')
    }, STEP_MS * 3),
    window.setTimeout(finish, STEP_MS * 3 + 550),
  )
})

onBeforeUnmount(() => {
  timers.forEach((timer) => window.clearTimeout(timer))
  timers = []
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex cursor-pointer items-center justify-center bg-brand-900/90 p-4 backdrop-blur-sm"
    role="status"
    aria-label="Hitung mundur giliran"
    @click="finish"
  >
    <div class="text-center animate-pop">
      <p class="text-lg font-semibold text-white/70">Bersiap...</p>

      <p
        :key="step"
        class="mt-6 font-extrabold tabular-nums text-white animate-pop"
        :class="step === 0 ? 'text-6xl sm:text-8xl' : 'text-8xl sm:text-9xl'"
      >
        {{ step === 0 ? 'Mulai!' : step }}
      </p>

      <p class="mt-8 text-sm font-semibold text-white/50">Klik di mana saja untuk lewati</p>
    </div>
  </div>
</template>
