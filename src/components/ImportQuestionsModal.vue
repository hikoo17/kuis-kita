<script setup>
import { computed, ref, watch } from 'vue'
import { FileText, FileUp, ImagePlus, Sparkles, Trash2, X } from '@lucide/vue'
import MathText from '@/components/MathText.vue'
import { extractDocxBlocks } from '@/lib/docxImport'
import { parseQuestions } from '@/lib/parseQuestions'
import { useQuestions, QUESTION_IMAGE_MAX_BYTES } from '@/composables/useQuestions'
import { useSettings } from '@/composables/useSettings'
import { useModalFocus } from '@/composables/useModalFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
  subject: { type: String, default: '' },
})

const emit = defineEmits(['close', 'imported'])

const { addQuestion, uploadQuestionImage, deleteQuestionImage } = useQuestions()
const { settings } = useSettings()

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
    const blocks = await extractDocxBlocks(file)
    const parsed = parseQuestions(blocks)
    if (parsed.length === 0) {
      parseError.value = 'Tidak ada soal yang terbaca. Pastikan tiap soal bernomor dan pilihannya A, B, C, ...'
      return
    }
    const globalTime = Math.floor(Number(settings.value.answerTimeLimit))
    items.value = parsed.map((item) => ({
      ...item,
      selected: true,
      timeLimit: Number.isFinite(globalTime) ? Math.max(0, globalTime) : null,
      options: item.options.map((option) => ({ ...option, image: null, imageFile: null, previewUrl: '' })),
    }))
  } catch (err) {
    parseError.value = err.message || 'Gagal membaca file. Pastikan file .docx yang benar.'
  } finally {
    isParsing.value = false
  }
}

function removeItem(index) {
  const [removed] = items.value.splice(index, 1)
  removed?.options.forEach((option) => {
    if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
  })
}

function removePreviewOption(index, label) {
  const item = items.value[index]
  if (!item || item.options.length <= 2) return
  const removed = item.options.find((option) => option.label === label)
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
  item.options = item.options.filter((option) => option.label !== label)
  if (item.correctAnswer === label) item.correctAnswer = ''
}

function isImportable(item) {
  if (!item.text.trim() || !item.correctAnswer.trim()) return false
  if (item.type === 'multiple_choice') {
    return (
      item.options.filter((option) => option.text.trim() || option.image || option.imageFile).length >= 2
    )
  }
  return true
}

const optionImageInput = ref(null)
const pendingImageTarget = ref({ index: -1, label: '' })

function optionPreview(option) {
  return option.previewUrl || option.image || ''
}

function pickOptionImage(index, label) {
  pendingImageTarget.value = { index, label }
  optionImageInput.value?.click()
}

function onOptionImageSelect(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  const { index, label } = pendingImageTarget.value
  const option = items.value[index]?.options.find((item) => item.label === label)
  if (!option || !file) return

  if (!file.type.startsWith('image/')) {
    parseError.value = 'File harus berupa gambar (JPG, PNG, atau WebP).'
    return
  }
  if (file.size > QUESTION_IMAGE_MAX_BYTES) {
    parseError.value = 'Ukuran gambar maksimal 5 MB.'
    return
  }

  if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
  option.imageFile = file
  option.previewUrl = URL.createObjectURL(file)
}

function removeOptionImage(index, label) {
  const option = items.value[index]?.options.find((item) => item.label === label)
  if (!option) return
  if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
  option.imageFile = null
  option.previewUrl = ''
}

function onTypeChange(item) {
  if (item.type === 'short_answer' && /^[A-E]$/.test(item.correctAnswer.trim())) {
    item.correctAnswer = ''
  }
}

