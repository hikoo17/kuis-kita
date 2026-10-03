/**
 * Susun potongan teks hasil pdf.js menjadi baris yang enak dibaca.
 * Murni (tanpa DOM) supaya bisa diuji; pdfImport.js yang memanggilnya.
 */

/** items: [{ str, transform: [ , , , , x, y ], width }] → string[] terurut. */
export function groupIntoLines(items) {
  const rows = new Map() // Y dibulatkan → daftar potongan

  for (const item of items) {
    if (!item.str || !item.transform) continue
    const y = item.transform[5]
    const x = item.transform[4]

    let key = null
    for (const existing of rows.keys()) {
      if (Math.abs(existing - y) <= 3) {
        key = existing
        break
      }
    }
    if (key === null) {
      key = y
      rows.set(key, [])
    }
    rows.get(key).push({ x, width: item.width ?? 0, str: item.str })
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // koordinat Y membesar ke atas
    .map(([, parts]) => joinParts(parts))
    .filter((line) => line.trim())
}

/** Gabung potongan satu baris; sisipkan spasi saat ada celah antar potongan. */
export function joinParts(parts) {
  const ordered = [...parts].sort((a, b) => a.x - b.x)
  let line = ''
  let previousEnd = null

  for (const part of ordered) {
    if (previousEnd !== null && part.x - previousEnd > 1.2) line += ' '
    line += part.str
    previousEnd = part.x + part.width
  }

  return line.replace(/\s+/g, ' ').trim()
}

/** Ubah potongan per halaman menjadi blok { type:'p', text }. */
export function pagesToBlocks(pages) {
  const blocks = []
  for (const pageItems of pages) {
    for (const line of groupIntoLines(pageItems)) {
      if (line) blocks.push({ type: 'p', text: line })
    }
  }
  return blocks
}
