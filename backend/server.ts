import { CIC_CAPABILITIES } from '../shared/capabilities.js'
import { resolveTextUtility } from './textUtilities.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { ChatError, LIMITS, validateRequest, type ErrorCode, type TextEvent } from '../shared/chatProtocol.js'
import { SYSTEM_INSTRUCTION, testProvider, type Provider } from './provider.js'

type Options = { origins?: string[]; provider?: Provider; timeoutMs?: number; requestsPerMinute?: number; maxRequests?: number; maxConcurrent?: number; enabled?: boolean; log?: (entry: { requestId: string; status: string; durationMs: number }) => void }
type Access = { expires: number; active: number; window: number; count: number; operations: Set<string> }
const loopback = (address?: string) => address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
export function createChatServer(options: Options = {}) {
  const origins = options.origins ?? ['http://127.0.0.1:5173', 'http://127.0.0.1:4173']
  // Local trust boundary only. Public deployment needs a separately reviewed identity layer.
  if (origins.some(origin => { const url = new URL(origin); return url.origin !== origin || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' })) throw new Error('Only explicit 127.0.0.1 development origins are supported')
  const provider = options.provider ?? testProvider
  const access = new Map<string, Access>(), controllers = new Set<AbortController>()
  let active = 0, spent = 0, bootstrapWindow = Date.now(), bootstraps = 0
  const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
  // Drain rejected bodies without buffering so HTTP clients can receive the error
  // before reusing/closing the socket; requestTimeout bounds unfinished uploads.
  const fail = (res: ServerResponse, status: number, code: ErrorCode) => { res.req.resume(); json(res, status, { code }) }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
    // Reject DNS rebinding, proxies and non-loopback peers before all endpoints.
    const port = (server.address() as { port: number }).port
    if (!loopback(req.socket.remoteAddress) || req.headers.host !== `127.0.0.1:${port}` || req.headers['x-forwarded-for'] || req.headers.forwarded) { fail(res, 403, 'unauthorized'); return }
    const origin = req.headers.origin
    if (origin && !origins.includes(origin)) { fail(res, 403, 'unauthorized'); return }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin') }
    if (req.method === 'OPTIONS' && origin) { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); res.end(); return }
    if (req.url === '/health' && req.method === 'GET') {
      let ready = options.enabled !== false && spent < (options.maxRequests ?? 100)
      let code: ErrorCode | undefined
      const probe = new AbortController(), closed = () => probe.abort()
      res.once('close', closed)
      try { if (ready) await provider.check?.(AbortSignal.any([probe.signal, AbortSignal.timeout(2500)])) }
      catch (error) { ready = false; code = error instanceof ChatError ? error.code : 'unavailable' }
      finally { res.off('close', closed); probe.abort() }
      if (!res.destroyed) json(res, 200, { version: 1, ready, kind: provider.kind, capabilities: ['text-stream'], ...(provider.kind === 'live' ? { capabilityProfile: CIC_CAPABILITIES } : {}), ...(provider.model ? { model: provider.model, location: 'local' } : {}), ...(code ? { code } : {}) })
      return
    }
    // No shared secret in the frontend: issue a short-lived HttpOnly local session.
    // Any trusted local process can bootstrap; this is not public user authentication.
    if (!origin || req.method !== 'POST') { fail(res, 403, 'unauthorized'); return }
    if (req.url === '/session') {
      if (Number(req.headers['content-length'] ?? 0) !== 0 || req.headers['transfer-encoding']) { fail(res, 400, 'invalid'); return }
      const now = Date.now()
      for (const [token, session] of access) if (session.expires < now && !session.active) access.delete(token)
      if (now - bootstrapWindow > 60000) { bootstrapWindow = now; bootstraps = 0 }
      if (++bootstraps > 10 || access.size >= 32) { fail(res, 429, 'limited'); return }
      const token = randomBytes(32).toString('hex')
      access.set(token, { expires: now + 600000, active: 0, window: now, count: 0, operations: new Set() })
      res.setHeader('Set-Cookie', `cic_local=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`)
      json(res, 200, { ready: true }); return
    }
    if (req.url !== '/chat') { fail(res, 404, 'invalid'); return }
    const token = /(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]
    const session = token ? access.get(token) : undefined
    if (!session || session.expires < Date.now()) { fail(res, 401, 'unauthorized'); return }
    if (options.enabled === false) { fail(res, 503, 'unavailable'); return }
    if (spent >= (options.maxRequests ?? 100)) { fail(res, 429, 'limited'); return }
    if (Date.now() - session.window > 60000) { session.window = Date.now(); session.count = 0 }
    if (session.active || active >= (options.maxConcurrent ?? 2) || ++session.count > (options.requestsPerMinute ?? 10)) { fail(res, 429, 'limited'); return }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['content-encoding']) { fail(res, 400, 'invalid'); return }
    const controller = new AbortController(), requestId = randomUUID(), start = Date.now()
    const closed = () => controller.abort()
    res.once('close', closed); controllers.add(controller); active++; session.active++
    let timeout = false, status = 'error', identity: { sessionId: string; operationId: string } | undefined
    const timer = setTimeout(() => { timeout = true; controller.abort() }, options.timeoutMs ?? 30000)
    const event = async (value: TextEvent) => {
      if (res.destroyed) return
      if (!res.write(JSON.stringify(value) + '\n')) await once(res, 'drain', { signal: controller.signal })
    }
    try {
      const request = validateRequest(await readBody(req, controller.signal))
      if (spent >= (options.maxRequests ?? 100)) throw new ChatError('limited')
      identity = { sessionId: request.sessionId, operationId: request.operationId }
      if (session.operations.has(request.operationId)) throw new ChatError('invalid')
      session.operations.add(request.operationId); spent++
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' })
      res.flushHeaders()
      let length = 0
      const utility = provider.kind === 'live' ? resolveTextUtility(request.messages.at(-1)!.text, request.messages) : null
      const responseSource = utility?.source ?? 'model'
      const stream = utility ? (async function* () { controller.signal.throwIfAborted(); yield utility.text })() : provider.stream({ messages: request.messages, system: SYSTEM_INSTRUCTION, maxOutputChars: LIMITS.outputChars }, controller.signal)
      const iterator = stream[Symbol.asyncIterator]()
      try {
        while (true) {
          const next = await abortable(iterator.next(), controller.signal)
          if (next.done) break
          if (typeof next.value !== 'string') throw new ChatError('unavailable')
          if (!next.value) continue
          length += next.value.length
          if (length > LIMITS.outputChars) throw new ChatError('output_limit')
          await event({ ...identity, type: 'delta', text: next.value })
        }
        await event({ ...identity, type: 'done', ...(provider.kind === 'live' ? { source: responseSource } : {}) }); status = 'done'
      } finally { controller.abort(); void iterator.return?.().catch(() => {}) }
    } catch (error) {
      const code = timeout ? 'timeout' : error instanceof ChatError ? error.code : 'unavailable'
      status = res.destroyed ? 'cancelled' : code
      if (!res.destroyed) {
        if (res.headersSent && identity) res.write(JSON.stringify({ ...identity, type: 'error', code }) + '\n')
        else fail(res, code === 'too_large' ? 413 : code === 'invalid' ? 400 : code === 'limited' ? 429 : 503, code)
      }
    } finally {
      clearTimeout(timer); controller.abort(); res.off('close', closed); controllers.delete(controller); session.active--; active--
      if (!res.writableEnded && !res.destroyed) res.end()
      options.log?.({ requestId, status, durationMs: Date.now() - start })
    }
  })
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 30
  server.on('close', () => { controllers.forEach(controller => controller.abort()); access.clear() })
  return server
}
async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let listener: () => void = () => {}
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { listener = () => reject(signal.reason); signal.addEventListener('abort', listener, { once: true }) })]) }
  finally { signal.removeEventListener('abort', listener) }
}
async function readBody(req: IncomingMessage, signal: AbortSignal) {
  if (Number(req.headers['content-length'] ?? 0) > LIMITS.bodyBytes) throw new ChatError('too_large')
  const chunks: Buffer[] = []; let size = 0
  const iterator = req[Symbol.asyncIterator]()
  while (true) {
    const chunk = await abortable(iterator.next(), signal)
    if (chunk.done) break
    size += chunk.value.length
    if (size > LIMITS.bodyBytes) throw new ChatError('too_large')
    chunks.push(chunk.value)
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) }
  catch { throw new ChatError('invalid') }
}
