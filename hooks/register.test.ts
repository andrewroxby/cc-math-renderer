import { expect, test } from 'claude-code/testing'
import { convertMarkdown, convertMarkdownMath } from './math.ts'

test('inline math becomes Unicode text', () => {
  expect(convertMarkdownMath('Einstein: $E=mc^2$ and $\\alpha_1$.')).toBe('Einstein: E = mc² and α₁.')
})

test('display math becomes a code block of Unicode art', () => {
  const out = convertMarkdownMath('Before\n\n$$\\frac{1}{2}$$\n\nAfter')
  expect(out).toContain('```\n')
  expect(out).not.toContain('\\frac')
})

test('code, currency, and unclosed spans stay as written', () => {
  const src = 'Costs $5 and $10. `$x$` stays.\n\n```\n$$\\frac{a}{b}$$\n```\n\n$$\\begin{bmatrix} 1'
  expect(convertMarkdownMath(src)).toBe(src)
})

test('converting converted text changes nothing', () => {
  const src = [
    'Inline $[0,1]$ and $\\$5$ and $x_{\\text{max}}$.',
    '$[a,b]$ starts a line.',
    '',
    '$$\\frac{1}{2}$$',
    '',
    'Costs $5 and $10.',
  ].join('\n')
  const once = convertMarkdownMath(src)
  expect(convertMarkdownMath(once)).toBe(once)
})

test('an unclosed display block is held until it closes', () => {
  const first = convertMarkdown('Intro $x^2$.\n$$\n\\frac{a}{b}\n', { hold: true })
  expect(first.text).toBe('Intro x².\n')
  expect(first.held).toBe('$$\n\\frac{a}{b}\n')
  const second = convertMarkdown(first.held + '$$\nAfter.\n', { fence: first.fence, hold: true })
  expect(second.text).toBe('```\na\n─\nb\n```\nAfter.\n')
  expect(second.held).toBe('')
})

test('a code fence left open by one flush shields the next', () => {
  const first = convertMarkdown('```\n', { hold: true })
  expect(first.fence).toBe('```')
  expect(convertMarkdown('$x$\n```\n', { fence: first.fence, hold: true }).text).toBe('$x$\n```\n')
})

test('streamed flushes display converted, with display blocks held whole', async ($, on) => {
  on('classic.MessageDisplay', () => ({}))
  const flush = (index: number, delta: string, final = false) =>
    $.classic.MessageDisplay({ turn_id: 't', message_id: 'm', index, final, delta })
  expect((await flush(0, 'Plain line.\n')).displayContent).toBe(undefined)
  expect((await flush(1, 'Energy $E=mc^2$.\n')).displayContent).toBe('Energy E = mc².\n')
  expect((await flush(2, '$$\n\\frac{1}{2}\n')).displayContent).toBe('')
  expect((await flush(3, '$$\nDone.', true)).displayContent).toBe('```\n1\n─\n2\n```\nDone.')
})
