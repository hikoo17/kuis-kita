/**
 * Ubah rumus Word (OMML) menjadi LaTeX, supaya matriks/pecahan/akar yang
 * ditulis di Equation Editor Word muncul rapi lewat KaTeX.
 *
 * Hanya memakai properti DOM minimal (localName, children, textContent,
 * getAttribute) agar mudah diuji tanpa browser.
 */

function childElements(node) {
  return Array.from(node?.children ?? [])
}

function findChild(node, name) {
  return childElements(node).find((child) => child.localName === name)
}

function attr(node, name) {
  if (!node || typeof node.getAttribute !== 'function') return null
  return node.getAttribute(`m:${name}`) ?? node.getAttribute(name)
}

/** Amankan karakter khusus LaTeX pada teks biasa. */
function escapeText(value) {
  return String(value ?? '').replace(/([#$%&_{}])/g, '\\$1')
}

/** Gabungkan semua m:t di dalam sebuah elemen (mis. satu run). */
function collectText(node) {
  let out = ''
  for (const child of childElements(node)) {
    if (child.localName === 't') out += child.textContent ?? ''
    else out += collectText(child)
  }
  return out
}

/** LaTeX dari isi sebuah argumen OMML (mis. m:e, m:num, m:den). */
function argLatex(node, name) {
  return ommlToLatex(findChild(node, name))
}

/** Telusuri isi wadah (oMath, e, num, den, sup, sub, …). */
function childrenLatex(node) {
  return childElements(node).map(ommlToLatex).join('')
}

const NARY_SYMBOLS = {
  '∑': '\\sum',
  '∏': '\\prod',
  '∐': '\\coprod',
  '∫': '\\int',
  '∬': '\\iint',
  '∮': '\\oint',
  '⋃': '\\bigcup',
  '⋂': '\\bigcap',
}

/**
 * Ubah satu elemen OMML menjadi LaTeX.
 * Elemen properti (…Pr) dilewati karena hanya berisi format.
 */
export function ommlToLatex(node) {
  if (!node) return ''
  const ln = node.localName

  if (ln.endsWith('Pr')) return ''
  if (ln === 't') return escapeText(node.textContent ?? '')
  if (ln === 'r') return escapeText(collectText(node))

  if (ln === 'f') {
    return `\\frac{${argLatex(node, 'num')}}{${argLatex(node, 'den')}}`
  }

  if (ln === 'm') {
    const rows = childElements(node)
      .filter((cell) => cell.localName === 'mr')
      .map((mr) =>
        childElements(mr)
          .filter((cell) => cell.localName === 'e')
          .map((cell) => ommlToLatex(cell)),
      )
    return `\\begin{matrix}${rows.map((row) => row.join(' & ')).join(' \\\\ ')}\\end{matrix}`
  }

  if (ln === 'sSup') return `{${argLatex(node, 'e')}}^{${argLatex(node, 'sup')}}`
  if (ln === 'sSub') return `{${argLatex(node, 'e')}}_{${argLatex(node, 'sub')}}`
  if (ln === 'sSubSup') {
    return `{${argLatex(node, 'e')}}_{${argLatex(node, 'sub')}}^{${argLatex(node, 'sup')}}`
  }

  if (ln === 'd') {
    const pr = findChild(node, 'dPr')
    const beg = pr ? attr(findChild(pr, 'begChr'), 'val') : null
    const end = pr ? attr(findChild(pr, 'endChr'), 'val') : null
    const left = beg == null ? '(' : beg
    const right = end == null ? ')' : end
    return `\\left${left}${argLatex(node, 'e')}\\right${right}`
  }

  if (ln === 'rad') {
    const degree = argLatex(node, 'deg')
    const body = argLatex(node, 'e')
    return degree ? `\\sqrt[${degree}]{${body}}` : `\\sqrt{${body}}`
  }

  if (ln === 'bar') return `\\overline{${argLatex(node, 'e')}}`

  if (ln === 'nary') {
    const pr = findChild(node, 'naryPr')
    const chr = pr ? attr(findChild(pr, 'chr'), 'val') : null
    const symbol = NARY_SYMBOLS[chr ?? ''] ?? '\\sum'
    const sub = argLatex(node, 'sub')
    const sup = argLatex(node, 'sup')
    const body = argLatex(node, 'e')
    const limits = `${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}`
    return `${symbol}${limits} ${body}`
  }

  return childrenLatex(node)
}
