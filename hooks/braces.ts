// \underbrace and \overbrace in display math, which Pi's converter flattens to
// their contents.
//
// Each top-level brace becomes a placeholder as wide as the wider of base and
// label. The converter lays out the rest, then the base, the brace, and the
// label are drawn into its grid at the placeholder: below the baseline for
// \underbrace{base}_{label}, above it for \overbrace{base}^{label}. Anything
// that cannot be placed cleanly goes to the converter as written.

import { renderLatex } from './vendor/pi-latex.js'

type Kind = 'under' | 'over'
type Brace = { kind: Kind; start: number; end: number; base: string; label: string }

// Placeholder letters; each one used must be absent from the source.
const MARKS = 'QJXZKVWYHGFUP'

/** Render display math, drawing top-level braces when it can. */
export function renderBraces(source: string): string | undefined {
  return withBraces(source) ?? renderLatex(source, { display: true })
}

function withBraces(source: string): string | undefined {
  const braces = findBraces(source)
  const marks = [...MARKS].filter((c) => !source.includes(c))
  if (braces.length === 0 || marks.length < braces.length) return undefined

  const slots = []
  for (const [i, b] of braces.entries()) {
    const base = renderLine(b.base)
    const label = b.label ? renderLine(b.label) : ''
    if (base === undefined || label === undefined) return undefined
    const width = Math.max(cells(base), cells(label))
    slots.push({ ...b, base, label, width, mark: marks[i]! })
  }

  let rebuilt = source
  for (const s of [...slots].reverse()) {
    rebuilt = rebuilt.slice(0, s.start) + `\\text{${s.mark.repeat(s.width)}}` + rebuilt.slice(s.end)
  }
  const out: string | undefined = renderLatex(rebuilt, { display: true })
  if (out === undefined) return undefined

  const grid = out.split('\n').map((line) => [...line])
  const placed = []
  for (const s of slots) {
    const row = grid.findIndex((cols) => cols.includes(s.mark))
    if (row < 0) return undefined
    const col = grid[row]!.indexOf(s.mark)
    const run = grid.flat().filter((c) => c === s.mark).length
    if (run !== s.width || grid[row]!.slice(col, col + s.width).join('') !== s.mark.repeat(s.width)) return undefined
    placed.push({ ...s, row, col })
  }

  // An overbrace on the top rows needs room above it.
  const lift = Math.max(0, ...placed.filter((s) => s.kind === 'over').map((s) => 2 - s.row))
  grid.unshift(...Array.from({ length: lift }, () => []))

  for (const s of placed) {
    const row = s.row + lift
    const step = s.kind === 'under' ? 1 : -1
    const baseAt = s.col + Math.floor((s.width - cells(s.base)) / 2)
    const labelAt = s.col + Math.floor((s.width - cells(s.label)) / 2)
    put(grid[row]!, s.col, ' '.repeat(s.width))
    put(grid[row]!, baseAt, s.base)
    for (const r of [row + step, row + 2 * step]) {
      grid[r] ??= []
      if (grid[r]!.slice(s.col, s.col + s.width).some((c) => c !== ' ')) return undefined
    }
    put(grid[row + step]!, baseAt, brace(cells(s.base), s.kind))
    put(grid[row + 2 * step]!, labelAt, s.label)
  }
  return grid
    .map((cols) => cols.join('').trimEnd())
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

/** Single-row rendering, or undefined when it stacks or carries combining marks. */
function renderLine(source: string): string | undefined {
  const out = renderLatex(source, { display: true })?.trim()
  return out !== undefined && !out.includes('\n') && !/\p{M}/u.test(out) ? out : undefined
}

function cells(text: string): number {
  return [...text].length
}

function put(cols: string[], at: number, text: string): void {
  for (let i = cols.length; i < at; i++) cols[i] = ' '
  ;[...text].forEach((c, i) => (cols[at + i] = c))
}

function brace(width: number, kind: Kind): string {
  const [l, tick, r] = kind === 'under' ? ['╰', '┬', '╯'] : ['╭', '┴', '╮']
  if (width === 1) return tick
  if (width === 2) return l + r
  const left = Math.floor((width - 3) / 2)
  return l + '─'.repeat(left) + tick + '─'.repeat(width - 3 - left) + r
}

/** Braces outside every group, \left…\right pair, and environment. */
function findBraces(source: string): Brace[] {
  const found: Brace[] = []
  let depth = 0
  let i = 0
  while (i < source.length) {
    const c = source[i]!
    if (c === '\\') {
      const name = /^\\([A-Za-z]+|.)/.exec(source.slice(i))![1]!
      if (name === 'left' || name === 'begin') depth++
      if (name === 'right' || name === 'end') depth--
      if ((name === 'underbrace' || name === 'overbrace') && depth === 0) {
        const kind: Kind = name === 'underbrace' ? 'under' : 'over'
        const base = readArgument(source, i + name.length + 1)
        if (!base) return []
        let end = base.end
        let label = ''
        const script = new RegExp(`^\\s*\\${kind === 'under' ? '_' : '^'}`).exec(source.slice(end))
        if (script) {
          const arg = readArgument(source, end + script[0].length)
          if (!arg) return []
          label = arg.body
          end = arg.end
        }
        found.push({ kind, start: i, end, base: base.body, label })
        i = end
        continue
      }
      i += name.length + 1
      continue
    }
    if (c === '{') depth++
    if (c === '}') depth--
    i++
  }
  return found
}

/** One argument: a braced group, a command with an optional braced group, or one character. */
function readArgument(source: string, from: number): { body: string; end: number } | undefined {
  let i = from
  while (/\s/.test(source[i] ?? '')) i++
  if (source[i] === '{') {
    const close = matchBrace(source, i)
    return close < 0 ? undefined : { body: source.slice(i + 1, close), end: close + 1 }
  }
  if (source[i] === '\\') {
    const name = /^\\([A-Za-z]+|.)/.exec(source.slice(i))![0]
    let end = i + name.length
    let j = end
    while (/\s/.test(source[j] ?? '')) j++
    if (source[j] === '{') {
      const close = matchBrace(source, j)
      if (close < 0) return undefined
      end = close + 1
    }
    return { body: source.slice(i, end), end }
  }
  return i < source.length ? { body: source[i]!, end: i + 1 } : undefined
}

function matchBrace(source: string, open: number): number {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return i
  }
  return -1
}
