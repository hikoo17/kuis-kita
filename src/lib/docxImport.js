import JSZip from 'jszip'
import { ommlToLatex } from './omml'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/**
 * Baca file .docx dan kembalikan daftar blok berurutan:
 *   { type: 'p',   text }        → satu paragraf (rumus sudah jadi $...$)
 *   { type: 'tbl', rows }        → tabel (dipakai untuk kunci jawaban)
 * Semua proses jalan di browser; file tidak diunggah ke mana pun.
 */
export async function extractDocxBlocks(file) {
  const zip = await JSZip.loadAsync(file)
  const entry = zip.file('word/document.xml')
  if (!entry) throw new Error('File DOCX tidak valid (word/document.xml tidak ditemukan).')

  const xml = await entry.async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Isi dokumen tidak bisa dibaca. Pastikan file .docx yang benar.')
  }

  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0] ?? doc.documentElement
  const blocks = []

  for (const child of Array.from(body.children)) {
    if (child.localName === 'p') {
      const text = paragraphToText(child)
      if (text.trim()) blocks.push({ type: 'p', text })
    } else if (child.localName === 'tbl') {
      blocks.push({ type: 'tbl', rows: tableToRows(child) })
    }
  }

  return blocks
}

/** Susun teks satu paragraf; rumus OMML jadi $latex$ di posisinya. */
function paragraphToText(paragraph) {
  let out = ''

  const walk = (node) => {
    for (const child of Array.from(node.childNodes ?? [])) {
      if (child.nodeType === 3) {
        out += child.nodeValue ?? ''
        continue
      }
      if (child.nodeType !== 1) continue

      const name = child.localName
      if (name === 'oMath' || name === 'oMathPara') {
        const latex = ommlToLatex(child).trim()
        if (latex) {
          if (out && !/\s$/.test(out)) out += ' '
          out += `$${latex}$`
        }
        continue
      }
      if (name === 't') {
        out += child.textContent ?? ''
        continue
      }
      if (name === 'tab') {
        out += ' '
        continue
      }
      if (name === 'br' || name === 'cr') {
        out += '\n'
        continue
      }
      if (name === 'drawing' || name === 'pict') continue
      walk(child)
    }
  }

  walk(paragraph)
  return out.replace(/[ \t]+/g, ' ').trim()
}

function tableToRows(table) {
  const rows = []
  for (const tr of Array.from(table.children)) {
    if (tr.localName !== 'tr') continue
    const cells = []
    for (const tc of Array.from(tr.children)) {
      if (tc.localName !== 'tc') continue
      const text = Array.from(tc.children)
        .filter((child) => child.localName === 'p')
        .map((p) => paragraphToText(p))
        .filter(Boolean)
        .join(' ')
      cells.push(text.trim())
    }
    rows.push(cells)
  }
  return rows
}
