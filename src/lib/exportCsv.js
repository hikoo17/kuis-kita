/**
 * Ekspor CSV yang ramah Excel.
 * - Menyertakan BOM UTF-8 supaya huruf beraksen tampil benar.
 * - Memakai pemisah ';' karena Excel berlokal Indonesia memakainya.
 * - Sel yang mengandung kutip/pemisah/baris baru dibungkus tanda kutip.
 */

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nama berkas dengan tanggal hari ini: riwayat-kuis-2026-09-30.csv */
export function datedFilename(prefix) {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  return `${prefix}-${stamp}.csv`
}
