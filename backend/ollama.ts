import { ChatError, record } from '../shared/chatProtocol.js'
import { instructionFor, type Provider } from './provider.js'

export type OllamaConfig = { model: string; baseUrl: string; context: number; output: number; threads: number; think: boolean; keepAlive: string }
export function ollamaConfig(env: NodeJS.ProcessEnv): OllamaConfig {
  const base = new URL(env.OLLAMA_URL || 'http://127.0.0.1:11434')
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('OLLAMA_URL must be an explicit local 127.0.0.1 HTTP origin')
  const model = env.AI_MODEL?.trim()
  if (!model || !/^[a-zA-Z0-9][\w.:/-]{0,119}$/.test(model)) throw new Error('Set AI_MODEL to an installed local model')
  const integer = (key: string, fallback: number, min: number, max: number) => { const value = Number(env[key] ?? fallback); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`); return value }
  if (env.OLLAMA_THINK && !['true', 'false'].includes(env.OLLAMA_THINK)) throw new Error('OLLAMA_THINK must be true or false')
  const keepAlive = env.OLLAMA_KEEP_ALIVE || '1m'
  if (!/^(0|[1-5]m)$/.test(keepAlive)) throw new Error('OLLAMA_KEEP_ALIVE must be 0 or 1m–5m')
  return { model, baseUrl: base.origin, context: integer('OLLAMA_CONTEXT', 2048, 1024, 8192), output: integer('OLLAMA_OUTPUT', 192, 32, 512), threads: integer('OLLAMA_THREADS', 3, 1, 4), think: env.OLLAMA_THINK === 'true', keepAlive }
}
export function createOllamaProvider(config: OllamaConfig, fetcher: typeof fetch = fetch): Provider {
  const post = (path: string, body: unknown, signal: AbortSignal) => fetcher(`${config.baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, redirect: 'error' })
  async function check(signal: AbortSignal) {
    try {
      const response = await post('/api/show', { model: config.model }, signal)
      if (response.status === 404) { await response.body?.cancel(); throw new ChatError('model_missing') }
      if (!response.ok) { await response.body?.cancel(); throw new ChatError('unavailable') }
      const value: unknown = await response.json()
      if (!record(value) || !Array.isArray(value.capabilities) || !value.capabilities.includes('completion') || value.remote_host || value.remote_model) throw new ChatError('unavailable')
      if (value.capabilities.includes('thinking') && (!record(value.thinking) || !Array.isArray(value.thinking.values) || !value.thinking.values.includes(config.think))) throw new ChatError('model_settings')
      if (config.think && !value.capabilities.includes('thinking')) throw new ChatError('model_settings')
    } catch (error) { if (signal.aborted) throw signal.reason; if (error instanceof ChatError) throw error; throw new ChatError('unavailable') }
  }
  return {
    kind: 'live', model: config.model, check,
    async *stream(input, signal) {
      // Check on each request: never pull a missing model or route to Ollama cloud.
      await check(signal)
      const controller = new AbortController(), upstreamSignal = AbortSignal.any([signal, controller.signal])
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      try {
        const response = await post('/api/chat', {
          model: config.model, stream: true, think: config.think, keep_alive: config.keepAlive,
          truncate: false, shift: false,
          options: { num_ctx: config.context, num_predict: config.output, num_thread: config.threads, temperature: 0.2, seed: 42 },
          messages: [{ role: 'system', content: instructionFor(input.system, input.messages.at(-1)!.text) }, ...input.messages.map(message => ({ role: message.role, content: message.text }))],
        }, upstreamSignal)
        if (!response.ok) {
          await response.body?.cancel()
          throw new ChatError(response.status === 404 ? 'model_missing' : response.status === 400 ? 'too_large' : response.status === 429 ? 'limited' : 'unavailable')
        }
        if (!response.body) throw new ChatError('interrupted')
        reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8', { fatal: true })
        let buffer = '', length = 0
        while (true) {
          signal.throwIfAborted()
          const chunk = await reader.read()
          signal.throwIfAborted()
          buffer += decoder.decode(chunk.value, { stream: !chunk.done })
          let end: number
          while ((end = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, end); buffer = buffer.slice(end + 1)
            if (!line.trim()) continue
            if (line.length > 64000) throw new ChatError('interrupted')
            const value: unknown = JSON.parse(line)
            if (!record(value) || typeof value.done !== 'boolean' || value.error || !record(value.message) || typeof value.message.content !== 'string' || value.message.tool_calls && (!Array.isArray(value.message.tool_calls) || value.message.tool_calls.length > 0)) throw new ChatError('interrupted')
            // Deliberately ignore thinking. Never forward tool calls or parse text as commands.
            const text = value.message.content
            length += text.length
            if (length > input.maxOutputChars) throw new ChatError('output_limit')
            if (text) yield text
            if (value.done) {
              if (value.done_reason === 'length') throw new ChatError('output_limit')
              if (value.done_reason && value.done_reason !== 'stop') throw new ChatError('interrupted')
              if (!length) throw new ChatError('interrupted')
              return
            }
          }
          if (buffer.length > 64000 || chunk.done) throw new ChatError('interrupted')
        }
      } catch (error) {
        if (signal.aborted) throw signal.reason
        if (error instanceof ChatError) throw error
        throw new ChatError(reader ? 'interrupted' : 'unavailable')
      } finally { controller.abort(); await reader?.cancel().catch(() => {}); reader?.releaseLock() }
    },
  }
}
