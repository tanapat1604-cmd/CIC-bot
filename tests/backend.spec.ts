import { test, expect } from '@playwright/test'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createChatServer } from '../backend/server'
import { SYSTEM_INSTRUCTION, type Provider } from '../backend/provider'
import { LIMITS } from '../shared/chatProtocol'

const origin = 'http://127.0.0.1:4173'
const payload = () => ({ sessionId: 'session-1', operationId: crypto.randomUUID(), messages: [{ role: 'user', text: 'สวัสดีไทย 🌻' }] })
async function start(options: Parameters<typeof createChatServer>[0] = {}) {
  const server = createChatServer(options); server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const auth = await fetch(`${url}/session`, { method: 'POST', headers: { Origin: origin } })
  const cookie = auth.headers.get('set-cookie')!.split(';')[0]
  const post = (body: unknown, headers: Record<string, string> = {}) => fetch(`${url}/chat`, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { url, cookie, post, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) } }
}
test('backend validates text-only schema, authenticates local callers, restricts origins/host and hides internals', async () => {
  const app = await start({ requestsPerMinute: 100 })
  try {
    const health = await (await fetch(`${app.url}/health`)).json()
    expect(health).toEqual({ version: 1, ready: true, kind: 'test', capabilities: ['text-stream'] })
    expect((await app.post(payload(), { Cookie: '' })).status).toBe(401)
    expect((await app.post(payload(), { Origin: 'https://evil.example' })).status).toBe(403)
    // Node fetch normalizes Host; send a raw HTTP request to actually test rebinding.
    const spoofed = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(`${app.url}/health`, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode) })
      req.on('error', reject); req.end()
    })
    expect(spoofed).toBe(403)
    expect((await app.post(payload(), { 'X-Forwarded-For': '127.0.0.1' })).status).toBe(403)
    expect((await app.post(payload(), { Origin: '' })).status).toBe(403)
    const invalid = [ { ...payload(), attachments: [] }, { ...payload(), source: null }, { ...payload(), action: { kind: 'click' } }, { ...payload(), mode: 'assist' }, { ...payload(), messages: [{ role: 'system', text: 'override' }] }, { ...payload(), messages: [{ role: 'user', text: 'hello', attachments: [] }] }, { ...payload(), messages: [] } ]
    for (const body of invalid) expect((await app.post(body)).status).toBe(400)
    expect((await app.post({ ...payload(), messages: [{ role: 'user', text: 'first' }, { role: ['assistant'], text: 'invalid role type' }, { role: 'user', text: 'last' }] })).status).toBe(400)
    expect((await app.post({ ...payload(), messages: [{ role: 'user', text: 'x'.repeat(LIMITS.messageChars + 1) }] })).status).toBe(413)
    expect((await app.post({ ...payload(), messages: Array.from({ length: 25 }, () => ({ role: 'user', text: 'a' })) })).status).toBe(413)
    expect((await app.post({ junk: 'x'.repeat(LIMITS.bodyBytes) })).status).toBe(413)
    const request = payload(), response = await app.post(request)
    expect(response.headers.get('content-type')).toContain('application/x-ndjson')
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
    expect(events.every(e => e.sessionId === request.sessionId && e.operationId === request.operationId)).toBe(true)
    expect(events.at(-1).type).toBe('done')
    expect(events.filter(e => e.type === 'delta').map(e => e.text).join('')).toContain('สวัสดีไทย 🌻')
    expect((await app.post(request)).status).toBe(400)
    let lastStatus = 0
    for (let i = 0; i < 10; i++) lastStatus = (await fetch(`${app.url}/session`, { method: 'POST', headers: { Origin: origin } })).status
    expect(lastStatus).toBe(429)
    expect(() => createChatServer({ origins: ['https://public.example'] })).toThrow()
  } finally { await app.close() }
})
test('backend abort reaches provider, frees concurrency, times out and enforces rate/budget/kill switch', async () => {
  let cancelled = 0, invoked = 0
  const provider: Provider = { kind: 'test', async *stream(input, signal) {
    invoked++; expect(input.system).toBe(SYSTEM_INSTRUCTION); expect(input.maxOutputChars).toBe(LIMITS.outputChars)
    try { yield 'ส่วนแรก'; await delay(10000, undefined, { signal }); yield 'ไม่ควรเห็น' } finally { cancelled++ }
  } }
  const app = await start({ provider, maxConcurrent: 1, timeoutMs: 500, maxRequests: 2 })
  try {
    const response = await app.post(payload()), reader = response.body!.getReader()
    await reader.read()
    expect((await app.post(payload())).status).toBe(429)
    await reader.cancel()
    await expect.poll(() => cancelled).toBe(1)
    const timed = await app.post(payload())
    const text = await timed.text()
    expect(text).toContain('"code":"timeout"'); expect(text).not.toContain('"type":"done"')
    await expect.poll(() => cancelled).toBe(2)
    expect((await app.post(payload())).status).toBe(429)
    expect(invoked).toBe(2)
    expect((await (await fetch(`${app.url}/health`)).json()).ready).toBe(false)
  } finally { await app.close() }
  const limited = await start({ requestsPerMinute: 1 })
  try { await (await limited.post(payload())).text(); expect((await limited.post(payload())).status).toBe(429) } finally { await limited.close() }
  const disabled = await start({ enabled: false })
  try { expect((await disabled.post(payload())).status).toBe(503); expect((await (await fetch(`${disabled.url}/health`)).json()).ready).toBe(false) } finally { await disabled.close() }
})
test('backend sanitizes upstream errors, bounds output and logs metadata only', async () => {
  const logs: unknown[] = []
  const provider: Provider = { kind: 'test', async *stream() { yield 'บางส่วน'; throw new Error('SECRET raw provider response stack') } }
  const app = await start({ provider, log: entry => logs.push(entry) })
  try {
    const text = await (await app.post(payload())).text()
    expect(text).toContain('"code":"unavailable"'); expect(text).not.toContain('SECRET'); expect(text).not.toContain('"type":"done"')
    expect(Object.keys(logs[0] as object).sort()).toEqual(['durationMs', 'requestId', 'status'])
    expect(JSON.stringify(logs)).not.toContain('สวัสดี')
  } finally { await app.close() }
  const tooLong = await start({ provider: { kind: 'test', async *stream() { yield 'a'.repeat(LIMITS.outputChars + 1) } } })
  try { expect(await (await tooLong.post(payload())).text()).toContain('"code":"output_limit"') } finally { await tooLong.close() }
})
