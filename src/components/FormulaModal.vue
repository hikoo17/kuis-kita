<script setup>
import { computed, ref, watch } from 'vue'
import { X, Sigma, Divide, Superscript, Radical, Grid2x2 } from '@lucide/vue'
import MathText from '@/components/MathText.vue'
import { useModalFocus } from '@/composables/useModalFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'insert'])

const dialogRef = ref(null)

useModalFocus(
  () => props.open,
  dialogRef,
  () => emit('close'),
)

const TABS = [
  { id: 'matrix', label: 'Matriks', icon: Grid2x2 },
  { id: 'fraction', label: 'Pecahan', icon: Divide },
  { id: 'power', label: 'Pangkat', icon: Superscript },
  { id: 'root', label: 'Akar', icon: Radical },
]
const activeTab = ref('matrix')

// --- Matriks ---
const rows = ref(2)
const cols = ref(2)
const cells = ref([
  ['', ''],
  ['', ''],
])

function resize(newRows, newCols) {
  const next = []
  for (let r = 0; r < newRows; r += 1) {
    const row = []
    for (let c = 0; c < newCols; c += 1) row.push(cells.value[r]?.[c] ?? '')
    next.push(row)
  }
  cells.value = next
}

watch([rows, cols], () => resize(rows.value, cols.value))

const matrixLatex = computed(() => {
  const body = cells.value
    .map((row) => row.map((cell) => (cell.trim() === '' ? ' ' : cell.trim())).join(' & '))
    .join(' \\\\ ')
  return `\\begin{pmatrix}${body}\\end{pmatrix}`
})

// --- Pecahan ---
const numerator = ref('')
const denominator = ref('')
const fractionLatex = computed(() => `\\frac{${numerator.value || 'a'}}{${denominator.value || 'b'}}`)

// --- Pangkat ---
const base = ref('')
const exponent = ref('')
const powerLatex = computed(() => `{${base.value || 'x'}}^{${exponent.value || '2'}}`)

// --- Akar ---
const degree = ref('')
const radicand = ref('')
const rootLatex = computed(() =>
  degree.value.trim() ? `\\sqrt[${degree.value.trim()}]{${radicand.value || 'x'}}` : `\\sqrt{${radicand.value || 'x'}}`,
)

const previewLatex = computed(() => {
  if (activeTab.value === 'matrix') return matrixLatex.value
  if (activeTab.value === 'fraction') return fractionLatex.value
  if (activeTab.value === 'power') return powerLatex.value
  return rootLatex.value
})

function reset() {
  activeTab.value = 'matrix'
  rows.value = 2
  cols.value = 2
  cells.value = [
    ['', ''],
    ['', ''],
  ]
  numerator.value = ''
  denominator.value = ''
  base.value = ''
  exponent.value = ''
  degree.value = ''
  radicand.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function insert() {
  emit('insert', previewLatex.value)
  emit('close')
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
        class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="formula-title"
          tabindex="-1"
          class="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-card-hover focus:outline-none sm:rounded-3xl"
        >
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 id="formula-title" class="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Sigma :size="20" class="text-brand-600" aria-hidden="true" />
              Sisipkan Rumus
            </h2>
            <button type="button" class="icon-btn-neutral" aria-label="Tutup" @click="emit('close')">
              <X :size="18" aria-hidden="true" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-5">
            <!-- Jenis rumus -->
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="tab in TABS"
                :key="tab.id"
                type="button"
                class="flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold transition"
                :class="activeTab === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                @click="activeTab = tab.id"
              >
                <component :is="tab.icon" :size="20" aria-hidden="true" />
                {{ tab.label }}
              </button>
            </div>

            <!-- Pengisi -->
            <div class="mt-5">
              <!-- Matriks -->
              <template v-if="activeTab === 'matrix'">
                <div class="flex items-center gap-4">
                  <label class="flex items-center gap-2 text-sm font-bold text-slate-600">
                    Baris
                    <input v-model.number="rows" type="number" min="1" max="5" class="input w-16 !px-2 !py-1.5 !text-base" />
                  </label>
                  <label class="flex items-center gap-2 text-sm font-bold text-slate-600">
                    Kolom
                    <input v-model.number="cols" type="number" min="1" max="5" class="input w-16 !px-2 !py-1.5 !text-base" />
                  </label>
                </div>
                <div
                  class="mt-3 grid gap-2"
                  :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
                >
                  <input
                    v-for="(cell, index) in cells.flat()"
                    :key="index"
                    :value="cell"
                    :aria-label="`Sel matriks ${index + 1}`"
                    class="input !px-2 !py-2 text-center !text-base"
                    placeholder="0"
                    @input="cells[Math.floor(index / cols)][index % cols] = $event.target.value"
                  />
                </div>
              </template>

              <!-- Pecahan -->
              <template v-else-if="activeTab === 'fraction'">
                <label class="label" for="f-num">Pembilang (atas)</label>
                <input id="f-num" v-model="numerator" type="text" class="input !text-base" placeholder="contoh: x + 1" />
                <label class="label mt-3" for="f-den">Penyebut (bawah)</label>
                <input id="f-den" v-model="denominator" type="text" class="input !text-base" placeholder="contoh: 2" />
              </template>

              <!-- Pangkat -->
              <template v-else-if="activeTab === 'power'">
                <label class="label" for="p-base">Bilangan / variabel</label>
                <input id="p-base" v-model="base" type="text" class="input !text-base" placeholder="contoh: x" />
                <label class="label mt-3" for="p-exp">Pangkat</label>
                <input id="p-exp" v-model="exponent" type="text" class="input !text-base" placeholder="contoh: 2" />
              </template>

              <!-- Akar -->
              <template v-else>
                <label class="label" for="r-deg">Derajat (kosongkan untuk akar kuadrat)</label>
                <input id="r-deg" v-model="degree" type="text" class="input !text-base" placeholder="contoh: 3" />
                <label class="label mt-3" for="r-body">Isi akar</label>
                <input id="r-body" v-model="radicand" type="text" class="input !text-base" placeholder="contoh: x + 1" />
              </template>
            </div>

            <!-- Pratinjau -->
            <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p class="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-400">Pratinjau</p>
              <div class="text-lg text-slate-800">
                <MathText :text="`$${previewLatex}$`" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" class="btn-neutral !px-4 !py-2 !text-base" @click="emit('close')">Batal</button>
            <button type="button" class="btn-primary !px-5 !py-2.5" @click="insert">Sisipkan</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
