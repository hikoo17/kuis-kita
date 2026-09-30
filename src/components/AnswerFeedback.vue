<script setup>
import { onMounted, ref, useId } from 'vue'
import { useSound } from '@/composables/useSound'
import { useModalFocus } from '@/composables/useModalFocus'
import ConfettiBurst from '@/components/ConfettiBurst.vue'

const props = defineProps({
  status: { type: String, required: true }, // 'correct' | 'wrong' | 'timeout'
  studentName: { type: String, default: '' },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  isLast: { type: Boolean, default: false },
})

const emit = defineEmits(['retry', 'next', 'change'])

const { play } = useSound()

const isCorrect = props.status === 'correct'
const isTimeout = props.status === 'timeout'

const dialogRef = ref(null)
const titleId = `feedback-title-${useId()}`

// Modal sementara: kunci fokus di dalam, tapi Esc tidak menutup
// (siswa harus memilih Lanjut / Coba Lagi).
useModalFocus(() => true, dialogRef, () => {}, { closeOnEscape: false })

onMounted(() => {
  // Sound effect for the answer.
  if (isCorrect) {
    play('correct')
    if (props.streak > 1) window.setTimeout(() => play('streak'), 620)
  } else {
    play('fail')
  }
})
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    role="alertdialog"
    aria-modal="true"
    :aria-labelledby="titleId"
  >
    <!-- Confetti (only on correct answers) -->
    <ConfettiBurst v-if="isCorrect" />

    <div
      ref="dialogRef"
      tabindex="-1"
      class="relative w-full max-w-2xl rounded-[2rem] p-8 text-center shadow-card-hover animate-pop focus:outline-none sm:p-12"
      :class="isCorrect ? 'bg-emerald-500 text-white' : 'bg-white text-slate-800'"
    >
      <p class="text-6xl sm:text-7xl" aria-hidden="true">
        {{ isCorrect ? '🎉' : isTimeout ? '⏰' : '😊' }}
      </p>

      <h2 :id="titleId" class="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
        {{ isCorrect ? 'Benar!' : isTimeout ? 'Waktu Habis!' : 'Belum Tepat!' }}
      </h2>

      <template v-if="isCorrect">
        <p class="mt-5 inline-block rounded-2xl bg-accent-400 px-6 py-3 text-3xl font-extrabold text-accent-600
                  shadow-lg sm:text-4xl animate-bump">
          +{{ points }} Poin
        </p>
        <p v-if="streak > 1" class="mt-3 chip bg-orange-500 text-white">🔥 {{ streak }} Streak!</p>
      </template>

      <template v-else-if="isTimeout">
        <p class="mt-4 text-xl font-semibold text-slate-500 sm:text-2xl">
          Sayang sekali, {{ studentName }} kehabisan waktu.
        </p>
      </template>

      <template v-else>
        <p class="mt-4 text-xl font-semibold text-slate-500 sm:text-2xl">Coba pikirkan lagi.</p>
      </template>

      <div class="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
        <template v-if="isCorrect">
          <button type="button" class="btn bg-white text-emerald-600 hover:bg-emerald-50" @click="emit('next')">
            {{ isLast ? 'Lihat Hasil' : 'Soal Berikutnya' }}
          </button>
        </template>
        <template v-else-if="isTimeout">
          <button type="button" class="btn-neutral" @click="emit('change')">Coba Lagi</button>
          <button type="button" class="btn-primary" @click="emit('next')">
            {{ isLast ? 'Lihat Hasil' : 'Lanjut' }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="btn-neutral" @click="emit('retry')">Coba Lagi</button>
          <button type="button" class="btn-primary" @click="emit('next')">
            {{ isLast ? 'Lihat Hasil' : 'Lanjut' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
