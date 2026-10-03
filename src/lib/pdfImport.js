import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { pagesToBlocks } from './pdfText'

// Worker di-serve Vite sebagai aset; tanpa ini pdf.js tidak jalan di browser.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Baca file .pdf dan susun blok teks seperti docxImport:
 *   { type: 'p', text }
 * Rumus di PDF tidak menyimpan struktur, jadi hasilnya berupa teks biasa —
 * guru melengkapinya lewat pratinjau (mis. tombol Sisipkan Rumus).
 */
export async function extractPdfBlocks(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items)
  }

  return pagesToBlocks(pages)
}
