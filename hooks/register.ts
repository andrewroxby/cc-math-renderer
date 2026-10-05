import { convertMarkdown, convertMarkdownMath } from './math.ts'

// A display block held back longer than this is shown as written.
const MAX_HELD_LINES = 40

// Replies still streaming, by message id; a reply that never finishes is
// dropped once enough newer ones arrive.
const MAX_STREAMS = 32
const streams = new Map<string, { fence: string | undefined; held: string }>()

// Draw LaTeX in Claude's replies as Unicode. The rewrite changes the drawing
// only; the stored message, copy, and resume keep the LaTeX.
export function register(on: any) {
  // While a reply streams, each batch of finished lines is converted as it
  // lands. A display block waits, unshown, until its closer arrives.
  on('classic.MessageDisplay', async ($: any, e: any, next: any) => {
    const result = await next(e)
    const prior = streams.get(e.message_id) ?? { fence: undefined, held: '' }
    const text = prior.held + e.delta
    const hold = !e.final && text.split('\n').length <= MAX_HELD_LINES
    const { text: shown, fence, held } = convertMarkdown(text, { fence: prior.fence, hold })

    streams.delete(e.message_id)
    if (!e.final) streams.set(e.message_id, { fence, held })
    if (streams.size > MAX_STREAMS) streams.delete(streams.keys().next().value!)

    return shown === e.delta ? result : { ...result, displayContent: shown }
  })

  // A finished reply, and any reply drawn from history.
  on('ui.render', { component: 'AssistantMessage' }, async ($: any, e: any, next: any) => {
    const text = e.props?.text
    if (typeof text !== 'string') return next(e)
    const converted = convertMarkdownMath(text)
    return converted === text ? next(e) : next({ ...e, props: { ...e.props, text: converted } })
  })
}
