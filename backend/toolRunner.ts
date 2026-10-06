import { ChatError, record } from '../shared/chatProtocol.js'
import { resolveTextUtility } from './textUtilities.js'

export type ToolId = 'calculator' | 'time-calculator'
export type ToolCall = { tool: ToolId; input: { expression: string } }
export type ToolResult = { tool: ToolId; source: ToolId; status: 'complete' | 'error'; text: string }
export type ToolDefinition = { id: ToolId; timeoutMs: number; execute(input: { expression: string }, signal: AbortSignal): Promise<unknown> }
const definitions: readonly ToolDefinition[] = (['calculator', 'time-calculator'] as const).map(id => ({
  id, timeoutMs: 1000,
  async execute(input, signal) {
    signal.throwIfAborted()
    const result = resolveTextUtility((id === 'calculator' ? '/calc ' : '/time ') + input.expression)!
    return { ok: !result.text.startsWith('คำนวณไม่ได้:'), text: result.text }
  },
}))
export function parseTextTool(text: string): ToolCall | null {
  const match = /^\/(calc|time)(?:\s+(.*))?$/is.exec(text.trim())
  return match ? { tool: match[1].toLowerCase() === 'calc' ? 'calculator' : 'time-calculator', input: { expression: (match[2] ?? '').trim() } } : null
}
// The registry is server-owned. Model prose, arbitrary commands, file paths and URLs are not calls.
export function createToolRunner(registry: readonly ToolDefinition[] = definitions) {
  if (new Set(registry.map(d => d.id)).size !== registry.length || registry.some(d => !['calculator', 'time-calculator'].includes(d.id) || !Number.isInteger(d.timeoutMs) || d.timeoutMs < 1 || d.timeoutMs > 30000)) throw new Error('Invalid tool registry')
  return async (value: unknown, signal: AbortSignal): Promise<ToolResult> => {
    signal.throwIfAborted()
    if (!record(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'tool') || !Object.hasOwn(value, 'input') || !record(value.input) || Object.keys(value.input).length !== 1 || typeof value.input.expression !== 'string' || value.input.expression.length > 128) throw new ChatError('invalid')
    const tool = registry.find(d => d.id === value.tool)
    if (!tool) throw new ChatError('invalid')
    const input = { expression: value.input.expression }
    const controller = new AbortController()
    const upstream = AbortSignal.any([signal, controller.signal])
    const timer = setTimeout(() => controller.abort(new ChatError('timeout')), tool.timeoutMs)
    let listener: () => void = () => {}
    try {
      const pending = Promise.resolve().then(() => { upstream.throwIfAborted(); return tool.execute(input, upstream) })
      const result = await Promise.race([pending, new Promise<never>((_, reject) => { listener = () => reject(upstream.reason); upstream.addEventListener('abort', listener, { once: true }); if (upstream.aborted) listener() })])
      upstream.throwIfAborted()
      if (!record(result) || Object.keys(result).length !== 2 || typeof result.ok !== 'boolean' || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 4096) throw new ChatError('unavailable')
      return { tool: tool.id, source: tool.id, status: result.ok ? 'complete' : 'error', text: result.text }
    } catch (error) {
      if (signal.aborted) throw signal.reason
      if (error instanceof ChatError) throw error
      throw new ChatError('unavailable')
    } finally { clearTimeout(timer); upstream.removeEventListener('abort', listener); controller.abort() }
  }
}
export const runTextTool = createToolRunner()
