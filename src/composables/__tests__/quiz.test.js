import { describe, it, expect } from 'vitest'
import { normalizeAnswer, resolveTimeLimit } from '@/composables/useQuiz'

describe('normalizeAnswer', () => {
  it('mengabaikan huruf besar/kecil', () => {
    expect(normalizeAnswer('Jakarta')).toBe(normalizeAnswer('jakarta'))
    expect(normalizeAnswer('JAKARTA')).toBe('jakarta')
  })

  it('mengabaikan spasi di tepi dan spasi berlebih', () => {
    expect(normalizeAnswer('  dua   kata  ')).toBe('dua kata')
  })

  it('menangani nilai kosong / null dengan aman', () => {
    expect(normalizeAnswer(null)).toBe('')
    expect(normalizeAnswer(undefined)).toBe('')
    expect(normalizeAnswer(2)).toBe('2')
  })
})

describe('resolveTimeLimit', () => {
  it('memakai batas soal bila terisi (termasuk 0 = tanpa batas)', () => {
    expect(resolveTimeLimit(45, 30)).toBe(45)
    expect(resolveTimeLimit('20', 30)).toBe(20)
    expect(resolveTimeLimit(0, 30)).toBe(0)
  })

  it('ikut pengaturan global bila batas soal kosong', () => {
    expect(resolveTimeLimit(null, 30)).toBe(30)
    expect(resolveTimeLimit(undefined, 30)).toBe(30)
    expect(resolveTimeLimit('', 30)).toBe(30)
    expect(resolveTimeLimit(null, 0)).toBe(0)
    expect(resolveTimeLimit(null, 'rusak')).toBe(0)
  })

  it('menjepit nilai negatif ke 0', () => {
    expect(resolveTimeLimit(-5, 30)).toBe(0)
  })
})
