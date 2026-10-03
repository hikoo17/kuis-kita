import { describe, it, expect } from 'vitest'
import { buildStudentTemplate, parseStudentRows, parseStudentText } from '@/lib/parseStudents'

describe('parseStudentText', () => {
  it('membaca satu nama per baris', () => {
    const { entries } = parseStudentText('Ahmad\nBudi\nCitra')
    expect(entries).toEqual([
      { name: 'Ahmad', className: '' },
      { name: 'Budi', className: '' },
      { name: 'Citra', className: '' },
    ])
  })

  it('melewati baris judul dan baris kosong', () => {
    const { entries } = parseStudentText('\nNama\n\nAhmad\n\nBudi\n')
    expect(entries.map((entry) => entry.name)).toEqual(['Ahmad', 'Budi'])
  })

  it('mendukung pemisah titik koma beserta kolom kelas', () => {
    const { entries } = parseStudentText('Ahmad; X-1\nBudi; XI IPA 2')
    expect(entries).toEqual([
      { name: 'Ahmad', className: 'X-1' },
      { name: 'Budi', className: 'XI IPA 2' },
    ])
  })

  it('mendukung tempelan Excel (tab) dengan nomor urut', () => {
    const { entries } = parseStudentText('No\tNama\tKelas\n1\tAhmad\tX-1\n2\tBudi\tX-2')
    expect(entries).toEqual([
      { name: 'Ahmad', className: 'X-1' },
      { name: 'Budi', className: 'X-2' },
    ])
  })

  it('mendukung pemisah koma', () => {
    const { entries } = parseStudentText('Ahmad,X-1\nBudi,X-2')
    expect(entries.map((entry) => entry.className)).toEqual(['X-1', 'X-2'])
  })

  it('membuang penomoran di awal nama', () => {
    const { entries } = parseStudentText('1. Ahmad\n2) Budi')
    expect(entries.map((entry) => entry.name)).toEqual(['Ahmad', 'Budi'])
  })

  it('menghormati tanda kutip', () => {
    const { entries } = parseStudentText('"Ahmad, S.Pd"; X-1')
    expect(entries[0]).toEqual({ name: 'Ahmad, S.Pd', className: 'X-1' })
  })

  it('menghitung dan membuang duplikat tanpa membedakan huruf besar/kecil', () => {
    const { entries, duplicates } = parseStudentText('Ahmad\nahmad\nAHMAD\nBudi')
    expect(entries.map((entry) => entry.name)).toEqual(['Ahmad', 'Budi'])
    expect(duplicates).toBe(2)
  })

  it('mengembalikan hasil kosong untuk teks kosong', () => {
    expect(parseStudentText('')).toEqual({ entries: [], duplicates: 0, skipped: 0 })
  })

  it('membuang BOM UTF-8 di awal file (CSV buatan Excel)', () => {
    const { entries } = parseStudentText('\uFEFFNama;Kelas\nAhmad;X-1')
    expect(entries).toEqual([{ name: 'Ahmad', className: 'X-1' }])
  })
})

describe('buildStudentTemplate', () => {
  it('memakai judul kolom Nama dan Kelas', () => {
    const rows = buildStudentTemplate()
    expect(rows[0]).toEqual(['Nama', 'Kelas'])
    expect(rows).toHaveLength(3)
  })

  it('memakai nama kelas yang diberikan', () => {
    const rows = buildStudentTemplate('XI-1', 'XI-2')
    expect(rows[1][1]).toBe('XI-1')
    expect(rows[2][1]).toBe('XI-2')
  })

  it('hasilnya bisa dibaca kembali oleh parser', () => {
    const text = buildStudentTemplate('XI-1', 'XI-2')
      .map((row) => row.join(';'))
      .join('\n')
    const { entries } = parseStudentText(text)
    expect(entries).toEqual([
      { name: 'Ahmad Fauzi', className: 'XI-1' },
      { name: 'Budi Santoso', className: 'XI-2' },
    ])
  })
})

describe('parseStudentRows', () => {
  it('mengabaikan kolom nomor yang berisi angka', () => {
    expect(parseStudentRows([['1', 'Ahmad', 'X-1']])).toEqual({
      entries: [{ name: 'Ahmad', className: 'X-1' }],
      duplicates: 0,
      skipped: 0,
    })
  })

  it('tetap membaca nama saja saat tidak ada kolom kelas', () => {
    expect(parseStudentRows([['Ahmad'], ['Budi']]).entries).toEqual([
      { name: 'Ahmad', className: '' },
      { name: 'Budi', className: '' },
    ])
  })
})
