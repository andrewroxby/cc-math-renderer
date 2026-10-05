// LaTeX in assistant markdown → Unicode, using Pi's converter.
//
// Display math becomes an unlabeled code block so its stacked layout keeps
// its alignment; display.ts renders it. Inline math becomes escaped text.
// Anything the converter rejects, and any span still streaming in, stays as
// written. Converting converted text changes nothing, so a reply converted
// live can be drawn through the converter again.

import { renderDisplay } from './display.ts'
import { renderLatex } from './vendor/pi-latex.js'

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const DISPLAY_DOLLAR = /^ {0,3}\$\$[ \t]*\n?([\s\S]*?)\$\$[ \t]*$/
const DISPLAY_BRACKET = /^ {0,3}\\\[[ \t]*\n?([\s\S]*?)\\\][ \t]*$/

// `$` is escaped so a second pass finds no math; `[` is not, since `\[` at the
// start of a line would read as a display opener. An escaped `]` still keeps
// brackets from forming a link.
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_\]<>|~#$]/g, (c) => '\\' + c)
}

function isEscaped(text: string, index: number): boolean {
  let slashes = 0
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) slashes++
  return slashes % 2 === 1
}

function codeBlock(art: string): string {
  return '```\n' + art + '\n```'
}

/** Convert inline `$…$` and `\(…\)` spans in one line of prose. */
function convertInline(line: string): string {
  let out = ''
  let i = 0
  while (i < line.length) {
    const c = line[i]!
    if (c === '`') {
      const run = /^`+/.exec(line.slice(i))![0]
      const close = line.indexOf(run, i + run.length)
      const end = close < 0 ? line.length : close + run.length
      out += line.slice(i, end)
      i = end
      continue
    }
    let open = ''
    let close = ''
    if (c === '$' && !isEscaped(line, i) && line[i + 1] !== '$' && !/\s/.test(line[i + 1] ?? ' ')) {
      open = '$'
      close = '$'
    } else if (c === '\\' && line[i + 1] === '(' && !isEscaped(line, i)) {
      open = '\\('
      close = '\\)'
    }
    if (open) {
      let j = line.indexOf(close, i + open.length)
      while (j >= 0 && isEscaped(line, j) && close === '$') j = line.indexOf(close, j + 1)
      const body = j >= 0 ? line.slice(i + open.length, j) : ''
      const after = j >= 0 ? line[j + close.length] ?? '' : ''
      // Currency and shell variables: "$5 and $10", "$HOME".
      const plausible =
        j >= 0 && body.length > 0 && !body.includes('`') && !(close === '$' && (/\s$/.test(body) || /\d/.test(after)))
      if (plausible) {
        const rendered = renderLatex(body)
        if (rendered !== undefined && !rendered.includes('\n')) {
          out += escapeMarkdown(rendered)
          i = j + close.length
          continue
        }
      }
    }
    out += c
    i++
  }
  return out
}

export function convertMarkdownMath(markdown: string): string {
  return convertMarkdown(markdown).text
}

export type Converted = { text: string; fence: string | undefined; held: string }

/**
 * Convert markdown that may continue earlier text: `fence` is the code fence
 * that text left open. With `hold`, an unclosed display block comes back
 * unconverted as `held`, to be retried once more text arrives.
 */
export function convertMarkdown(markdown: string, options: { fence?: string; hold?: boolean } = {}): Converted {
  let fence = options.fence
  if (!fence && !/[$\\]|```|~~~/.test(markdown)) return { text: markdown, fence, held: '' }
  const lines = markdown.split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fenceMatch = FENCE.exec(line)
    if (fence) {
      out.push(line)
      if (fenceMatch && fenceMatch[1]!.startsWith(fence)) fence = undefined
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      out.push(line)
      continue
    }

    // A display block may span lines: gather until its closer.
    const opener = /^ {0,3}(\$\$|\\\[)/.exec(line)?.[1]
    if (opener) {
      const closer = opener === '$$' ? '$$' : '\\]'
      // The closer must come after the opener, which itself ends in `$$`.
      const start = line.indexOf(opener) + 2
      const closed = (b: string) => b.trimEnd().length > start && b.trimEnd().endsWith(closer)
      let j = i
      let block = line
      while (!closed(block) && j + 1 < lines.length) {
        j++
        block += '\n' + lines[j]
      }
      const match = (opener === '$$' ? DISPLAY_DOLLAR : DISPLAY_BRACKET).exec(block)
      const rendered = match?.[1]?.trim() ? renderDisplay(match[1].trim()) : undefined
      if (rendered !== undefined) {
        out.push(codeBlock(rendered))
        i = j
        continue
      }
      if (options.hold && !closed(block)) {
        return { text: out.length ? out.join('\n') + '\n' : '', fence, held: lines.slice(i).join('\n') }
      }
      // Unclosed (still streaming) or unsupported: leave as written.
    }

    out.push(convertInline(line))
  }
  return { text: out.join('\n'), fence, held: '' }
}
