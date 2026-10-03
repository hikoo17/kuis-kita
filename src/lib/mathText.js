/**
 * Teks soal boleh memuat matematika sederhana:
 *   - $...$        → rumus inline (LaTeX) untuk KaTeX
 *   - $$...$$      → rumus blok (LaTeX)
 *   - [[1, 2], [3, 4]] → jalan pintas matriks (jadi pmatrix)
 * Sisanya teks biasa. Hasilnya dipakai komponen MathText untuk digambar.
 */

// Matriks jalan pintas: [[...]] atau [[...], [...], ...].
const MATRIX_PATTERN = String.raw`\[\[[^[\]]*\](?:\s*,\s*\[[^[\]]*\])*\]`
// Rumus blok, rumus inline, atau matriks jalan pintas (urutannya penting).
const TOKEN_PATTERN = new RegExp(`${MATRIX_PATTERN}|\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+?\\$`, 'g')
const ROW_PATTERN = /\[([^[\]]*)\]/g

/** Amankan karakter khusus LaTeX di dalam sel matriks. */
function escapeCell(value) {
  return String(value ?? '').replace(/([#%&$\\{}])/g, '\\$1')
}

/** [[1, 2], [3, 4]] → \begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix} */
export function matrixToLatex(rows) {
  const body = rows
    .map((row) => row.map((cell) => escapeCell(cell)).join(' & '))
    .join(' \\\\ ')
  return `\\begin{pmatrix}${body}\\end{pmatrix}`
}

function matrixRows(token) {
  return [...token.matchAll(ROW_PATTERN)].map((row) =>
    row[1].split(',').map((cell) => cell.trim()),
  )
}

/**
 * Pecah teks jadi potongan:
 *   { type: 'text', value }
 *   { type: 'math', latex, display }
 */
export function parseMathText(text) {
  const source = String(text ?? '')
  const parts = []
  let lastIndex = 0

  TOKEN_PATTERN.lastIndex = 0
  let match
  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, match.index) })
    }

    const token = match[0]
    if (token.startsWith('[[')) {
      parts.push({ type: 'math', latex: matrixToLatex(matrixRows(token)), display: false })
    } else if (token.startsWith('$$')) {
      parts.push({ type: 'math', latex: token.slice(2, -2).trim(), display: true })
    } else {
      parts.push({ type: 'math', latex: token.slice(1, -1), display: false })
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) })
  }

  return parts
}

/** Untuk pembaca layar: ubah token matematika jadi deskripsi sederhana. */
export function mathTextLabel(text) {
  return parseMathText(text)
    .map((part) => {
      if (part.type === 'text') return part.value
      if (part.latex.includes('matrix')) {
        const cells = [...part.latex.matchAll(/[^\\{}]+/g)]
          .map((m) => m[0].replace(/&/g, ' ').trim())
          .filter((v) => v && !['begin', 'pmatrix', 'end'].includes(v))
        return `matriks ${cells.join(' ')}`
      }
      return part.latex
    })
    .join('')
}
