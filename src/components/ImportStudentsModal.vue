<script setup>
import { computed, ref, watch } from 'vue'
import { Download, FileSpreadsheet, FileUp, Sparkles, Trash2, Users, X } from '@lucide/vue'
import { buildStudentTemplate, parseStudentRows, parseStudentText } from '@/lib/parseStudents'
import { extractXlsxRows } from '@/lib/xlsxImport'
import { downloadCsv } from '@/lib/exportCsv'
import { useStudents } from '@/composables/useStudents'
import { useModalFocus } from '@/composables/useModalFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
  classes: { type: Array, default: () => [] },
  defaultClassId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'imported'])

const { addStudent } = useStudents()

const dialogRef = ref(null)
const fileInput = ref(null)
const entries = ref([])
const duplicates = ref(0)
const skipped = ref(0)
const targetClassId = ref('')
const parseError = ref('')
const isParsing = ref(false)
const isImporting = ref(false)

useModalFocus(
  () => props.open,
  dialogRef,
  () => {
    if (!isImporting.value) emit('close')
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

function reset() {
  entries.value = []
  duplicates.value = 0
  skipped.value = 0
  parseError.value = ''
  isImporting.value = false
  targetClassId.value = props.defaultClassId || props.classes[0]?.id || ''
  if (fileInput.value) fileInput.value.value = ''
}

function applyParsed(parsed) {
  entries.value = parsed.entries.map((entry, index) => ({
    id: index,
    name: entry.name,
    className: entry.className,
    selected: true,
  }))
  duplicates.value = parsed.duplicates
  skipped.value = parsed.skipped
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  parseError.value = ''
  entries.value = []
  isParsing.value = true
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const rows = await extractXlsxRows(file)
      applyParsed(parseStudentRows(rows))
    } else {
      const text = await file.text()
      applyParsed(parseStudentText(text))
    }
    if (entries.value.length === 0) {
      parseError.value = 'Tidak ada nama siswa yang terbaca dari file ini.'
    }
  } catch (err) {
    parseError.value = err.message || 'Gagal membaca file. Gunakan format .csv atau .xlsx.'
  } finally {
    isParsing.value = false
  }
}

function removeEntry(index) {
  entries.value.splice(index, 1)
}

function classIdFor(entry) {
  const wanted = String(entry.className ?? '').trim().toLowerCase()
  if (wanted) {
    const match = props.classes.find((item) => item.name.trim().toLowerCase() === wanted)
    if (match) return match.id
  }
  return targetClassId.value
}

function classNameFor(entry) {
  const id = classIdFor(entry)
  return props.classes.find((item) => item.id === id)?.name ?? '—'
}

function downloadTemplate() {
  const classA = props.classes[0]?.name ?? 'X-1'
  const classB = props.classes[1]?.name ?? 'XI IPA 2'
  downloadCsv('template-import-siswa.csv', buildStudentTemplate(classA, classB))
}

const selectedCount = computed(() => entries.value.filter((entry) => entry.selected).length)

