import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createOllamaProvider, ollamaConfig } from '../backend/ollama'
import { SYSTEM_INSTRUCTION, instructionFor } from '../backend/provider'
import { createChatServer } from '../backend/server'

const config = ollamaConfig({ AI_MODEL: 'qwen3:0.6b' })
const input = { messages: [{ role: 'user' as const, text: 'สวัสดี' }], system: SYSTEM_INSTRUCTION, maxOutputChars: 12000 }
const show = { capabilities: ['completion', 'thinking'], thinking: { values: [false, true] } }
const line = (content: string, done = false, extra = {}) => JSON.stringify({ message: { role: 'assistant', content }, done, ...extra }) + '\n'
async function collect(provider: ReturnType<typeof createOllamaProvider>, signal = new AbortController().signal) { const chunks: string[] = []; for await (const text of provider.stream(input, signal)) chunks.push(text); return chunks.join('') }
test('Ollama sends local model/settings/system/text only and decodes split Thai without forwarding thinking', async () => {
  const bodies: Record<string, unknown>[] = []
  const fetcher: typeof fetch = async (url, init) => {
    expect(init!.redirect).toBe('error'); bodies.push(JSON.parse(String(init!.body)))
    if (String(url).endsWith('/api/show')) return Response.json(show)
    const bytes = new TextEncoder().encode(line('', false, { message: { role: 'assistant', content: '', thinking: 'hidden reasoning' } }) + line('สวัสดี 🌻') + line('', true, { done_reason: 'stop' }))
    return new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close() } }))
  }
  expect(await collect(createOllamaProvider(config, fetcher))).toBe('สวัสดี 🌻')
  expect(bodies[1]).toMatchObject({ model: config.model, think: false, truncate: false, shift: false, keep_alive: '1m', options: { num_ctx: 2048, num_predict: 192, num_thread: 3 }, messages: [{ role: 'system', content: instructionFor(SYSTEM_INSTRUCTION, 'สวัสดี') }, { role: 'user', content: 'สวัสดี' }] })
  expect(bodies[1]).not.toHaveProperty('tools'); expect(bodies[1]).not.toHaveProperty('images')
})
test('Ollama rejects missing/cloud/unsupported models, invalid config and never pulls or falls back', async () => {
  for (const response of [Response.json({}, { status: 404 }), Response.json({ ...show, remote_host: 'cloud' }), Response.json({ ...show, thinking: { values: ['high'] } })]) {
    let calls = 0
    const provider = createOllamaProvider(config, async () => { calls++; return response })
    await expect(collect(provider)).rejects.toThrow(); expect(calls).toBe(1)
  }
  for (const env of [{ AI_MODEL: '' }, { AI_MODEL: 'm', OLLAMA_URL: 'https://api.example.com' }, { AI_MODEL: 'm', OLLAMA_CONTEXT: '99999' }, { AI_MODEL: 'm', OLLAMA_THINK: 'maybe' }]) expect(() => ollamaConfig(env)).toThrow()
  const provider = createOllamaProvider(config, async () => { throw new Error('raw internal stack') })
  await expect(collect(provider)).rejects.toThrow('เชื่อมต่อบริการไม่ได้')
})
test('Ollama handles length cap, incomplete streams, malformed/tool/error responses as errors', async () => {
  for (const text of [line('partial'), line('partial', true, { done_reason: 'length' }), line('', true), '{invalid}\n', line('', false, { message: { content: '', tool_calls: [{ function: { name: 'click' } }] } }), JSON.stringify({ error: 'raw secret' }) + '\n']) {
    const provider = createOllamaProvider(config, async url => String(url).endsWith('/api/show') ? Response.json(show) : new Response(text))
    await expect(collect(provider)).rejects.toThrow()
  }
})
test('backend stop cancels real upstream HTTP request and reports readiness failures', async () => {
  let closed = false, available = true
  const upstream = createServer((req, res) => {
    req.resume()
    if (req.url === '/api/show') { res.writeHead(available ? 200 : 404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(show)); return }
    expect(req.url).toBe('/api/chat')
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); res.write(line('first'))
    res.once('close', () => { closed = true })
  })
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening')
  const provider = createOllamaProvider({ ...config, baseUrl: `http://127.0.0.1:${(upstream.address() as { port: number }).port}` })
  const server = createChatServer({ provider, maxConcurrent: 1 }); server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`, origin = 'http://127.0.0.1:4173'
  try {
    expect(await (await fetch(`${base}/health`)).json()).toMatchObject({ ready: true, kind: 'live', model: 'qwen3:0.6b', location: 'local' })
    const auth = await fetch(`${base}/session`, { method: 'POST', headers: { Origin: origin } })
    const response = await fetch(`${base}/chat`, { method: 'POST', headers: { Origin: origin, Cookie: auth.headers.get('set-cookie')!.split(';')[0], 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 's', operationId: 'o', messages: input.messages }) })
    const reader = response.body!.getReader(); await reader.read(); await reader.cancel()
    await expect.poll(() => closed).toBe(true)
    available = false
    expect(await (await fetch(`${base}/health`)).json()).toMatchObject({ ready: false, code: 'model_missing' })
  } finally { server.closeAllConnections(); upstream.closeAllConnections(); await Promise.all([new Promise<void>(r => server.close(() => r())), new Promise<void>(r => upstream.close(() => r()))]) }
})
