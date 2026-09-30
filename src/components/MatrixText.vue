<script setup>
import { computed } from 'vue'
import { matrixLabel, parseMatrixText } from '@/lib/matrixText'

const props = defineProps({
  text: { type: String, default: '' },
})

// Teks soal dipecah jadi bagian teks biasa dan bagian matriks, supaya matriks
// bisa digambar bertumpuk (baris di bawah baris) seperti di buku.
const segments = computed(() => parseMatrixText(props.text))
</script>

<template>
  <span class="matrix-text">
    <template v-for="(part, index) in segments" :key="index">
      <span v-if="part.type === 'text'">{{ part.value }}</span>
      <span v-else class="matrix" role="img" :aria-label="matrixLabel(part.rows)">
        <span class="matrix-bracket matrix-bracket-left" aria-hidden="true"></span>
        <span class="matrix-body">
          <span v-for="(row, rowIndex) in part.rows" :key="rowIndex" class="matrix-row">
            <span v-for="(cell, cellIndex) in row" :key="cellIndex" class="matrix-cell">
              {{ cell }}
            </span>
          </span>
        </span>
        <span class="matrix-bracket matrix-bracket-right" aria-hidden="true"></span>
      </span>
    </template>
  </span>
</template>

<style scoped>
.matrix-text {
  white-space: pre-line;
}

/* Matriks tampil sebagai satu kesatuan sebaris dengan teks di sekitarnya. */
.matrix {
  display: inline-flex;
  align-items: stretch;
  vertical-align: middle;
  margin: 0 0.15em;
}

.matrix-bracket {
  flex: none;
  width: 0.45em;
}

.matrix-bracket-left {
  border-top: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  border-left: 2px solid currentColor;
  border-top-left-radius: 0.2em;
  border-bottom-left-radius: 0.2em;
}

.matrix-bracket-right {
  border-top: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  border-right: 2px solid currentColor;
  border-top-right-radius: 0.2em;
  border-bottom-right-radius: 0.2em;
}

.matrix-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.1em 0.35em;
}

.matrix-row {
  display: flex;
}

.matrix-cell {
  flex: 1 1 auto;
  min-width: 1.5em;
  padding: 0.05em 0.45em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
