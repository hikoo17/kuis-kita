import { describe, it, expect } from 'vitest'
import { groupIntoLines, joinParts, pagesToBlocks } from '@/lib/pdfText'

const item = (str, x, y, width = str.length * 6) => ({ str, width, transform: [1, 0, 0, 1, x, y] })

describe('groupIntoLines', () => {
  it('mengurutkan baris atas→bawah dan kiri→kanan', () => {
    const lines = groupIntoLines([
      item('B. Matriks', 20, 700),
      item('1. Soal pertama', 20, 760),
      item('A. Vektor', 20, 720),
    ])
    expect(lines).toEqual(['1. Soal pertama', 'A. Vektor', 'B. Matriks'])
  })

  it('menggabungkan potongan dalam satu baris dengan spasi', () => {
    const lines = groupIntoLines([item('Nilai', 20, 500), item('elemen', 60, 500), item('adalah', 120, 500)])
    expect(lines).toEqual(['Nilai elemen adalah'])
  })

  it('membuang potongan kosong', () => {
    expect(groupIntoLines([item('  ', 20, 500), item('Ada', 20, 480)])).toEqual(['Ada'])
  })
})

describe('joinParts', () => {
  it('tidak menambah spasi berlebih pada potongan yang bersambung', () => {
    expect(joinParts([{ str: 'Mat', x: 0, width: 18 }, { str: 'riks', x: 18, width: 24 }])).toBe('Matriks')
  })
})

describe('pagesToBlocks', () => {
  it('mengubah halaman menjadi blok paragraf', () => {
    const blocks = pagesToBlocks([[item('Halo', 20, 700), item('Dunia', 20, 680)]])
    expect(blocks).toEqual([
      { type: 'p', text: 'Halo' },
      { type: 'p', text: 'Dunia' },
    ])
  })
})
