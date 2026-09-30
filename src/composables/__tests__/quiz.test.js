import { describe, it, expect } from 'vitest'
import { normalizeAnswer } from '@/composables/useQuiz'

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
