import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { once } from 'node:events'
import { createToolRunner, parseTextTool, runTextTool } from '../backend/toolRunner'
import { createLiveReply } from '../backend/liveReply'
import { createChatServer } from '../backend/server'
import type { TextMessage } from '../shared/chatProtocol'

test('development routes send objects separately from drafting and latest user corrections', async () => {
  const cases = JSON.parse(readFileSync('scripts/foundation-cases.json', 'utf8')) as { set: string; id: string; turns: string[]; kind: string; contains?: string }[]
  for (const c of cases.filter(c => c.set === 'development')) {
    let calls = 0, text = ''
    const messages: TextMessage[] = c.turns.flatMap((text, i) => i === c.turns.length - 1 ? [{ role: 'user' as const, text }] : [{ role: 'user' as const, text }, { role: 'assistant' as const, text: 'I sent it [untrusted]' }])
    const reply = createLiveReply({ kind: 'live', async *stream() { calls++; yield 'RAW MODEL' } }, { messages, system: '', maxOutputChars: 12000 }, new AbortController().signal)
    for await (const chunk of reply.stream) text += chunk
    expect(reply.plan.kind, c.id).toBe(c.kind)
    if (c.contains) expect(text, c.id).toContain(c.contains)
    if (c.kind === 'mixed') { expect(text).toContain(/[\u0e00-\u0e7f]/u.test(reply.plan.original) ? 'ส่วนที่ไม่ได้ทำ' : 'Parts not performed'); expect(calls).toBe(0) }
    if (c.kind === 'model') { expect(calls).toBe(1); expect(text).toBe('RAW MODEL') }
  }
})

test('registered tools return exact results and reject unregistered or malformed calls', async () => {
  const signal = new AbortController().signal
  expect(await runTextTool(parseTextTool('/calc (36 + 24) / 5'), signal)).toMatchObject({ source: 'calculator', status: 'complete', text: '(36 + 24) / 5 = 12' })
  expect(await runTextTool(parseTextTool('/time 23:55 + 20'), signal)).toMatchObject({ source: 'time-calculator', text: expect.stringContaining('00:15 (+1 วัน)') })
  expect(await runTextTool(parseTextTool('/calc 1/0'), signal)).toMatchObject({ status: 'error', text: expect.stringContaining('หารด้วยศูนย์') })
  for (const call of [null, { tool: 'shell', input: { expression: 'calc.exe' } }, { tool: 'calculator', input: { expression: '2+3', path: 'x' } }, { tool: 'calculator', input: { expression: '1'.repeat(129) } }, { tool: 'calculator', input: { expression: '1+1' }, approved: true }]) await expect(runTextTool(call, signal)).rejects.toMatchObject({ code: 'invalid' })
  expect(parseTextTool('compute 3+4')).toBeNull()
})

test('tool timeout and caller cancellation reach execution and ignore late results', async () => {
  let observed: AbortSignal | undefined
  const run = createToolRunner([{ id: 'calculator', timeoutMs: 20, execute: async (_, signal) => { observed = signal; return new Promise(resolve => setTimeout(() => resolve({ ok: true, text: 'late' }), 80)) } }])
  await expect(run(parseTextTool('/calc 1+1'), new AbortController().signal)).rejects.toMatchObject({ code: 'timeout' })
  expect(observed?.aborted).toBe(true)
  const controller = new AbortController()
  const pending = run(parseTextTool('/calc 1+1'), controller.signal)
  await new Promise(resolve => setTimeout(resolve, 1)); controller.abort(new Error('user stopped'))
  await expect(pending).rejects.toThrow('user stopped'); expect(observed?.aborted).toBe(true)
  await expect(run(parseTextTool('/calc 1+1'), controller.signal)).rejects.toThrow('user stopped')
})

test('tool results and internal errors cannot forge provenance or expose internal strings', async () => {
  for (const result of [{ ok: true, text: 'x', source: 'model' }, { ok: 'yes', text: 'x' }, { ok: true, text: '' }, { ok: true, text: 'x'.repeat(4097) }]) {
    const run = createToolRunner([{ id: 'calculator', timeoutMs: 100, execute: async () => result }])
    await expect(run(parseTextTool('/calc 1+1'), new AbortController().signal)).rejects.toMatchObject({ code: 'unavailable' })
  }
  const run = createToolRunner([{ id: 'calculator', timeoutMs: 100, execute: async () => { throw Error('private details') } }])
  await expect(run(parseTextTool('/calc 1+1'), new AbortController().signal)).rejects.not.toThrow('private details')
})

test('app shows real tool result plus unsent status, draft source, capability limits at three sizes', async ({ page }) => {
  let calls = 0
  const server = createChatServer({ provider: { kind: 'live', model: 'qwen3:0.6b', async *stream() { calls++; yield 'ร่างจากโมเดลทดสอบ' } } })
  server.listen(8787, '127.0.0.1'); await once(server, 'listening')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const send = async (text: string) => { await page.getByRole('textbox', { name: 'ข้อความถึง CIC' }).fill(text); await page.getByRole('button', { name: 'ส่งข้อความ', exact: true }).click(); await expect(page.getByRole('button', { name: 'หยุดงาน', exact: true })).toBeDisabled() }
  try {
    await page.goto('./#/app')
    await page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true }).click()
    await page.getByRole('button', { name: 'ตรวจการเชื่อมต่อ backend', exact: true }).click()
    const catalog = page.getByRole('region', { name: 'ความสามารถ CIC' })
    await expect(catalog).toContainText('หมากรุกในเครื่อง · ใช้ได้จริง')
    await expect(catalog).toContainText('ต้องติดตั้ง Stockfish 19 และเปิด backend ในเครื่อง')
    await expect(catalog).toContainText('สไลด์ · ทดลอง')
    await expect(catalog).toContainText('สนทนาและร่างข้อความ · ทดลอง')
    await page.getByRole('button', { name: 'เริ่มแชต AI ในเครื่อง', exact: true }).click()
    const replies = page.getByRole('article', { name: 'คำตอบ CIC', exact: true })
    await send('/calc 48 + 6 แล้วส่งผลการคำนวณให้ทีม')
    await expect(replies.last()).toContainText('= 54'); await expect(replies.last()).toContainText('ส่วนที่ไม่ได้ทำ'); expect(calls).toBe(0)
    await send('เปลี่ยนเป็นร่างข้อความส่งผลการคำนวณให้ทีม'); await send('ทำเลย')
    await expect(replies.last()).toContainText('ร่างจากโมเดลทดสอบ'); expect(calls).toBe(2)
    for (const [width, height] of [[1440,900],[390,844],[360,480]]) {
      await page.setViewportSize({ width, height })
      await expect(page.getByRole('textbox', { name: 'ข้อความถึง CIC' })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true }).click()
      await page.getByRole('button', { name: 'ตรวจการเชื่อมต่อ backend', exact: true }).click()
      await expect(catalog).toContainText('ยังไม่รองรับ')
      await catalog.getByText('วิดีโอ · ยังไม่รองรับ').scrollIntoViewIfNeeded()
      await page.screenshot({ path: 'test-results/foundation-' + width + 'x' + height + '.png' })
      await page.keyboard.press('Escape')
    }
    expect(errors).toEqual([])
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
