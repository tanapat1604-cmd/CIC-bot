import { test, expect } from '@playwright/test'
import { Chess } from 'chess.js'
import { mkdirSync } from 'node:fs'
import { once } from 'node:events'
import { createChatServer } from '../backend/server'
import { createChessEngine } from '../backend/chessEngine'

test('chess board import promotion export and responsive layouts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('#/app'); await page.getByRole('link', { name: 'เปิดหมากรุก' }).click()
  await expect(page.getByRole('heading', { name: 'คิดทีละตา เล่นให้ไกลขึ้น' })).toBeVisible()
  await page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true }).click(); await page.getByRole('button', { name: 'e4 ว่าง', exact: true }).click()
  await expect(page.getByTestId('game-status')).toContainText('ตาดำ')
  await page.getByText('นำเข้า / ส่งออก FEN และ PGN', { exact: true }).click()
  await page.getByLabel('ข้อมูลนำเข้า').fill('not a fen'); await page.getByRole('button', { name: 'นำเข้า', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('นำเข้าไม่ได้')
  await expect(page.getByRole('button', { name: 'e4 ขาว เบี้ย', exact: true })).toBeVisible()
  await page.getByLabel('ข้อมูลนำเข้า').fill('7k/P7/8/8/8/8/8/7K w - - 0 1'); await page.getByRole('button', { name: 'นำเข้า', exact: true }).click()
  await page.getByRole('button', { name: 'a7 ขาว เบี้ย', exact: true }).click(); await page.getByRole('button', { name: 'a8 ว่าง', exact: true }).click(); await page.getByRole('button', { name: 'ม้า', exact: true }).click()
  await expect(page.getByRole('button', { name: 'a8 ขาว ม้า', exact: true })).toBeVisible()
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'ส่งออก PGN' }).click(); expect((await download).suggestedFilename()).toBe('cic-chess.pgn')
  await page.getByRole('button', { name: 'เริ่มเกมใหม่', exact: true }).click()
  mkdirSync('test-results', { recursive: true })
  for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['short', 360, 480]] as const) {
    await page.setViewportSize({ width, height }); await page.screenshot({ path: `test-results/chess-${label}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})
test('late engine replies cannot move a reset or departed game; stop and retry one move', async ({ page }) => {
  let pending: (() => Promise<void>) | undefined, calls = 0
  await page.route('http://127.0.0.1:8787/**', async route => {
    const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return }
    if (route.request().url().endsWith('/chess/status')) { await route.fulfill({ json: { ready: true, location: 'local', engine: 'Stockfish 19', freeMiB: 800 }, headers: cors }); return }
    if (route.request().url().endsWith('/session')) { await route.fulfill({ json: { ready: true }, headers: cors }); return }
    const body = route.request().postDataJSON(); calls++
    const game = new Chess(); if (body.pgn) game.loadPgn(body.pgn)
    const fen = game.fen(), move = game.moves({ verbose: true })[0]
    pending = async () => { await route.fulfill({ headers: cors, json: { ...body, fen, engine: 'Stockfish 19', move: move.from + move.to + (move.promotion ?? ''), san: move.san, pv: [move.san], depth: 1, score: null, elapsedMs: 50, thinkMs: 350 } }).catch(() => {}) }
  })
  await page.goto('#/chess'); await page.getByRole('button', { name: 'เชื่อมต่อ Stockfish' }).click()
  await expect(page.getByRole('status')).toContainText('พร้อม')
  await page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true }).click(); await page.getByRole('button', { name: 'e4 ว่าง', exact: true }).click()
  await expect.poll(() => calls).toBe(1); await page.getByRole('button', { name: 'หยุดคิด', exact: true }).click(); await pending!()
  await expect(page.getByTestId('game-status')).toContainText('ตาดำ')
  await page.getByRole('button', { name: 'ให้บอทเดินต่อ / ลองใหม่' }).click(); await expect.poll(() => calls).toBe(2); await pending!()
  await expect(page.getByTestId('game-status')).toContainText('ตาขาว')
  await page.getByRole('button', { name: 'วิเคราะห์ตำแหน่ง' }).click(); await expect.poll(() => calls).toBe(3)
  await page.getByRole('button', { name: 'เริ่มเกมใหม่', exact: true }).click(); await pending!()
  await expect(page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true })).toBeVisible(); await expect(page.getByRole('region', { name: 'ผลวิเคราะห์' })).toHaveCount(0)
  await page.getByRole('button', { name: 'วิเคราะห์ตำแหน่ง' }).click(); await expect.poll(() => calls).toBe(4)
  await page.getByRole('link', { name: '← กลับแชต' }).click(); await pending!(); await expect(page.getByRole('link', { name: 'เปิดหมากรุก' })).toBeVisible()
  await page.getByRole('link', { name: 'เปิดหมากรุก' }).click(); await expect(page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true })).toBeVisible()
  expect(calls).toBe(4)
})

test('actual local engine from app: both sides, analysis, stop, retry and route abort', async ({ page }) => {
  test.skip(process.env.CIC_CHESS_LIVE !== '1', 'local Stockfish executable opt-in')
  const engine = createChessEngine(), logs: string[] = []
  const server = createChatServer({ chess: engine, log: e => logs.push(e.status) }); server.listen(8787, '127.0.0.1'); await once(server, 'listening')
  const pageErrors: string[] = [], external: string[] = []
  page.on('pageerror', e => pageErrors.push(e.message)); page.on('request', req => { if (req.url().includes(':11434')) external.push(req.url()) })
  try {
    await page.goto('#/chess'); await page.getByRole('button', { name: 'เชื่อมต่อ Stockfish' }).click(); await expect(page.getByRole('status')).toContainText('พร้อม')
    await page.getByRole('button', { name: 'e2 ขาว เบี้ย', exact: true }).click(); await page.getByRole('button', { name: 'e4 ว่าง', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('engine ปิดแล้ว'); await expect(page.getByTestId('game-status')).toContainText('ตาขาว')
    await page.getByLabel('ฝ่าย', { exact: true }).selectOption('b')
    await expect(page.getByRole('status')).toContainText('engine ปิดแล้ว'); await expect(page.getByTestId('game-status')).toContainText('ตาดำ')
    await page.getByRole('button', { name: 'วิเคราะห์ตำแหน่ง' }).click(); await expect.poll(() => engine.status().busy).toBe(true)
    await page.getByRole('button', { name: 'หยุดคิด', exact: true }).click(); await expect.poll(() => logs.filter(x => x === 'chess-cancelled').length).toBe(1); await expect.poll(() => engine.status().busy).toBe(false)
    await expect(page.getByRole('region', { name: 'ผลวิเคราะห์' })).toHaveCount(0)
    await page.getByRole('button', { name: 'วิเคราะห์ตำแหน่ง' }).click(); await expect(page.getByRole('region', { name: 'ผลวิเคราะห์' })).toContainText('Stockfish 19'); await expect(page.getByRole('region', { name: 'ผลวิเคราะห์' })).toContainText('มุมมองขาว')
    await page.getByText('ตาเดิน · 1 ply', { exact: true }).click(); await expect(page.locator('.chess-moves')).not.toBeEmpty()
    mkdirSync('.tools/chess-evidence', { recursive: true })
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['short', 360, 480]] as const) {
      await page.setViewportSize({ width, height }); await page.screenshot({ path: `.tools/chess-evidence/actual-${name}.png`, fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'วิเคราะห์ตำแหน่ง' }).click(); await expect.poll(() => engine.status().busy).toBe(true)
    await page.getByRole('link', { name: '← กลับแชต' }).click(); await expect.poll(() => logs.filter(x => x === 'chess-cancelled').length).toBe(2); await expect.poll(() => engine.status().busy).toBe(false)
    expect(external).toEqual([]); expect(pageErrors).toEqual([])
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
