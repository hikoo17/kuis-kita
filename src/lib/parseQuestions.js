/**
 * Ubah daftar blok dokumen (lihat docxImport.js) menjadi soal siap impor.
 * Murni & tanpa DOM supaya mudah diuji.
 *
 * Hasil tiap soal:
 *   { number, text, type, options: [{label, text}], correctAnswer }
 */

const OPTION_RE = /^\s*([A-Ea-e])\s*[.)\]]\s+(.+)$/
const INLINE_KEY_RE = /^\s*(?:jawaban|kunci)\s*[:=]\s*([A-Ea-e])\b/i
const NUMBER_PREFIX_RE = /^\s*(?:soal\s*)?\d+\s*[.)\]]\s*/i
const TAG_PREFIX_RE = /^\s*\[[^\]]*\]\s*/
const BOILERPLATE_RE =
  /^(petunjuk|perhatian|catatan|nama|kelas|mata pelajaran|durasi|waktu|hari|tanggal|no\.?)\b/i

/** Buang nomor soal dan tag topik di awal teks. */
export function normalizeQuestionText(text) {
  return String(text ?? '')
    .replace(NUMBER_PREFIX_RE, '')
    .replace(TAG_PREFIX_RE, '')
    .trim()
}

/** Baris petunjuk/identitas yang bukan bagian dari soal. */
function isBoilerplate(line) {
  if (BOILERPLATE_RE.test(line)) return true
  if (/_{3,}/.test(line)) return true
  return /\b(kunci jawaban|pembahasan)\b/i.test(line)
}

/** Tabel "KUNCI JAWABAN" → { 1: 'B', 2: 'A', ... } */
export function extractAnswerKeys(blocks) {
  const keys = {}
  for (const block of blocks) {
    if (block.type !== 'tbl') continue
    const header = (block.rows[0] ?? []).map((cell) => String(cell).toLowerCase())
    const hasKey = header.some((cell) => cell.includes('kunci'))
    if (!hasKey) continue

    for (const row of block.rows.slice(1)) {
      const number = parseInt(row[0], 10)
      const key = String(row[1] ?? '').trim().toUpperCase()
      if (Number.isFinite(number) && /^[A-E]$/.test(key)) keys[number] = key
    }
  }
  return keys
}

/** Gabungkan paragraf + kunci menjadi daftar soal. */
export function parseQuestions(blocks) {
  const paragraphs = blocks.filter((block) => block.type === 'p').map((block) => block.text)
  const keys = extractAnswerKeys(blocks)
  const raw = []

  let current = null
  const finalize = () => {
    if (current && (current.text || current.options.length > 0)) raw.push(current)
    current = null
  }

  for (const value of paragraphs) {
    const line = String(value ?? '').trim()
    if (!line || isBoilerplate(line)) continue

    const option = line.match(OPTION_RE)
    if (option && current) {
      current.options.push({ label: option[1].toUpperCase(), text: option[2].trim() })
      continue
    }

    const inlineKey = line.match(INLINE_KEY_RE)
    if (inlineKey && current) {
      current.correctAnswer = inlineKey[1].toUpperCase()
      continue
    }

    // Paragraf isi baru → soal sebelumnya sudah selesai.
    if (current && current.options.length > 0) finalize()
    if (!current) current = { text: '', options: [], correctAnswer: '' }

    const clean = normalizeQuestionText(line)
    current.text = current.text ? `${current.text} ${clean}` : clean
  }
  finalize()

  return raw
    .filter((item) => item.text)
    .map((item, index) => {
      const type = item.options.length >= 2 ? 'multiple_choice' : 'short_answer'
      const correctAnswer = item.correctAnswer || keys[index + 1] || ''
      return {
        number: index + 1,
        text: item.text,
        type,
        options: type === 'multiple_choice' ? item.options : [],
        correctAnswer,
      }
    })
}
