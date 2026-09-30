import { describe, it, expect } from 'vitest'
import { matrixLabel, parseMatrixText } from '@/lib/matrixText'

describe('parseMatrixText', () => {
  it('memisahkan teks dan matriks', () => {
    const parts = parseMatrixText('Diketahui matriks P = [[1, 4, 7], [2, 5, 8]], maka ordo ...')

    expect(parts).toEqual([
      { type: 'text', value: 'Diketahui matriks P = ' },
      {
        type: 'matrix',
        rows: [
          ['1', '4', '7'],
          ['2', '5', '8'],
        ],
      },
      { type: 'text', value: ', maka ordo ...' },
    ])
  })

  it('mengembalikan satu potongan teks bila tidak ada matriks', () => {
    expect(parseMatrixText('Matriks kolom adalah matriks dengan satu kolom.')).toEqual([
      { type: 'text', value: 'Matriks kolom adalah matriks dengan satu kolom.' },
    ])
  })

  it('mendukung beberapa matriks dalam satu soal', () => {
    const parts = parseMatrixText('A = [[1, 2]] dan B = [[3, 4]]')
    const matrices = parts.filter((part) => part.type === 'matrix')

    expect(matrices).toHaveLength(2)
    expect(matrices[0].rows).toEqual([['1', '2']])
    expect(matrices[1].rows).toEqual([['3', '4']])
  })

  it('tidak menganggap tag topik berkurung satu sebagai matriks', () => {
    expect(parseMatrixText('[Pengertian Matriks] P = [[1, 2]]')).toEqual([
      { type: 'text', value: '[Pengertian Matriks] P = ' },
      { type: 'matrix', rows: [['1', '2']] },
    ])
  })

  it('menangani teks kosong', () => {
    expect(parseMatrixText('')).toEqual([])
    expect(parseMatrixText(null)).toEqual([])
  })
})

describe('matrixLabel', () => {
  it('menyusun label dengan ukuran dan nilai', () => {
    expect(
      matrixLabel([
        ['1', '4', '7'],
        ['2', '5', '8'],
      ]),
    ).toBe('matriks 2 kali 3: 1, 4, 7; 2, 5, 8')
  })

  it('mengembalikan label aman untuk matriks kosong', () => {
    expect(matrixLabel([])).toBe('matriks')
  })
})
