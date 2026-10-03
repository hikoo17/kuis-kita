import { describe, it, expect } from 'vitest'
import { extractAnswerKeys, parseQuestions } from '@/lib/parseQuestions'

const blocks = [
  { type: 'p', text: 'PETUNJUK: Pilihlah satu jawaban yang paling tepat!' },
  { type: 'p', text: '[Pengertian Matriks] Susunan bilangan dalam baris dan kolom disebut ...' },
  { type: 'p', text: 'A. Vektor' },
  { type: 'p', text: 'B. Matriks' },
  { type: 'p', text: 'C. Determinan' },
  { type: 'p', text: 'D. Skalar' },
  { type: 'p', text: '2. Ordo matriks $P$ adalah ...' },
  { type: 'p', text: 'A. 3 x 2' },
  { type: 'p', text: 'B. 2 x 3' },
  {
    type: 'tbl',
    rows: [
      ['No.', 'Kunci', 'Pembahasan'],
      ['1', 'B', 'Pengertian matriks.'],
      ['2', 'B', '2 baris 3 kolom.'],
    ],
  },
]

describe('extractAnswerKeys', () => {
  it('membaca tabel kunci jawaban', () => {
    expect(extractAnswerKeys(blocks)).toEqual({ 1: 'B', 2: 'B' })
  })
})

describe('parseQuestions', () => {
  const questions = parseQuestions(blocks)

  it('menghasilkan dua soal', () => {
    expect(questions).toHaveLength(2)
  })

  it('membuang petunjuk, nomor, dan tag topik', () => {
    expect(questions[0].text).toBe('Susunan bilangan dalam baris dan kolom disebut ...')
    expect(questions[1].text).toBe('Ordo matriks $P$ adalah ...')
  })

  it('mendeteksi pilihan ganda beserta jumlah pilihan', () => {
    expect(questions[0].type).toBe('multiple_choice')
    expect(questions[0].options).toEqual([
      { label: 'A', text: 'Vektor' },
      { label: 'B', text: 'Matriks' },
      { label: 'C', text: 'Determinan' },
      { label: 'D', text: 'Skalar' },
    ])
  })

  it('memasangkan kunci dari tabel sesuai urutan', () => {
    expect(questions[0].correctAnswer).toBe('B')
    expect(questions[1].correctAnswer).toBe('B')
  })

  it('mendukung kunci inline dan isian singkat', () => {
    const mixed = parseQuestions([
      { type: 'p', text: '1. Ibu kota Indonesia adalah ...' },
      { type: 'p', text: 'A. Bandung' },
      { type: 'p', text: 'B. Jakarta' },
      { type: 'p', text: 'Jawaban: B' },
      { type: 'p', text: '2. Hasil dari 3 + 4 adalah ...' },
    ])
    expect(mixed[0].correctAnswer).toBe('B')
    expect(mixed[1].type).toBe('short_answer')
    expect(mixed[1].options).toEqual([])
  })

  it('membuang judul kapital dan membaca kunci dari bagian KUNCI JAWABAN', () => {
    const pdfLike = parseQuestions([
      { type: 'p', text: 'UJI PEMAHAMAN MATEMATIKA: MATRIKS' },
      { type: 'p', text: '1. Susunan bilangan dalam baris dan kolom disebut ...' },
      { type: 'p', text: 'A. Vektor' },
      { type: 'p', text: 'B. Matriks' },
      { type: 'p', text: 'KUNCI JAWABAN' },
      { type: 'p', text: '1. B' },
      { type: 'p', text: '2. A' },
    ])
    expect(pdfLike).toHaveLength(1)
    expect(pdfLike[0].text).toBe('Susunan bilangan dalam baris dan kolom disebut ...')
    expect(pdfLike[0].correctAnswer).toBe('B')
  })
})
