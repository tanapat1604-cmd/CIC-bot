import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const url = 'https://tanapat1604-cmd.github.io/CIC-bot/'
const expected = (await readFile('dist/index.html', 'utf8')).match(/src="([^"]+\.js)"/)[1]
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const errors = [], localRequests = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('request', r => { if (/127\.0\.0\.1|localhost|:11434/.test(r.url())) localRequests.push(r.url()) })
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })
  const response = await page.goto(url + '#/chess', { waitUntil: 'networkidle' })
  expect(response.status()).toBe(200); expect(await response.text()).toContain(expected)
  const served = await page.request.get(new URL(expected, url).href)
  expect(served.status()).toBe(200)
  const digest = b => createHash('sha256').update(b).digest('hex')
  const servedHash = digest(await served.body()); expect(servedHash).toBe(digest(await readFile('dist/' + expected.replace('/CIC-bot/', ''))))
  await expect(page.getByText(/เว็บสาธารณะเป็นตัวอย่างกระดานเท่านั้น/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'เชื่อมต่อ Stockfish' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'วิเคราะห์ตำแหน่ง' })).toBeDisabled()
  await page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true }).click(); await page.getByRole('button', { name: 'e4 ว่าง', exact: true }).click(); await expect(page.getByTestId('game-status')).toContainText('ตาดำ')
  await page.reload(); await expect(page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true })).toBeVisible()
  const notice = await page.request.get(url + 'THIRD-PARTY-NOTICES.txt'); expect(notice.status()).toBe(200); expect(await notice.text()).toContain('Redistribution and use')
  await mkdir('.tools/chess-evidence', { recursive: true })
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['short', 360, 480]]) {
    await page.setViewportSize({ width, height }); await page.screenshot({ path: `.tools/chess-evidence/public-${name}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('link', { name: '← กลับแชต' }).click(); await page.getByRole('link', { name: 'เปิดหมากรุก' }).click()
  await expect(page.getByRole('button', { name: 'เชื่อมต่อ Stockfish' })).toBeDisabled()
  expect(localRequests).toEqual([]); expect(errors).toEqual([])
  const result = { at: new Date().toISOString(), url: url + '#/chess', asset: expected, sha256: servedHash, desktop: true, mobile: true, short: true, reload: true, board: true, license: true, localBackendDisabled: true, localRequests, errors }
  await writeFile('validation/2026-10-07-chess/public-chess.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result))
} finally { await browser.close() }
