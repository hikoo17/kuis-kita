import { describe, it, expect } from 'vitest'
import { matrixToLatex, parseMathText } from '@/lib/mathText'

describe('matrixToLatex', () => {
  it('menyusun pmatrix dari baris', () => {
    expect(
      matrixToLatex([
        ['1', '4', '7'],
        ['2', '5', '8'],
      ]),
    ).toBe('\\begin{pmatrix}1 & 4 & 7 \\\\ 2 & 5 & 8\\end{pmatrix}')
  })

  it('mengamankan karakter khusus LaTeX', () => {
    expect(matrixToLatex([['a&b', '50%']])).toBe(
      '\\begin{pmatrix}a\\&b & 50\\%\\end{pmatrix}',
    )
  })
})

describe('parseMathText', () => {
  it('memisahkan teks dan matriks jalan pintas', () => {
    expect(parseMathText('P = [[1, 4], [2, 5]], maka ...')).toEqual([
      { type: 'text', value: 'P = ' },
      { type: 'math', latex: '\\begin{pmatrix}1 & 4 \\\\ 2 & 5\\end{pmatrix}', display: false },
      { type: 'text', value: ', maka ...' },
    ])
  })

  it('mengenali rumus inline dan blok', () => {
    const parts = parseMathText('Nilai $x^2$ dan $$\\frac{a}{b}$$ selesai')
    expect(parts).toEqual([
      { type: 'text', value: 'Nilai ' },
      { type: 'math', latex: 'x^2', display: false },
      { type: 'text', value: ' dan ' },
      { type: 'math', latex: '\\frac{a}{b}', display: true },
      { type: 'text', value: ' selesai' },
    ])
  })

  it('mengembalikan teks biasa apa adanya', () => {
    expect(parseMathText('Matriks kolom adalah ...')).toEqual([
      { type: 'text', value: 'Matriks kolom adalah ...' },
    ])
  })

  it('aman untuk teks kosong', () => {
    expect(parseMathText('')).toEqual([])
    expect(parseMathText(null)).toEqual([])
  })
})
