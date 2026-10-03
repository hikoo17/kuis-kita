/**
 * Susun daftar siswa dari teks tempelan (mis. hasil salin dari Excel) atau isi
 * file CSV. Fungsi ini murni (tanpa DOM) supaya mudah diuji.
 *
 * Format yang didukung:
 * - Satu kolom  : satu nama per baris.
 * - Dua kolom   : Nama, Kelas (kelas opsional).
 * - Tiga kolom  : No, Nama, Kelas (kolom nomor diabaikan).
 * Pemisah dideteksi otomatis: Tab (tempelan Excel), ';', atau ','.
 */

const HEADER_CELL = /^(no\.?|nomor|nama(\s+siswa)?|siswa|student|name|kelas|class)$/i

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? ''
  if (firstLine.includes('\t')) return '\t'
  if (firstLine.includes(';')) return ';'
  return ','
}

/** Pecah satu baris CSV dengan menghormati tanda kutip ganda. */
function splitLine(line, delimiter) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

/** Baris judul (mis. "Nama; Kelas") tidak dianggap sebagai siswa. */
function isHeaderRow(cells) {
  const filled = cells.filter((cell) => cell !== '')
  return filled.length > 0 && filled.every((cell) => HEADER_CELL.test(cell))
}

/** Buang nomor urut di awal nama, mis. "1. Ahmad" atau "2) Budi". */
function cleanName(value) {
  return String(value ?? '')
    .replace(/^\d+\s*[.)]\s*/, '')
    .trim()
}

/**
 * @param {Array<Array<string|number>>} rows
 * @returns {{ entries: Array<{name: string, className: string}>, duplicates: number, skipped: number }}
 */
export function parseStudentRows(rows) {
  const entries = []
  const seen = new Set()
  let duplicates = 0
  let skipped = 0
  let isFirstContentRow = true

  ;(rows ?? []).forEach((rawCells) => {
    const cells = (rawCells ?? []).map((cell) => String(cell ?? '').trim())
    if (cells.every((cell) => cell === '')) return

    if (isFirstContentRow) {
      isFirstContentRow = false
      if (isHeaderRow(cells)) return
    }

    let filled = cells.filter((cell) => cell !== '')
    // Kolom nomor urut (mis. "1; Ahmad; X-1") diabaikan.
    if (filled.length >= 2 && /^\d+$/.test(filled[0])) filled = filled.slice(1)

    const name = cleanName(filled[0] ?? '')
    const className = (filled[1] ?? '').trim()

    if (!name) {
      skipped += 1
      return
    }

    const key = name.toLowerCase()
    if (seen.has(key)) {
      duplicates += 1
      return
    }
    seen.add(key)
    entries.push({ name, className })
  })

  return { entries, duplicates, skipped }
}

/**
 * Baris template CSV untuk diunduh guru: judul kolom + dua contoh baris.
 * Dipisah sebagai fungsi murni supaya formatnya mudah diuji.
 *
 * @param {string} [classA]
 * @param {string} [classB]
 * @returns {string[][]}
 */
export function buildStudentTemplate(classA = 'X-1', classB = 'XI IPA 2') {
  return [
    ['Nama', 'Kelas'],
    ['Ahmad Fauzi', classA],
    ['Budi Santoso', classB],
  ]
}

/**
 * @param {string} text
 * @returns {{ entries: Array<{name: string, className: string}>, duplicates: number, skipped: number }}
 */
export function parseStudentText(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '')
  if (!source.trim()) return { entries: [], duplicates: 0, skipped: 0 }

  const delimiter = detectDelimiter(source)
  const rows = source.split(/\r?\n/).map((line) => (line.trim() ? splitLine(line, delimiter) : ['']))
  return parseStudentRows(rows)
}
