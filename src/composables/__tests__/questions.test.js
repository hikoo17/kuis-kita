import { describe, it, expect } from 'vitest'
import { sanitizeQuestion, shuffleArray } from '@/composables/useQuestions'

describe('sanitizeQuestion', () => {
  it('memangkas spasi dan menyimpan kolom yang diharapkan', () => {
    const result = sanitizeQuestion({
      subject: '  Aljabar ',
      type: 'short_answer',
      question_text: '  x + 1 = 3  ',
      correct_answer: ' 2 ',
    })

    expect(result).toEqual({
      subject: 'Aljabar',
      type: 'short_answer',
      question_text: 'x + 1 = 3',
      options: null,
      correct_answer: '2',
      image_url: null,
    })
  })

  it('membuang pilihan ganda yang kosong dan menormalkan label', () => {
    const result = sanitizeQuestion({
      subject: 'Matriks',
      type: 'multiple_choice',
      question_text: 'Pilih satu',
      correct_answer: 'a',
      options: [
        { label: 'a', text: ' Satu ' },
        { label: 'B', text: '   ' },
        { label: 'c', text: 'Tiga' },
      ],
    })

    expect(result.options).toEqual([
      { label: 'A', text: 'Satu', image: null },
      { label: 'C', text: 'Tiga', image: null },
    ])
  })

  it('mempertahankan gambar pilihan dan membolehkan opsi tanpa teks', () => {
    const result = sanitizeQuestion({
      subject: 'Matriks',
      type: 'multiple_choice',
      question_text: 'Pilih matriks yang benar',
      correct_answer: 'A',
      options: [
        { label: 'A', text: '  ', image: '  https://contoh/a.png ' },
        { label: 'B', text: '', image: null },
      ],
    })

    expect(result.options).toEqual([{ label: 'A', text: '', image: 'https://contoh/a.png' }])
  })

  it('menjadikan image_url null ketika kosong', () => {
    expect(
      sanitizeQuestion({ subject: 'x', type: 'short_answer', question_text: 'q', correct_answer: 'a' })
        .image_url,
    ).toBeNull()
    expect(
      sanitizeQuestion({
        subject: 'x',
        type: 'short_answer',
        question_text: 'q',
        correct_answer: 'a',
        image_url: '  https://contoh/gambar.png ',
      }).image_url,
    ).toBe('https://contoh/gambar.png')
  })
})

describe('shuffleArray', () => {
  it('mengembalikan semua elemen tanpa mengubah array asli', () => {
    const source = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(source)

    expect(shuffled).toHaveLength(5)
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    expect(source).toEqual([1, 2, 3, 4, 5])
  })
})
