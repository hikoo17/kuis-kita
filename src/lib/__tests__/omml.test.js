import { describe, it, expect } from 'vitest'
import { ommlToLatex } from '@/lib/omml'

// Node DOM tiruan: cukup punya localName, children, textContent, getAttribute.
function el(localName, children = [], { textContent = '', attrs = {} } = {}) {
  return {
    localName,
    children,
    textContent,
    getAttribute: (name) => attrs[name] ?? null,
  }
}
function run(text) {
  return el('r', [el('rPr'), el('t', [], { textContent: text })])
}
function cell(text) {
  return el('e', [run(text)])
}
function row(...texts) {
  return el('mr', texts.map(cell))
}

describe('ommlToLatex', () => {
  it('mengubah matriks OMML jadi matrix (kurung dari delimiter)', () => {
    const matrix = el('m', [row('1', '4', '7'), row('2', '5', '8')])
    expect(ommlToLatex(matrix)).toBe('\\begin{matrix}1 & 4 & 7 \\\\ 2 & 5 & 8\\end{matrix}')
  })

  it('mengubah pecahan', () => {
    const frac = el('f', [el('num', [run('a')]), el('den', [run('b')])])
    expect(ommlToLatex(frac)).toBe('\\frac{a}{b}')
  })

  it('mengubah pangkat dan indeks', () => {
    expect(ommlToLatex(el('sSup', [el('e', [run('x')]), el('sup', [run('2')])]))).toBe('{x}^{2}')
    expect(ommlToLatex(el('sSub', [el('e', [run('q')]), el('sub', [run('23')])]))).toBe('{q}_{23}')
  })

  it('mengubah akar', () => {
    expect(ommlToLatex(el('rad', [el('e', [run('x')])]))).toBe('\\sqrt{x}')
  })

  it('mengamankan karakter khusus pada teks biasa', () => {
    expect(ommlToLatex(el('r', [el('t', [], { textContent: '50%' })]))).toBe('50\\%')
  })
})
