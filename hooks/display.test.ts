import { expect, test } from 'claude-code/testing'
import { renderDisplay } from './display.ts'
import { renderLatex } from './vendor/pi-latex.js'

test('aligned right-aligns the left side and lines up each &', () => {
  expect(renderDisplay(String.raw`\begin{aligned} a &= b + c \\ &= d \end{aligned}`)).toBe('a = b + c\n  = d')
})

test('align pairs share columns, with a gutter between pairs', () => {
  const src = String.raw`\begin{align*} x &= 1 & y &= 22 \\ xx &= 333 & yy &= 4 \end{align*}`
  expect(renderDisplay(src)).toBe(' x = 1      y = 22\nxx = 333   yy = 4')
})

test('a stacked row is set off by blank lines', () => {
  const src = String.raw`\begin{aligned} y &= \frac{a}{b} \\ &= c \end{aligned}`
  expect(renderDisplay(src)).toBe(['    a', 'y = ─', '    b', '', '  = c'].join('\n'))
})

test('aligned rows can hold braces', () => {
  const src = String.raw`\begin{aligned} S &= \underbrace{a + b}_{\text{two}} \\ &= c \end{aligned}`
  expect(renderDisplay(src)).toBe(['S = a + b', '    ╰─┬─╯', '     two', '', '  = c'].join('\n'))
})

test('matrices drop the │ between columns', () => {
  expect(renderDisplay(String.raw`\begin{pmatrix} 1 & 20 \\ 300 & 4 \end{pmatrix}`)).toBe('⎛ 1     20 ⎞\n⎝ 300   4  ⎠')
})

test('a determinant keeps its bars', () => {
  expect(renderDisplay(String.raw`D = \begin{vmatrix} a & b \\ c & d \end{vmatrix}`)).toBe('D = │ a   b │\n    │ c   d │')
})

test('an array that asks for rules keeps them', () => {
  const src = String.raw`\begin{array}{c|c} 1 & 2 \\ 3 & 4 \end{array}`
  expect(renderDisplay(src)).toBe(renderLatex(src, { display: true }))
})
