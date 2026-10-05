// aligned, align, and split environments, whose & columns Pi's converter
// drops, leaving each row flush left.
//
// Each row renders on its own with a placeholder letter where each & stood.
// The placeholders mark the column boundaries on the row's baseline; they are
// cut out, and the columns are padded to a shared width, right-aligned and
// left-aligned in turn as LaTeX does. Anything this cannot place cleanly goes
// to the converter as written.

import { renderBraces } from './braces.ts'

const ENVIRONMENT = /^\\begin\{(aligned|align\*?|split)\}([\s\S]*)\\end\{\1\}$/

// Placeholder letters; each one used must be absent from the source.
const MARKS = 'QJXZKVWYHGFUP'

// Extra space before each further equation pair, as align puts between them.
const GUTTER = 2

/** Render a display block that is one alignment environment, or undefined. */
export function renderAligned(source: string): string | undefined {
  const env = ENVIRONMENT.exec(source.trim())
  if (!env) return undefined
  const body = env[2]!.replace(/\\(notag|nonumber)\b|\\label\{[^}]*\}/g, '')
  const rows = splitTopLevel(body, /^\\\\(\s*\[[^\]]*\])?/).filter((row) => row.trim())
  const table = rows.map((row) => splitTopLevel(row, /^&/))
  const columns = Math.max(...table.map((cells) => cells.length))
  const marks = [...MARKS].filter((c) => !source.includes(c)).slice(0, columns - 1)
  if (rows.length === 0 || marks.length < columns - 1) return undefined

  const blocks = []
  for (const cells of table) {
    const rebuilt = cells.map((cell, i) => (i === 0 ? cell : `\\text{${marks[i - 1]}}${cell}`)).join('')
    const block = cutMarks(renderBraces(rebuilt), marks.slice(0, cells.length - 1))
    if (!block) return undefined
    blocks.push(block)
  }

  // Width of each column in each row, then the widest per column.
  const widths = blocks.map(({ lines, bounds }) => {
    const edges = [0, ...bounds, Math.max(...lines.map((l) => l.length))]
    return edges.slice(1).map((edge, i) => edge - edges[i]!)
  })
  const target = Array.from({ length: columns }, (_, i) => Math.max(...widths.map((w) => w[i] ?? 0)))

  const out: string[] = []
  for (const [r, { lines, bounds }] of blocks.entries()) {
    const starts = [0, ...bounds]
    let padded = lines
    for (let i = widths[r]!.length - 1; i >= 0; i--) {
      const gutter = i > 0 && i % 2 === 0 ? GUTTER : 0
      const gap = target[i]! - widths[r]![i]! + gutter
      const at = i % 2 === 0 ? starts[i]! : starts[i]! + widths[r]![i]!
      padded = padded.map((line) => line.padEnd(at).slice(0, at) + ' '.repeat(gap) + line.slice(at))
    }
    // A blank line keeps a stacked row from running into its neighbours.
    if (r > 0 && (lines.length > 1 || blocks[r - 1]!.lines.length > 1)) out.push('')
    out.push(...padded.map((line) => line.trimEnd()))
  }
  return out.join('\n')
}

/** Cut the placeholders out of a rendered row, returning where each column begins. */
function cutMarks(rendered: string | undefined, marks: string[]): { lines: string[]; bounds: number[] } | undefined {
  if (rendered === undefined) return undefined
  let lines = rendered.split('\n').map((line) => [...line])
  const bounds: number[] = []
  for (const mark of marks) {
    const row = lines.findIndex((cols) => cols.includes(mark))
    if (row < 0 || lines.flat().filter((c) => c === mark).length !== 1) return undefined
    const col = lines[row]!.indexOf(mark)
    const span = lines[row]![col + 1] === ' ' ? 2 : 1
    if (lines.some((cols, r) => r !== row && cols.slice(col, col + span).some((c) => c !== ' '))) return undefined
    lines = lines.map((cols) => [...cols.slice(0, col), ...cols.slice(col + span)])
    bounds.push(col)
  }
  if (bounds.some((b, i) => i > 0 && b < bounds[i - 1]!)) return undefined
  return { lines: lines.map((cols) => cols.join('')), bounds }
}

/** Split at a separator that sits outside every group, \left…\right pair, and environment. */
function splitTopLevel(source: string, separator: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let i = 0
  while (i < source.length) {
    const sep = depth === 0 ? separator.exec(source.slice(i)) : null
    if (sep) {
      parts.push(source.slice(start, i))
      i += sep[0].length
      start = i
      continue
    }
    const c = source[i]!
    if (c === '\\') {
      const name = /^\\([A-Za-z]+|.)/.exec(source.slice(i))![1]!
      if (name === 'left' || name === 'begin') depth++
      if (name === 'right' || name === 'end') depth--
      i += name.length + 1
      continue
    }
    if (c === '{') depth++
    if (c === '}') depth--
    i++
  }
  parts.push(source.slice(start))
  return parts
}
