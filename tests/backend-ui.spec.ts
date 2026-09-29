import { test, expect, type Page } from '@playwright/test'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { createChatServer } from '../backend/server'
import type { Provider } from '../backend/provider'

async function start(provider?: Provider) {
  const server = createChatServer({ provider }); server.listen(8787, '127.0.0.1'); await once(server, 'listening')
  return async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
}
async function connect(page: Page) {
  await page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true }).click()
  await page.getByRole('button', { name: 'ตรวจการเชื่อมต่อ backend', exact: true }).click()
  await expect(page.getByText('เชื่อมต่อ backend ทดสอบในเครื่องสำเร็จ · ไม่ใช่ AI จริง', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'เริ่มแชตทดสอบ backend', exact: true }).click()
}
async function send(page: Page, text: string) { await page.getByRole('textbox', { name: 'ข้อความถึง CIC' }).fill(text); await page.getByRole('button', { name: 'ส่งข้อความ', exact: true }).click() }
test('browser connects to local backend, isolates demo history and keeps text-only UI usable at four sizes', async ({ page }) => {
  const close = await start(), requests: unknown[] = [], errors: string[] = []
  page.on('request', request => { if (request.url().endsWith('/chat')) requests.push(request.postDataJSON()) })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto('./#/app'); await send(page, 'วางแผนงาน demo ที่ไม่ส่ง backend')
    await expect(page.getByRole('button', { name: 'หยุดงาน', exact: true })).toBeDisabled()
    await connect(page)
    await expect(page.getByRole('button', { name: 'ช่วยทำ', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'ให้ดู', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'รูปภาพ', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'ลิงก์', exact: true })).toBeDisabled()
    await expect(page.getByRole('article')).toHaveCount(0)
    await send(page, 'สวัสดี จากข้อความ https://example.com')
    const reply = page.getByRole('article', { name: 'คำตอบทดสอบ backend', exact: true })
    await expect(reply).toContainText('คำตอบทดสอบ backend — ไม่ใช่ AI จริง')
    await expect(page.getByRole('button', { name: 'หยุดงาน', exact: true })).toBeDisabled()
    expect(requests).toHaveLength(1)
    expect(JSON.stringify(requests)).not.toContain('demo ที่ไม่ส่ง')
    expect(Object.keys(requests[0] as object).sort()).toEqual(['messages', 'operationId', 'sessionId'])
    await send(page, 'ข้อความถัดไป')
    await expect(reply.last()).toContainText('บริบทที่ได้รับ 3 ข้อความ')
    for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [360, 480]]) {
      await page.setViewportSize({ width, height })
      await expect(page.getByRole('textbox', { name: 'ข้อความถึง CIC' })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/backend-${width}x${height}.png` })
    }
    await page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true }).click()
    await page.getByRole('button', { name: 'เริ่มแชตตัวอย่างแอป', exact: true }).click()
    await expect(page.getByRole('button', { name: 'ให้ดู', exact: true })).toBeEnabled()
    await expect(page.getByRole('article')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally { await close() }
})
test('browser stop, new chat, switch and route departure abort upstream without late replies', async ({ page }) => {
  let cancelled = 0
  const provider: Provider = { kind: 'test', async *stream(_input, signal) { try { yield 'ตอบบางส่วน'; await delay(10000, undefined, { signal }); yield 'ผลเก่าที่ห้ามแสดง' } finally { cancelled++ } } }
  const close = await start(provider)
  try {
    await page.goto('./#/app'); await connect(page)
    await send(page, 'คำขอแรก')
    await expect(page.getByText('กำลังทยอยตอบ…', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'หยุดงาน', exact: true }).click()
    await expect.poll(() => cancelled).toBe(1)
    await expect(page.getByRole('article').last()).toContainText('หยุดกลางทาง')
    await send(page, 'คำขอที่สอง'); await expect(page.getByText('กำลังทยอยตอบ…', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'แชตใหม่', exact: true }).click()
    await expect.poll(() => cancelled).toBe(2); await expect(page.getByRole('article')).toHaveCount(0)
    await send(page, 'แชตใหม่อีกคำขอ'); await expect(page.getByText('กำลังทยอยตอบ…', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'เปิดแชต คำขอแรก', exact: true }).click()
    await expect.poll(() => cancelled).toBe(3)
    await expect(page.getByRole('article').filter({ hasText: 'แชตใหม่อีกคำขอ' })).toHaveCount(0)
    await send(page, 'ออกจากแอป'); await expect(page.getByText('กำลังทยอยตอบ…', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'กลับหน้าแนะนำ', exact: true }).click()
    await expect.poll(() => cancelled).toBe(4)
    await page.getByRole('button', { name: 'เข้าใช้งาน', exact: true }).first().click()
    await expect(page.getByRole('article').last()).toContainText('หยุดกลางทาง')
    await expect(page.getByText('ผลเก่าที่ห้ามแสดง', { exact: true })).toHaveCount(0)
  } finally { await close() }
})
test('unavailable backend stays an error; explicit retry does not duplicate user input', async ({ page }) => {
  const close = await start()
  try {
    await page.goto('./#/app'); await connect(page)
    let calls = 0
    await page.route('http://127.0.0.1:8787/chat', async route => { calls++; await route.abort('connectionfailed') })
    await send(page, 'วางแผนงานจริง')
    await expect(page.getByRole('alert')).toContainText('เชื่อมต่อบริการไม่ได้')
    await expect(page.getByRole('article')).toHaveCount(1); expect(calls).toBe(1)
    await page.unroute('http://127.0.0.1:8787/chat')
    await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click()
    await expect(page.getByRole('article', { name: 'คำตอบทดสอบ backend' })).toContainText('บริบทที่ได้รับ 1 ข้อความ')
    await expect(page.getByRole('article', { name: 'ข้อความของคุณ' })).toHaveCount(1)
    await page.getByRole('button', { name: 'การเชื่อมต่อ', exact: true }).click()
    await page.route('http://127.0.0.1:8787/health', route => route.abort('connectionfailed'))
    await page.getByRole('button', { name: 'ตรวจการเชื่อมต่อ backend', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('เชื่อมต่อบริการไม่ได้')
    await expect(page.getByRole('button', { name: 'เริ่มแชตทดสอบ backend', exact: true })).toHaveCount(0)
  } finally { await close() }
})