async function runImport() {
  const queue = entries.value.filter((entry) => entry.selected)
  if (queue.length === 0) return

  if (queue.every((entry) => !classIdFor(entry))) {
    parseError.value = 'Pilih kelas tujuan dulu.'
    return
  }

  isImporting.value = true
  parseError.value = ''
  let count = 0
  const failures = []

  for (const entry of queue) {
    const classId = classIdFor(entry)
    if (!classId) {
      failures.push({ name: entry.name, reason: 'Kelas tujuan belum dipilih.' })
      continue
    }
    try {
      await addStudent(entry.name, classId)
      count += 1
    } catch (err) {
      failures.push({ name: entry.name, reason: err.message || 'Gagal disimpan.' })
    }
  }

  isImporting.value = false
  emit('imported', { count, failures })
  emit('close')
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md"
        @click.self="!isImporting && emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-students-title"
          tabindex="-1"
          class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 focus:outline-none"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-100 px-7 py-5">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <FileSpreadsheet :size="24" />
              </div>
              <h2 id="import-students-title" class="text-xl font-extrabold text-slate-900 sm:text-2xl">
                Import Siswa
              </h2>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup"
              :disabled="isImporting"
              @click="emit('close')"
            >
              <X :size="22" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 space-y-6 overflow-y-auto p-7">
            <!-- Selector Kelas & Template Button -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div class="flex-1">
                <select
                  id="import-target-class"
                  v-model="targetClassId"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base font-semibold text-slate-800 transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="" disabled>Pilih Kelas Tujuan Default...</option>
                  <option v-for="item in classes" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <!-- Button Template -->
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 shrink-0"
                @click="downloadTemplate"
              >
                <Download :size="18" class="text-slate-500" />
                <span>Unduh Template</span>
              </button>
            </div>

            <!-- Unggah Berkas -->
            <div class="space-y-3">
              <div
                class="group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center transition hover:border-slate-300 hover:bg-slate-50"
                :class="{ 'pointer-events-none opacity-60': isParsing }"
              >
                <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-600/10 transition group-hover:scale-110">
                  <FileSpreadsheet :size="28" />
                </div>

                <p class="mt-4 text-base font-bold text-slate-800">
                  {{ isParsing ? 'Membaca berkas...' : 'Seret & lepas berkas ke sini' }}
                </p>
                <p class="mt-1 text-sm font-medium text-slate-400">Format didukung: .csv, .xlsx</p>
                <p class="mt-2 max-w-md text-xs font-semibold text-slate-400">
                  Catatan: wajib ada kolom Nama. Kolom Kelas opsional (otomatis disesuaikan dengan pilihan kelas di atas).
                </p>

                <!-- Tombol Pilih File -->
                <label
                  class="mt-5 inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
                >
                  <FileUp :size="18" />
                  <span>Pilih File</span>
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    class="hidden"
                    :disabled="isParsing"
                    @change="onFileChange"
                  />
                </label>
              </div>
            </div>

            <!-- Pesan Error -->
            <div v-if="parseError" class="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">
              {{ parseError }}
            </div>

            <!-- Preview List -->
            <div v-if="entries.length > 0" class="space-y-3 pt-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-xs font-extrabold tracking-wider text-slate-400 uppercase">
                  Pratinjau ({{ selectedCount }}/{{ entries.length }})
                </span>
                <div class="flex gap-2">
                  <span v-if="duplicates > 0" class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-600/20">
                    {{ duplicates }} Duplikat
                  </span>
                  <span v-if="skipped > 0" class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {{ skipped }} Kosong
                  </span>
                </div>
              </div>

              <div class="max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2 space-y-2">
                <div
                  v-for="(entry, index) in entries"
                  :key="entry.id"
                  class="flex items-center gap-3.5 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5 transition"
                  :class="entry.selected ? '' : 'opacity-40'"
                >
                  <input
                    v-model="entry.selected"
                    type="checkbox"
                    class="h-5 w-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <Users :size="18" class="shrink-0 text-slate-400" />
                  <span class="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{{ entry.name }}</span>
                  <span class="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">
                    {{ classNameFor(entry) }}
                  </span>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                    @click="removeEntry(index)"
                  >
                    <Trash2 :size="18" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 border-t border-slate-100 px-7 py-5">
            <button
              type="button"
              class="rounded-2xl px-5 py-3 text-base font-bold text-slate-600 transition hover:bg-slate-100"
              :disabled="isImporting"
              @click="emit('close')"
            >
              Batal
            </button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-2xl bg-purple-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-purple-600/20 transition hover:bg-purple-700 active:scale-95 disabled:opacity-50"
              :disabled="selectedCount === 0 || isImporting"
              @click="runImport"
            >
              <Sparkles :size="18" v-if="!isImporting" />
              <span>{{ isImporting ? 'Menyimpan...' : `Import ${selectedCount} Siswa` }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>