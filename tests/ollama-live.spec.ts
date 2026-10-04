import { test, expect } from '@playwright/test'
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { createChatServer } from '../backend/server'
import { createOllamaProvider, ollamaConfig } from '../backend/ollama'

// Explicit opt-in, local installed model only. CI never starts/downloads a model.
test('installed Ollama answers in the app, follows chat history, stops upstream and retries once', async ({ page }) => {
  test.skip(process.env.CIC_TEST_OLLAMA !== '1', 'Requires explicit local-model test opt-in')
  test.setTimeout(90000)
  const signals: AbortSignal[] = [], logs: { status: string }[] = [], payloads: { messages: { role: string; content: string }[] }[] = []
  let failNext = false
  const provider = createOllamaProvider(ollamaConfig({ AI_MODEL: process.env.AI_MODEL || 'qwen3:0.6b' }), async (url, init) => {
    if (String(url).endsWith('/api/chat')) {
      if (failNext) { failNext = false; throw new Error('controlled connection outage') }
      signals.push(init!.signal as AbortSignal); payloads.push(JSON.parse(String(init!.body)))
    }
    return fetch(url, init)
  })
  const server = createChatServer({ provider, maxConcurrent: 1, log: entry => logs.push(entry) })
  server.listen(8787, '127.0.0.1'); await once(server, 'listening')
  const network: string[] = [], errors: string[] = []
  page.on('request', req => network.push(req.url())); page.on('pageerror', error => errors.push(error.message))
  const send = async (text: string) => { await page.getByRole('textbox', { name: 'ข้อความถึง CIC' }).fill(text); await page.getByRole('button', { name: 'ส่งข้อความ', exact: true }).click() }
  try {
    await page.goto('./#/app')
    await page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true }).click()
    await page.getByRole('button', { name: 'ตรวจการเชื่อมต่อ backend', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('qwen3:0.6b')
    await page.getByRole('button', { name: 'เริ่มแชต AI ในเครื่อง', exact: true }).click()
    await expect(page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true })).toHaveText('AI ในเครื่อง')
    await send('ตอบเพียงคำว่า สวัสดี')
    const replies = page.getByRole('article', { name: 'คำตอบ CIC', exact: true })
    await expect(page.getByRole('button', { name: 'หยุดงาน', exact: true })).toBeDisabled({ timeout: 30000 })
    await expect(replies.last()).toContainText('สวัสดี')
    await expect(replies.last()).toContainText('AI ในเครื่อง · qwen3:0.6b')
    await send('เมื่อกี้ฉันขอให้คุณพูดคำว่าอะไร ตอบสั้น ๆ')
    await expect(page.getByRole('button', { name: 'หยุดงาน', exact: true })).toBeDisabled({ timeout: 30000 })
    await expect(replies.last()).toContainText('สวัสดี')
    expect(payloads[1].messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    await page.screenshot({ path: 'test-results/ollama-live-chat.png' })
    await send('Write a detailed list of 50 small programming tasks, one sentence each.')
    await expect(page.getByText('กำลังทยอยตอบ…', { exact: true })).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'หยุดงาน', exact: true }).click()
    await expect.poll(() => logs.at(-1)?.status).toBe('cancelled')
    expect(signals.at(-1)?.aborted).toBe(true)
    await expect(replies.last()).toContainText('หยุดกลางทาง')
    const partial = await replies.last().textContent(); await page.waitForTimeout(500)
    expect(await replies.last().textContent()).toBe(partial)
    failNext = true
    await send('2 บวก 3 เท่ากับเท่าไร ตอบสั้น ๆ')
    await expect(page.getByRole('alert')).toContainText('เชื่อมต่อบริการไม่ได้')
    const users = await page.getByRole('article', { name: 'ข้อความของคุณ' }).count()
    await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click()
    await expect(page.getByRole('button', { name: 'หยุดงาน', exact: true })).toBeDisabled({ timeout: 30000 })
    await expect(replies.last()).toContainText('5')
    await expect(page.getByRole('article', { name: 'ข้อความของคุณ' })).toHaveCount(users)
    expect(payloads.at(-1)!.messages.filter(m => m.role === 'assistant')).toHaveLength(2)
    expect(network.some(url => url.includes(':11434'))).toBe(false)
    expect(errors).toEqual([])
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('textbox', { name: 'ข้อความถึง CIC' })).toBeInViewport()
    await page.screenshot({ path: 'test-results/ollama-live-mobile.png' })
    await writeFile('test-results/ollama-live.json', JSON.stringify({ model: provider.model, actualReplies: await replies.allTextContents(), stoppedUpstream: true, noDuplicateRetry: true, browserCallsOllamaDirectly: false, logs, errors }, null, 2))
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
