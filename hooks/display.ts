// Display math → Unicode art: Pi's converter, plus the layouts it lacks.
//
// - braces.ts draws \underbrace and \overbrace.
// - aligned.ts lines up the & columns of aligned, align, and split.
// - Matrices lose the │ the converter draws between every column, which reads
//   as an augmented matrix. An array that asks for rules keeps them all.

import { renderAligned } from './aligned.ts'
import { renderBraces } from './braces.ts'

const MATRIX = /\\begin\{(?:[pbBvV]?matrix|smallmatrix|array)\}/
const RULED_ARRAY = /\\begin\{array\}\s*\{[^}]*\|/

export function renderDisplay(source: string): string | undefined {
  const clear = MATRIX.test(source) && !RULED_ARRAY.test(source)
  if (!clear) return render(source)

  // vmatrix draws its bars with │ as well, so it borrows Vmatrix's ║ while the
  // separators come out. A formula holding both keeps its separators.
  const borrow = source.includes('{vmatrix}')
  if (borrow && source.includes('{Vmatrix}')) return render(source)

  const out = render(borrow ? source.replaceAll('{vmatrix}', '{Vmatrix}') : source)
  const cleared = out?.replaceAll(' │ ', '   ')
  return borrow ? cleared?.replaceAll('║', '│') : cleared
}

function render(source: string): string | undefined {
  return renderAligned(source) ?? renderBraces(source)
}
