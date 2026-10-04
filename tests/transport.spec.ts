import { test, expect } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import { createTextAdapter, decodeEvents, localBackendUrl, textHistory } from '../src/workspace/transport'
import { createSessionStore } from '../src/workspace/store'
import { createMockAdapters } from '../src/workspace/adapters'
import { LIMITS, type TextEvent } from '../shared/chatProtocol'
import type { AgentRequest, SessionStore } from '../src/workspace/types'

const request: AgentRequest = { sessionId: 's', operationId: 'o', mode: 'chat', source: null, messages: [{ id: 'u', role: 'user', text: 'สวัสดี', attachments: [] }] }
const payload = textHistory(request).payload
const event = (value: object) => JSON.stringify({ sessionId: 's', operationId: 'o', ...value }) + '\n'
function stream(bytes: Uint8Array, size: number) { return new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size)); controller.close() } }) }
async function collect(text: string, size = 1) { const values: TextEvent[] = []; for await (const value of decodeEvents(stream(new TextEncoder().encode(text), size), payload, new AbortController().signal)) values.push(value); return values }
const active = (store: SessionStore) => store.getSnapshot().sessions.find(s => s.id === store.getSnapshot().sessionId)!
const settled = (store: SessionStore) => expect.poll(() => active(store).agent).not.toBe('responding')

test('NDJSON handles split UTF-8, batched lines, terminal errors/cancel and rejects incomplete or foreign/action events', async () => {
  for (const size of [1, 2, 7, 100000]) {
    const values = await collect(event({ type: 'delta', text: 'ไทย 🌻' }) + event({ type: 'delta', text: ' อีกนิด' }) + event({ type: 'done' }), size)
    expect(values).toHaveLength(3); expect(values[0]).toMatchObject({ text: 'ไทย 🌻' })
  }
  expect((await collect(event({ type: 'error', code: 'limited' })))[0].type).toBe('error')
  expect((await collect(event({ type: 'cancelled' })))[0].type).toBe('cancelled')
  for (const text of [event({ type: 'delta', text: 'partial' }), '{broken}\n', event({ type: 'done', operationId: 'wrong' }), event({ type: 'action', proposal: {} }), event({ type: 'error', code: 'SECRET' }), 'a'.repeat(LIMITS.lineChars + 1)]) await expect(collect(text, 100000)).rejects.toThrow()
})
test('abort cancels the reader and emits no delayed delta', async () => {
  const abort = new AbortController(); let cancelled = false
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(event({ type: 'delta', text: 'first' }))) }, cancel() { cancelled = true } })
  const iterator = decodeEvents(body, payload, abort.signal)[Symbol.asyncIterator]()
  expect((await iterator.next()).value).toMatchObject({ text: 'first' })
  const pending = iterator.next(); abort.abort()
  await expect(pending).rejects.toThrow(); expect(cancelled).toBe(true)
})
test('history is a bounded whole-message suffix, drops partial replies and rejects non-text payloads', () => {
  const messages: AgentRequest['messages'] = Array.from({ length: 40 }, (_, i) => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', text: String(i) + 'x'.repeat(1500), responseStatus: 'complete', attachments: [] }))
  messages.push({ id: 'latest', role: 'user', text: 'latest', attachments: [] })
  const result = textHistory({ ...request, messages })
  expect(result.omitted).toBe(true); expect(result.payload.messages.at(-1)!.text).toBe('latest'); expect(result.payload.messages[0].role).toBe('user')
  expect(result.payload.messages.length).toBeLessThanOrEqual(LIMITS.messages)
  expect(result.payload.messages.reduce((n, m) => n + m.text.length, 0)).toBeLessThanOrEqual(LIMITS.totalChars)
  expect(result.payload.messages.every(m => m.text === 'latest' || m.text.endsWith('x'.repeat(1500)))).toBe(true)
  for (const responseStatus of ['stopped', 'error', 'streaming'] as const) expect(textHistory({ ...request, messages: [{ id: 'p', role: 'assistant', text: 'partial', attachments: [], responseStatus }, ...request.messages] }).payload.messages).toHaveLength(1)
  expect(() => textHistory({ ...request, source: { id: 'source', kind: 'window', name: 'screen' } })).toThrow()
  expect(() => textHistory({ ...request, messages: [{ ...request.messages[0], attachments: [{ kind: 'link', name: 'link', url: 'https://example.com' }] }] })).toThrow()
  expect(() => textHistory({ ...request, messages: [{ ...request.messages[0], text: 'a'.repeat(8001) }] })).toThrow()
})
test('transport/store retry creates new operations, keeps history isolated and never falls back to demo', async () => {
  let fail = true; const sent: typeof payload[] = []
  const fetcher: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init!.body)); sent.push(body)
    if (fail) throw new Error('raw secret internal failure')
    return new Response(JSON.stringify({ sessionId: body.sessionId, operationId: body.operationId, type: 'delta', text: 'ตอบจาก transport' }) + '\n' + JSON.stringify({ sessionId: body.sessionId, operationId: body.operationId, type: 'done' }) + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } })
  }
  const store = createSessionStore(createMockAdapters(), createTextAdapter('http://local', fetcher))
  store.setDraft('demo history'); store.send(); await settled(store)
  store.newSession('test'); store.setDraft('backend text'); store.send(); await settled(store)
  expect(active(store).agent).toBe('error'); expect(active(store).error).not.toContain('secret'); expect(active(store).messages).toHaveLength(1)
  fail = false; store.retry(); await settled(store)
  expect(active(store).messages.filter(m => m.role === 'user')).toHaveLength(1)
  expect(active(store).messages.at(-1)!.text).toBe('ตอบจาก transport')
  expect(sent[0].operationId).not.toBe(sent[1].operationId)
  expect(sent.every(r => r.messages.length === 1 && r.messages[0].text === 'backend text')).toBe(true)
  store.setMode('assist'); store.selectSource('window'); expect(active(store).mode).toBe('chat'); expect(active(store).source).toBeNull()
  expect(() => store.addLink('https://example.com')).toThrow()
  store.dispose()
})
test('public host cannot enable local/live endpoint and frontend bundle excludes server code/secrets', async () => {
  expect(localBackendUrl('tanapat1604-cmd.github.io', 'https://api.example.com')).toBeNull()
  expect(localBackendUrl('127.0.0.1', 'https://api.example.com')).toBeNull()
  expect(localBackendUrl('127.0.0.1')).toBe('http://127.0.0.1:8787')
  const files = (await readdir('dist/assets')).filter(file => file.endsWith('.js'))
  const bundle = (await Promise.all(files.map(file => readFile(`dist/assets/${file}`, 'utf8')))).join('')
  for (const value of ['stage3-secret-sentinel-not-a-real-key', 'You receive TEXT ONLY.', 'node:crypto', 'cic_local=']) expect(bundle).not.toContain(value)
})
