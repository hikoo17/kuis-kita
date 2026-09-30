<script setup>
import { ref, useId } from 'vue'
import { Info } from '@lucide/vue'
import { useModalFocus } from '@/composables/useModalFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Info' },
  message: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const dialogRef = ref(null)
const titleId = `info-title-${useId()}`
const messageId = `info-message-${useId()}`

useModalFocus(
  () => props.open,
  dialogRef,
  () => emit('close'),
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
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="message ? messageId : undefined"
          tabindex="-1"
          class="w-full max-w-md rounded-3xl bg-white p-8 shadow-card-hover animate-pop focus:outline-none"
        >
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Info :size="20" aria-hidden="true" />
            </span>
            <h2 :id="titleId" class="text-xl font-extrabold text-slate-900">{{ title }}</h2>
          </div>

          <p v-if="message" :id="messageId" class="mt-4 text-lg leading-relaxed text-slate-600 preserve-lines">
            {{ message }}
          </p>

          <div class="mt-7 text-right">
            <button type="button" class="btn-primary" @click="emit('close')">Tutup</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
