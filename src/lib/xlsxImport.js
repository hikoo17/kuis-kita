import JSZip from 'jszip'

const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

/**
 * Baca file .xlsx (Excel) langsung di browser dan kembalikan baris sebagai
 * array sel. Hanya sheet pertama yang dibaca; file tidak diunggah ke mana pun.
 *
 * @param {File|Blob} file
 * @returns {Promise<string[][]>}
 */
export async function extractXlsxRows(file) {
  const zip = await JSZip.loadAsync(file)
  const sheetPath = await findFirstSheetPath(zip)
  if (!sheetPath) throw new Error('File Excel tidak memiliki sheet yang bisa dibaca.')

  const sheetXml = await zip.file(sheetPath).async('string')
  const sharedStrings = await readSharedStrings(zip)

  const doc = new DOMParser().parseFromString(sheetXml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Isi file Excel tidak bisa dibaca.')
  }

  const rows = []
  for (const rowNode of Array.from(doc.getElementsByTagNameNS(SS_NS, 'row'))) {
    const cells = []
    for (const cell of Array.from(rowNode.getElementsByTagNameNS(SS_NS, 'c'))) {
      cells[columnIndex(cell.getAttribute('r'))] = readCell(cell, sharedStrings)
    }
    rows.push(cells.map((value) => value ?? ''))
  }
  return rows
}

/** Ubah referensi sel "B3" menjadi indeks kolom (mulai 0). */
function columnIndex(ref) {
  const letters = String(ref ?? '').replace(/[^A-Za-z]/g, '').toUpperCase()
  let index = 0
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64)
  return Math.max(0, index - 1)
}

function readCell(cell, sharedStrings) {
  const type = cell.getAttribute('t')

  if (type === 'inlineStr') {
    return textOf(cell.getElementsByTagNameNS(SS_NS, 'is')[0])
  }

  const valueNode = cell.getElementsByTagNameNS(SS_NS, 'v')[0]
  const raw = valueNode ? valueNode.textContent : ''

  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE'
  return raw
}

function textOf(node) {
  if (!node) return ''
  return Array.from(node.getElementsByTagNameNS(SS_NS, 't'))
    .map((t) => t.textContent ?? '')
    .join('')
}

async function readSharedStrings(zip) {
  const entry = zip.file('xl/sharedStrings.xml')
  if (!entry) return []

  const xml = await entry.async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagNameNS(SS_NS, 'si')).map((si) => textOf(si))
}

/** Cari path sheet pertama lewat workbook.xml + rels (fallback: sheet*.xml). */
async function findFirstSheetPath(zip) {
  const fallback = Object.keys(zip.files).find((path) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(path),
  )
  const workbookEntry = zip.file('xl/workbook.xml')
  const relsEntry = zip.file('xl/_rels/workbook.xml.rels')
  if (!workbookEntry || !relsEntry) return fallback ?? null

  const workbookDoc = new DOMParser().parseFromString(
    await workbookEntry.async('string'),
    'application/xml',
  )
  const firstSheet = workbookDoc.getElementsByTagNameNS(SS_NS, 'sheet')[0]
  const relId = firstSheet?.getAttributeNS(REL_NS, 'id') || firstSheet?.getAttribute('r:id')
  if (!relId) return fallback ?? null

  const relsDoc = new DOMParser().parseFromString(
    await relsEntry.async('string'),
    'application/xml',
  )
  const rel = Array.from(relsDoc.getElementsByTagNameNS(PKG_REL_NS, 'Relationship')).find(
    (node) => node.getAttribute('Id') === relId,
  )
  const target = rel?.getAttribute('Target')
  if (!target) return fallback ?? null

  const normalized = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  return zip.file(normalized) ? normalized : (fallback ?? null)
}
