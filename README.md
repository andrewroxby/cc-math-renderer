# cc-math-renderer

A Claude Code plugin that renders the LaTeX in Claude's replies as Unicode
math in the terminal, derived from Pi's LaTeX renderer with modest QOL additions on top.

Without it, a reply shows the source:

```
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

With it, the same reply shows:

```
    -b ± √(b² - 4ac)
x = ────────────────
           2a
```

## What it renders

Inline math becomes text in the sentence. `$\Delta = b^2 - 4ac$` reads as
`Δ = b² - 4ac`.

Display math (`$$…$$` or `\[…\]`) becomes stacked Unicode art in a code block,
so its columns stay aligned:

```
 n      n(n+1)
 ∑  i = ──────
i=1       2
```

`aligned`, `align`, and `split` line up on their `&` columns:

```
(a+b)² = a² + 2ab + b²
(x+1)² = x² + 2x + 1
```

`\underbrace` and `\overbrace` draw the brace and its label:

```
1.2¹ ×   15 px   = 18 px
╰┬─╯     ╰─┬─╯
zoom   font size
```

Matrices get their brackets:

```
A = ⎛ 1   2 ⎞
    ⎝ 3   4 ⎠
```

Math renders as the reply streams in. Each finished line is redrawn as it
arrives, and a display block appears once its closing `$$` lands.

Code spans, code blocks, and prices such as `$5 and $10` are left alone. So
is anything the converter can't parse, which stays as written.

## Install

```bash
claude plugin marketplace add andrewroxby/cc-math-renderer
claude plugin install cc-math-renderer@andrewroxby
```

Start a new session, or run `/reload-plugins` in a running one.

Claude only writes LaTeX when it has a reason to. A line like this in your
`CLAUDE.md` makes it a habit:

```
Write math in LaTeX: $...$ inline and $$...$$ for display.
```

## Requirements and limits

- Claude Code in a terminal. Tested on Claude Code 2.1.289. The VS Code chat
  panel and `claude -p` show the LaTeX source.
- The plugin uses Claude Code's function-hook API, which is marked early
  access. A Claude Code update could change it and break the plugin.
- Inline math has a single row to work with, so fractions in a sentence
  flatten to `a/b`.
- Braces nested inside other constructs flatten to their contents.

## How it works

Two hooks share one converter. A `MessageDisplay` hook redraws each batch of
lines while a reply streams, holding back an unclosed display block until it
closes. An `AssistantMessage` render hook covers finished replies and replies
drawn from history. Running the converter on its own output changes nothing,
so a reply can safely pass through both.

The converter is `renderLatex()` from [pi-tui](https://github.com/earendil-works/pi/tree/main/packages/tui),
the terminal UI library behind the [Pi](https://github.com/earendil-works/pi)
coding agent, bundled in `hooks/vendor/`. This plugin adds the brace and
alignment layouts on top, and removes the bars pi-tui draws between matrix
columns. A reply with no `$` or `\` passes through untouched.

## Development

```bash
claude plugin validate .
claude plugin test .
```

`hooks/vendor/NOTICE` explains how to rebuild the bundled converter.

## Credits and license

MIT, see `LICENSE`. The bundled converter is pi-tui by Mario Zechner, and
get-east-asian-width by Sindre Sorhus, both MIT. Their notices are in
`hooks/vendor/NOTICE`.
