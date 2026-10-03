<script setup>
import { computed, ref, watch } from 'vue'
import { FileUp, Trash2, X } from '@lucide/vue'
import MathText from '@/components/MathText.vue'
import { extractDocxBlocks } from '@/lib/docxImport'
import { extractPdfBlocks } from '@/lib/pdfImport'
import { parseQuestions } from '@/lib/parseQuestions'
import { useQuestions } from '@/composables/useQuestions'
import { useModalFocus } from '@/composables/useModalFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
  subject: { type: String, default: '' },
})

const emit = defineEmits(['close', 'imported'])

const { addQuestion } = useQuestions()

const dialogRef = ref(null)
const fileInput = ref(null)
const fileName = ref('')
const isParsing = ref(false)
const parseError = ref('')
const items = ref([])
const isImporting = ref(false)

useModalFocus(
  () => props.open,
  dialogRef,
  () => emit('close'),
)

const selectedCount = computed(() => items.value.filter((item) => item.selected).length)

// Reset tiap kali modal dibuka.
watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function reset() {
  fileName.value = ''
  parseError.value = ''
  items.value = []
  isImporting.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function optionLabels(item) {
  return item.options.map((option) => option.label)
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  fileName.value = file.name
  parseError.value = ''
  items.value = []
  isParsing.value = true

  try {
    const isPdf = /\.pdf$/i.test(file.name)
    const blocks = isPdf ? await extractPdfBlocks(file) : await extractDocxBlocks(file)
    const parsed = parseQuestions(blocks)
    if (parsed.length === 0) {
      parseError.value = 'Tidak ada soal yang terbaca. Pastikan tiap soal bernomor dan pilihannya A, B, C, ...'
      return
    }
    items.value = parsed.map((item) => ({
      ...item,
      selected: true,
      options: item.options.map((option) => ({ ...option })),
    }))
  } catch (err) {
    parseError.value = err.message || 'Gagal membaca file. Pastikan file .docx atau .pdf yang benar.'
  } finally {
    isParsing.value = false
  }
}

function removeItem(index) {
  items.value.splice(index, 1)
}

function isImportable(item) {
  if (!item.text.trim() || !item.correctAnswer.trim()) return false
  if (item.type === 'multiple_choice') {
    return item.options.filter((option) => option.text.trim()).length >= 2
  }
  return true
}

async function runImport() {
  const queue = items.value.filter((item) => item.selected && isImportable(item))
  if (queue.length === 0) return

  isImporting.value = true
  let imported = 0
  try {
    for (const item of queue) {
      await addQuestion({
        subject: props.subject,
        type: item.type,
        question_text: item.text,
        options: item.type === 'multiple_choice' ? item.options : null,
        correct_answer: item.correctAnswer,
        image_url: null,
      })
      imported += 1
    }
    emit('imported', imported)
    emit('close')
  } catch (err) {
    parseError.value = err.message || 'Sebagian soal gagal disimpan. Coba lagi.'
  } finally {
    isImporting.value = false
  }
}
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
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
          tabindex="-1"
          class="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-3xl bg-slate-50 shadow-card-hover focus:outline-none sm:rounded-3xl"
        >
          <!-- Kepala -->
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:rounded-t-3xl">
            <div class="min-w-0">
              <h2 id="import-title" class="text-lg font-extrabold text-slate-900 sm:text-xl">Impor Soal</h2>
              <p class="mt-0.5 truncate text-sm text-slate-500">
                Materi: <span class="font-bold text-brand-700">{{ subject }}</span>
              </p>
            </div>
            <button
              type="button"
              class="icon-btn-neutral"
              aria-label="Tutup"
              @click="emit('close')"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>

          <!-- Isi -->
          <div class="flex-1 overflow-y-auto px-5 py-5">
            <!-- Langkah 1: pilih berkas -->
            <div
              class="rounded-2xl border-2 border-dashed p-5 text-center"
              :class="fileName ? 'border-brand-200 bg-white' : 'border-slate-300 bg-white'"
            >
              <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <FileUp :size="24" aria-hidden="true" />
              </span>
              <p class="mt-3 font-extrabold text-slate-800">
                {{ fileName ? fileName : 'Pilih file .docx atau .pdf' }}
              </p>
              <p class="mt-1 text-sm text-slate-400">
                Soal harus bernomor dengan pilihan A, B, C, … dan kunci jawaban (tabel atau "Jawaban: B").
                Rumus di PDF terbaca sebagai teks biasa — bisa dilengkapi lewat tombol Sisipkan Rumus.
              </p>
              <label class="btn-primary mt-3 w-full !py-2.5 sm:w-auto" :class="{ 'pointer-events-none opacity-60': isParsing }">
                <FileUp :size="18" aria-hidden="true" />
                {{ isParsing ? 'Membaca...' : 'Pilih Berkas' }}
                <input
                  ref="fileInput"
                  type="file"
                  accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  class="hidden"
                  :disabled="isParsing"
                  @change="onFileChange"
                />
              </label>
            </div>

            <p v-if="parseError" class="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">
              {{ parseError }}
            </p>

            <!-- Langkah 2: pratinjau -->
            <div v-if="items.length > 0" class="mt-5">
              <p class="text-sm font-extrabold uppercase tracking-wide text-slate-500">
                Pratinjau — {{ selectedCount }} dari {{ items.length }} soal dipilih
              </p>

              <ul class="mt-3 space-y-4">
                <li
                  v-for="(item, index) in items"
                  :key="index"
                  class="rounded-2xl bg-white p-4 ring-1"
                  :class="item.selected ? 'ring-brand-200' : 'ring-slate-200 opacity-70'"
                >
                  <div class="flex items-start gap-3">
                    <input
                      v-model="item.selected"
                      type="checkbox"
                      class="mt-1 h-5 w-5 shrink-0 rounded text-brand-600"
                      :aria-label="`Sertakan soal ${index + 1}`"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="chip bg-slate-200 text-slate-600">Soal {{ index + 1 }}</span>
                        <span class="chip bg-brand-50 text-brand-700">
                          {{ item.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Isian Singkat' }}
                        </span>
                        <span
                          class="chip"
                          :class="isImportable(item) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                        >
                          {{ isImportable(item) ? `Kunci: ${item.correctAnswer}` : 'Perlu dilengkapi' }}
                        </span>
                      </div>

                      <textarea
                        v-model="item.text"
                        rows="2"
                        class="input mt-2 min-h-[3.5rem] !text-base"
                        aria-label="Teks soal"
                      />
                      <div class="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
                        <MathText :text="item.text" />
                      </div>

                      <div v-if="item.type === 'multiple_choice'" class="mt-2 space-y-1.5">
                        <div v-for="option in item.options" :key="option.label" class="flex items-center gap-2">
                          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-extrabold text-brand-700">
                            {{ option.label }}
                          </span>
                          <input v-model="option.text" type="text" class="input !py-2 !text-base" :aria-label="`Pilihan ${option.label}`" />
                        </div>
                      </div>

                      <div class="mt-2 flex items-center gap-2">
                        <label class="text-sm font-bold text-slate-500" :for="`key-${index}`">Kunci</label>
                        <select
                          v-if="item.type === 'multiple_choice'"
                          :id="`key-${index}`"
                          v-model="item.correctAnswer"
                          class="input w-auto !py-2 !text-base"
                        >
                          <option value="" disabled>Pilih...</option>
                          <option v-for="label in optionLabels(item)" :key="label" :value="label">{{ label }}</option>
                        </select>
                        <input
                          v-else
                          :id="`key-${index}`"
                          v-model="item.correctAnswer"
                          type="text"
                          class="input !py-2 !text-base"
                          placeholder="Jawaban benar"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      class="icon-btn-danger shrink-0"
                      :aria-label="`Hapus soal ${index + 1}`"
                      @click="removeItem(index)"
                    >
                      <Trash2 :size="18" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Kaki -->
          <div class="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:rounded-b-3xl">
            <button type="button" class="btn-neutral !px-4 !py-2 !text-base" @click="emit('close')">Batal</button>
            <button
              type="button"
              class="btn-primary !px-5 !py-2.5"
              :disabled="selectedCount === 0 || isImporting"
              @click="runImport"
            >
              {{ isImporting ? 'Menyimpan...' : `Impor ${selectedCount} Soal` }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