async function runImport() {
  const queue = items.value.filter((item) => item.selected && isImportable(item))
  if (queue.length === 0) return

  isImporting.value = true
  let imported = 0
  const uploadedThisRun = []
  try {
    for (const item of queue) {
      if (item.type === 'multiple_choice') {
        for (const option of item.options) {
          if (option.imageFile) {
            const url = await uploadQuestionImage(option.imageFile)
            uploadedThisRun.push(url)
            option.image = url
            option.imageFile = null
            if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
            option.previewUrl = ''
          }
        }
      }

      await addQuestion({
        subject: props.subject,
        type: item.type,
        question_text: item.text,
        options: item.type === 'multiple_choice' ? item.options : null,
        correct_answer: item.correctAnswer,
        image_url: null,
        time_limit: item.timeLimit,
      })
      imported += 1
    }
    emit('imported', imported)
    emit('close')
  } catch (err) {
    uploadedThisRun.forEach((url) => deleteQuestionImage(url))
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
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
        @click.self="!isImporting && emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
          tabindex="-1"
          class="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 focus:outline-none"
        >
          <!-- Header Minimalis -->
          <div class="flex items-center justify-between border-b border-slate-100 px-7 py-5">
            <div class="flex items-center gap-4 min-w-0">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileText :size="24" />
              </div>
              <div class="min-w-0">
                <h2 id="import-title" class="text-lg font-bold text-slate-900">Import Soal Word</h2>
                <p class="truncate text-sm font-semibold text-slate-500">
                  Materi: <span class="text-slate-800">{{ subject || 'Umum' }}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup"
              :disabled="isImporting"
              @click="emit('close')"
            >
              <X :size="20" />
            </button>
          </div>

          <!-- Body Container -->
          <div class="flex-1 overflow-y-auto p-7 space-y-6">
            <!-- Dropzone Area Minimalis -->
            <div
              class="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 text-center transition hover:border-slate-300 hover:bg-slate-50"
              :class="{ 'pointer-events-none opacity-60': isParsing }"
            >
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-600/10 transition group-hover:scale-110">
                <FileText :size="28" />
              </div>

              <p class="mt-4 text-base font-bold text-slate-800">
                {{ fileName ? fileName : 'Pilih file Word (.docx)' }}
              </p>
              <p class="mt-1 text-sm font-medium text-slate-500">
                Format yang didukung: Berkas Microsoft Word (.docx)
              </p>
              <p class="mt-2 max-w-md text-xs font-semibold text-slate-400">
                Catatan: format soal wajib menggunakan pilihan A, B, C dan menyertakan kunci jawaban di bawahnya.
              </p>

              <label class="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 active:scale-95">
                <FileUp :size="18" />
                <span>{{ isParsing ? 'Membaca File...' : 'Pilih File Soal (.docx)' }}</span>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  class="hidden"
                  :disabled="isParsing"
                  @change="onFileChange"
                />
              </label>
            </div>

            <!-- Pesan Error -->
            <div v-if="parseError" class="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-600">
              {{ parseError }}
            </div>

            <!-- List Pratinjau Soal -->
            <div v-if="items.length > 0" class="space-y-4 pt-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-sm font-extrabold tracking-wide text-slate-500 uppercase">
                  Pratinjau Soal ({{ selectedCount }}/{{ items.length }} dipilih)
                </span>
              </div>

              <div class="space-y-4">
                <div
                  v-for="(item, index) in items"
                  :key="index"
                  class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition"
                  :class="item.selected ? 'ring-2 ring-purple-500/10 border-slate-300' : 'opacity-50 bg-slate-50/50'"
                >
                  <div class="flex items-start gap-4">
                    <input
                      v-model="item.selected"
                      type="checkbox"
                      class="mt-1.5 h-5 w-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />

                    <div class="min-w-0 flex-1 space-y-4">
                      <!-- Baris Atas: Badges & Tipe Soal -->
                      <div class="flex flex-wrap items-center gap-3">
                        <span class="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-extrabold text-slate-800">
                          Soal Nomor {{ index + 1 }}
                        </span>

                        <select
                          v-model="item.type"
                          class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-purple-500 focus:bg-white focus:outline-none"
                          @change="onTypeChange(item)"
                        >
                          <option value="multiple_choice">Pilihan Ganda</option>
                          <option value="short_answer">Isian Singkat</option>
                        </select>

                        <span
                          class="rounded-xl px-3 py-1.5 text-sm font-bold"
                          :class="isImportable(item) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                        >
                          {{ isImportable(item) ? `Kunci Jawaban: ${item.correctAnswer}` : 'Perlu Dilengkapi' }}
                        </span>
                      </div>

                      <!-- Input Teks Soal (Ukuran Teks Lebih Besar) -->
                      <div class="space-y-2">
                        <textarea
                          v-model="item.text"
                          rows="3"
                          class="w-full rounded-2xl border border-slate-300 bg-slate-50/50 p-4 text-base font-medium leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                          placeholder="Tuliskan pertanyaan..."
                        />
                        <!-- Render Tampilan Rumus / MathText -->
                        <div v-if="item.text" class="rounded-xl bg-blue-50/60 p-3.5 text-base font-medium text-slate-800 border border-blue-100">
                          <span class="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">Tampilan Soal:</span>
                          <MathText :text="item.text" />
                        </div>
                      </div>

                      <!-- Pilihan Jawaban (Jika Pilihan Ganda) -->
                      <div v-if="item.type === 'multiple_choice'" class="space-y-2.5 pt-1">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pilihan Jawaban:</span>
                        <div
                          v-for="option in item.options"
                          :key="option.label"
                          class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5"
                        >
                          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-800 shadow-sm border border-slate-200">
                            {{ option.label }}
                          </span>
                          <input
                            v-model="option.text"
                            type="text"
                            class="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-slate-800 focus:outline-none"
                            placeholder="Teks pilihan jawaban..."
                          />

                          <!-- Action Option Gambar & Hapus -->
                          <button
                            type="button"
                            class="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition border border-transparent hover:border-slate-200"
                            :title="`Tambah gambar pilihan ${option.label}`"
                            @click="pickOptionImage(index, option.label)"
                          >
                            <ImagePlus :size="18" />
                          </button>
                          <button
                            type="button"
                            class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-30"
                            :disabled="item.options.length <= 2"
                            :title="`Hapus pilihan ${option.label}`"
                            @click="removePreviewOption(index, option.label)"
                          >
                            <X :size="18" />
                          </button>
                        </div>

                        <!-- Preview Gambar Pilihan jika ada -->
                        <div v-for="option in item.options" :key="`img-${option.label}`">
                          <div v-if="optionPreview(option)" class="mt-2 flex items-center gap-3 px-1">
                            <img
                              :src="optionPreview(option)"
                              :alt="`Gambar pilihan ${option.label}`"
                              class="h-16 w-auto rounded-xl border border-slate-200 object-contain bg-white p-1"
                            />
                            <button
                              type="button"
                              class="text-xs font-bold text-red-600 hover:underline"
                              @click="removeOptionImage(index, option.label)"
                            >
                              Hapus Gambar ({{ option.label }})
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Setting Kunci & Waktu -->
                      <div class="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
                        <div class="flex items-center gap-3">
                          <label class="text-sm font-extrabold text-slate-700" :for="`key-${index}`">Kunci Jawaban:</label>
                          <select
                            v-if="item.type === 'multiple_choice'"
                            :id="`key-${index}`"
                            v-model="item.correctAnswer"
                            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
                          >
                            <option value="" disabled>Pilih Kunci...</option>
                            <option v-for="label in optionLabels(item)" :key="label" :value="label">Pilihan {{ label }}</option>
                          </select>
                          <input
                            v-else
                            :id="`key-${index}`"
                            v-model="item.correctAnswer"
                            type="text"
                            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
                            placeholder="Tuliskan kunci jawaban..."
                          />
                        </div>

                        <div class="flex items-center gap-3">
                          <label class="text-sm font-extrabold text-slate-700" :for="`time-${index}`">Batas Waktu (detik):</label>
                          <input
                            :id="`time-${index}`"
                            v-model="item.timeLimit"
                            type="number"
                            min="0"
                            max="600"
                            class="w-24 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
                            placeholder="Global"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- Tombol Hapus Soal -->
                    <button
                      type="button"
                      class="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Hapus Soal Ini"
                      @click="removeItem(index)"
                    >
                      <Trash2 :size="20" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Single Hidden File Input for Option Images -->
              <input
                ref="optionImageInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onOptionImageSelect"
              />
            </div>
          </div>

          <!-- Footer Aksi Utama -->
          <div class="flex items-center justify-end gap-3 border-t border-slate-100 px-7 py-5">
            <button
              type="button"
              class="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              :disabled="isImporting"
              @click="emit('close')"
            >
              Batal
            </button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-purple-600/20 transition hover:bg-purple-700 active:scale-95 disabled:opacity-50"
              :disabled="selectedCount === 0 || isImporting"
              @click="runImport"
            >
              <Sparkles :size="18" v-if="!isImporting" />
              <span>{{ isImporting ? 'Menyimpan Soal...' : `Import ${selectedCount} Soal` }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>