/**
 * Matriks pada soal ditulis dengan notasi sederhana, contoh: [[1, 2], [3, 4]].
 * Helper di sini memecah teks soal menjadi bagian teks biasa dan bagian matriks
 * supaya komponen tampilan bisa menyusunnya sebagai matriks bertumpuk (bukan
 * deretan angka yang membingungkan siswa).
 */

// Satu atau lebih baris matriks: [[...]] atau [[...], [...], ...].
const MATRIX_PATTERN = /\[\[[^[\]]*\](?:\s*,\s*\[[^[\]]*\])*\]/g

/**
 * Pecah teks menjadi potongan teks dan matriks.
 * Mengembalikan array:
 *   { type: 'text', value: string }
 *   { type: 'matrix', rows: string[][] }
 */
export function parseMatrixText(text) {
  const source = String(text ?? '')
  const parts = []
  let lastIndex = 0

  MATRIX_PATTERN.lastIndex = 0
  let match
  while ((match = MATRIX_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, match.index) })
    }

    const rows = [...match[0].matchAll(/\[([^[\]]*)\]/g)].map((row) =>
      row[1].split(',').map((cell) => cell.trim()),
    )
    parts.push({ type: 'matrix', rows })

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) })
  }

  return parts
}

/** Teks alternatif untuk pembaca layar, contoh: "matriks 2 kali 3: 1, 4, 7; 2, 5, 8". */
export function matrixLabel(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'matriks'
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  const values = rows.map((row) => row.join(', ')).join('; ')
  return `matriks ${rowCount} kali ${columnCount}: ${values}`
}
