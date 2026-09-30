<script setup>
import { ref, useId } from 'vue'
import { useModalFocus } from '@/composables/useModalFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Konfirmasi' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Ya, Lanjutkan' },
  cancelLabel: { type: String, default: 'Batal' },
  variant: { type: String, default: 'danger' }, // 'danger' | 'primary'
  isLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const dialogRef = ref(null)
const titleId = `confirm-title-${useId()}`
const messageId = `confirm-message-${useId()}`

useModalFocus(
  () => props.open,
  dialogRef,
  () => emit('cancel'),
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="emit('cancel')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="message ? messageId : undefined"
          tabindex="-1"
          class="w-full max-w-lg rounded-3xl bg-white p-8 shadow-card-hover animate-pop focus:outline-none"
        >
          <h2 :id="titleId" class="text-2xl font-extrabold text-slate-900">{{ title }}</h2>
          <p v-if="message" :id="messageId" class="mt-3 text-lg text-slate-600 preserve-lines">{{ message }}</p>

          <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" class="btn-neutral" :disabled="isLoading" @click="emit('cancel')">
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
              :disabled="isLoading"
              @click="emit('confirm')"
            >
              {{ isLoading ? 'Memproses...' : confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
