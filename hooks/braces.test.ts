import { expect, test } from 'claude-code/testing'
import { renderBraces } from './braces.ts'
import { renderLatex } from './vendor/pi-latex.js'

test('underbraces draw a brace and a centered label under each base', () => {
  const src = String.raw`\underbrace{1.2^{1}}_{\text{zoom}} \times \underbrace{0.6}_{\text{width per em}} = x`
  expect(renderBraces(src)).toBe(
    ['1.2¹ ×     0.6      = x', '╰┬─╯       ╰┬╯', 'zoom   width per em'].join('\n'),
  )
})

test('a brace shares the grid with a stacked fraction', () => {
  expect(renderBraces(String.raw`\frac{1}{2} + \underbrace{a + b}_{\text{sum}}`)).toBe(
    ['1', '─ + a + b', '2   ╰─┬─╯', '     sum'].join('\n'),
  )
})

test('a bare label and a missing label both work', () => {
  expect(renderBraces(String.raw`\underbrace{x}_n + 1`)).toBe(['x + 1', '┬', 'n'].join('\n'))
  expect(renderBraces(String.raw`\underbrace{abc} = d`)).toBe(['abc = d', '╰┬╯'].join('\n'))
})

test('braces it cannot place fall back to the converter', () => {
  for (const src of [String.raw`\frac{\underbrace{a}_{b}}{c}`, String.raw`\underbrace{\frac{1}{2}}_{h}`]) {
    expect(renderBraces(src)).toBe(renderLatex(src, { display: true }))
  }
})

test('display math without underbraces is untouched', () => {
  const src = String.raw`\sum_{i=1}^{n} i = \frac{n(n+1)}{2}`
  expect(renderBraces(src)).toBe(renderLatex(src, { display: true }))
})

test('overbraces draw the brace and label above the base', () => {
  expect(renderBraces(String.raw`\overbrace{a + b}^{\text{sum}} = c`)).toBe(
    [' sum', '╭─┴─╮', 'a + b = c'].join('\n'),
  )
})

test('both kinds share one formula', () => {
  expect(renderBraces(String.raw`\overbrace{x}^{n} + \underbrace{y}_{m}`)).toBe(['n', '┴', 'x + y', '    ┬', '    m'].join('\n'))
})
