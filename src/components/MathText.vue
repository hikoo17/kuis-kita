<script setup>
import { computed } from 'vue'
import katex from 'katex'
import { parseMathText } from '@/lib/mathText'

const props = defineProps({
  text: { type: String, default: '' },
})

const segments = computed(() => parseMathText(props.text))

/** Render satu rumus jadi HTML KaTeX. Aman: tidak menjalankan kode asing. */
function renderMath(latex, display) {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'html',
    })
  } catch {
    return escapeHtml(latex)
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
</script>

<template>
  <span class="whitespace-pre-line">
    <template v-for="(part, index) in segments" :key="index">
      <span v-if="part.type === 'text'">{{ part.value }}</span>
      <template v-else>
        <span v-if="part.display" class="block my-1"><span v-html="renderMath(part.latex, true)"></span></span>
        <span v-else v-html="renderMath(part.latex, false)"></span>
      </template>
    </template>
  </span>
</template>
