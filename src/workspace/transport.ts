import { CIC_CAPABILITIES } from '../../shared/capabilities'
import { ChatError, errors, LIMITS, record, validateEvent, validateRequest, type TextEvent, type TextMessage, type TextRequest } from '../../shared/chatProtocol'
import type { AgentAdapter, AgentRequest } from './types'

export function textHistory(request: AgentRequest): { payload: TextRequest; omitted: boolean } {
  if (request.mode !== 'chat' || request.source || request.messages.some(message => message.attachments.length)) throw new ChatError('invalid')
  const complete = request.messages.filter(message => message.role === 'user' || message.responseStatus === 'complete')
  const messages: TextMessage[] = []; let size = request.ocrReference?.text.length ?? 0
  for (let i = complete.length - 1; i >= 0; i--) {
    const message = complete[i]
    if (message.text.length > LIMITS.messageChars || messages.length >= LIMITS.messages || size + message.text.length > LIMITS.totalChars) {
      if (!messages.length) throw new ChatError('too_large')
      break
    }
    messages.unshift({ role: message.role, text: message.text }); size += message.text.length
  }
  // Keep a whole-message suffix, starting with a user and always retaining the latest request.
  while (messages[0]?.role === 'assistant') messages.shift()
  return { payload: validateRequest({ sessionId: request.sessionId, operationId: request.operationId, messages, ...(request.ocrReference?{reference:{...request.ocrReference}}:{}) }), omitted: messages.length !== request.messages.length }
}

export async function* decodeEvents(body: ReadableStream<Uint8Array>, request: TextRequest, signal: AbortSignal): AsyncIterable<TextEvent> {
  const reader = body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = '', terminal = false, output = 0
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const chunk = await reader.read()
      signal.throwIfAborted()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1)
        if (!line.trim()) continue
        if (line.length > LIMITS.lineChars) throw new ChatError('interrupted')
        const event = validateEvent(JSON.parse(line), request)
        if (event.type === 'delta') { output += event.text.length; if (output > LIMITS.outputChars) throw new ChatError('output_limit') }
        else terminal = true
        yield event
        if (terminal) return
      }
      if (buffer.length > LIMITS.lineChars) throw new ChatError('interrupted')
      if (chunk.done) { if (!terminal) throw new ChatError('interrupted'); return }
    }
  } catch (error) {
    if (signal.aborted || error instanceof ChatError) throw error
    throw new ChatError('interrupted')
  } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock() }
}

function responseError(status: number) { return new ChatError(status === 401 || status === 403 ? 'unauthorized' : status === 413 ? 'too_large' : status === 429 ? 'limited' : status === 400 ? 'invalid' : 'unavailable') }
export function createTextAdapter(baseUrl: string, fetcher: typeof fetch = fetch): AgentAdapter {
  return {
    async *respond(request, signal) {
      const { payload } = textHistory(request)
      // Time bound applies to headers and the entire stream; abort is also propagated upstream.
      const combined = AbortSignal.any([signal, AbortSignal.timeout(35000)])
      try {
        const response = await fetcher(`${baseUrl}/chat`, { method: 'POST', redirect:'error', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: combined })
        if (!response.ok) { let code:unknown;try{const error:unknown=await response.json();if(record(error))code=error.code}catch{/* Generic error. */}if(typeof code==='string'&&Object.hasOwn(errors,code))throw new ChatError(code as keyof typeof errors);throw responseError(response.status) }
        if (!response.headers.get('content-type')?.startsWith('application/x-ndjson') || !response.body) { await response.body?.cancel(); throw new ChatError('interrupted') }
        for await (const event of decodeEvents(response.body, payload, combined)) {
          if (event.type === 'error') yield { sessionId: event.sessionId, operationId: event.operationId, type: 'error', message: errors[event.code] }
          else yield event
        }
      } catch (error) {
        if (signal.aborted) throw signal.reason
        if (error instanceof ChatError) throw error
        throw new ChatError(combined.aborted ? 'timeout' : 'unavailable')
      }
    },
  }
}
export type BackendCapability = { kind: 'test' | 'live'; model?: string }
export async function connectBackend(baseUrl: string, signal: AbortSignal): Promise<BackendCapability> {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal, credentials: 'include' })
    if (!response.ok) throw responseError(response.status)
    const value: unknown = await response.json()
    if (record(value) && value.ready === false && typeof value.code === 'string' && Object.hasOwn(errors, value.code)) throw new ChatError(value.code as keyof typeof errors)
    if (!record(value) || value.version !== 1 || value.ready !== true || (value.kind !== 'test' && value.kind !== 'live') || !Array.isArray(value.capabilities) || !value.capabilities.includes('text-stream')) throw new ChatError('unavailable')
    if (value.kind === 'live' && (value.location !== 'local' || typeof value.model !== 'string' || !/^[a-zA-Z0-9][\w.:/-]{0,119}$/.test(value.model))) throw new ChatError('unavailable')
    if (value.kind === 'live' && (!record(value.capabilityProfile) || Object.entries(CIC_CAPABILITIES).some(([key, expected]) => (value.capabilityProfile as Record<string, unknown>)[key] !== expected))) throw new ChatError('unavailable')
    const session = await fetch(`${baseUrl}/session`, { method: 'POST', credentials: 'include', signal })
    if (!session.ok) throw responseError(session.status)
    return { kind: value.kind, ...(value.kind === 'live' ? { model: value.model as string } : {}) }
  } catch (error) { if (error instanceof ChatError) throw error; throw new ChatError('unavailable') }
}
// Stage 3A intentionally cannot enable a public paid endpoint by changing a VITE variable.
export function localBackendUrl(hostname: string, configured?: string): string | null {
  if (hostname !== '127.0.0.1') return null
  try { const url = new URL(configured || 'http://127.0.0.1:8787'); return url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null }
  catch { return null }
}
