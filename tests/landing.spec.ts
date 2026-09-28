import { test, expect } from '@playwright/test'

// Stop software-rendered frames before Chromium tears down its tracing context.
test.afterEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })

test('production assets, real 3D, scroll story, and desktop layout', async ({ page }) => {
  const errors: string[] = [], failedAssets: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400) failedAssets.push(response.url()) })
  await page.goto('./')
  await expect(page).toHaveTitle(/CIC Bot/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ช่วยคิดไปกับทุกงาน')
  await expect(page.locator('.scene-hero canvas')).toBeVisible()
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-renderer', 'webgl')
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/desktop-hero.png' })
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-active', 'true')
  await page.locator('[data-step="2"]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-step="2"]')).toHaveClass(/active/)
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-active', 'false')
  await expect(page.locator('.scene-story canvas')).toBeVisible()
  await expect(page.locator('.header')).toBeInViewport()
  await page.evaluate(() => scrollTo(0, 0))
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-active', 'true')
  await page.screenshot({ path: 'test-results/desktop-full.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  expect(failedAssets).toEqual([])
})

test('all action buttons, native dialog focus, Escape and concept link', async ({ page }) => {
  await page.goto('./')
  for (const label of ['เข้าใช้งาน', 'ดาวน์โหลด']) {
    const buttons = page.getByRole('button', { name: label, exact: true })
    expect(await buttons.count()).toBe(2)
    for (const button of await buttons.all()) {
      await button.click()
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await expect(modal).toContainText(label === 'เข้าใช้งาน' ? 'ยังไม่เปิดให้เข้าใช้งานจริง' : 'ยังไม่มีไฟล์ให้ดาวน์โหลด')
      await expect(modal.getByRole('button', { name: 'ปิดหน้าต่าง' }).first()).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
      await expect(button).toBeFocused()
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
    }
  }
  await page.getByRole('button', { name: 'เข้าใช้งาน', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('link', { name: 'ดูตัวอย่างคอนเซปต์' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('tab', { name: /งานประจำวัน/ })).toBeFocused()
  await expect(page).toHaveURL(/#capabilities$/)
})

test('five concept tabs work with click and keyboard; FAQ disclosures', async ({ page }) => {
  await page.goto('./')
  const tabs = page.getByRole('tab')
  const headings = ['งานตรงหน้า ชัดเจนขึ้น', 'มองเกมให้กว้างกว่าเดิม', 'เห็นความเชื่อมโยงที่ซ่อนอยู่', 'ให้ไอเดียสื่อสารได้ชัดขึ้น', 'ต่อยอดไอเดีย ทีละบรรทัด']
  for (let i = 0; i < 5; i++) {
    await tabs.nth(i).click()
    await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toContainText(headings[i])
    await expect(page.getByRole('tabpanel')).toContainText('ตัวอย่างคอนเซปต์')
  }
  await page.keyboard.press('ArrowRight')
  await expect(tabs.first()).toBeFocused()
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(tabs.last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(tabs.first()).toBeFocused()
  const question = page.getByRole('button', { name: /ใช้งานได้แล้วหรือยัง/ })
  await question.click()
  await expect(question).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('region', { name: /ใช้งานได้แล้วหรือยัง/ })).toContainText('ยังไม่เปิดให้ใช้งานจริง')
  await question.press('Enter')
  await expect(question).toHaveAttribute('aria-expanded', 'false')
})

test('mobile and tablet do not overflow; mobile navigation works', async ({ page }) => {
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true)
    if (width === 390) {
      await expect(page.locator('.scene-hero canvas')).toBeVisible()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/mobile-hero.png' })
      const toggle = page.getByRole('button', { name: 'เปิดเมนู', exact: true })
      await toggle.click()
      await expect(page.getByRole('navigation')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(toggle).toBeFocused()
      await expect(page.getByRole('navigation')).not.toBeVisible()
      await toggle.click()
      await page.getByRole('navigation').getByRole('link', { name: 'วิธีทำงาน', exact: true }).click()
      await expect(page).toHaveURL(/#how-it-works$/)
      await expect(page.getByRole('navigation')).not.toBeVisible()
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: 'test-results/mobile-full.png', fullPage: true })
    }
  }
})

test('reduced motion stops scene animation and smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-reduced-motion', 'true')
  await expect(page.locator('.scene-hero canvas')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto')
  await page.waitForTimeout(500)
  const first = await page.locator('.scene-hero canvas').screenshot()
  await page.waitForTimeout(250)
  const second = await page.locator('.scene-hero canvas').screenshot()
  expect(first.equals(second)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-reduced-motion', 'false')
})

test('no WebGL: CSS concept remains visible and controls still work', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) { document.documentElement.dataset.webglUnavailable = 'true'; return null }
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-webgl-unavailable', 'true')
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-renderer', 'fallback')
  await expect(page.locator('.scene-hero .scene-fallback:visible')).toHaveCount(1)
  await page.getByRole('button', { name: 'ดาวน์โหลด', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('3D chunk fails: page and CSS fallback survive', async ({ page }) => {
  const failedChunk = page.waitForEvent('requestfailed', request => /\/assets\/Scene-[^/]+\.js$/.test(request.url()))
  await page.route(/\/assets\/Scene-[^/]+\.js$/, route => route.abort())
  await page.goto('./')
  await failedChunk
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-renderer', 'fallback')
  await expect(page.locator('.scene-hero .scene-fallback:visible')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('tab', { name: /เกม/ }).click()
  await expect(page.getByRole('tabpanel')).toContainText('มองเกมให้กว้างกว่าเดิม')
})

test('normal motion animates and document visibility pauses rendering', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  const canvas = page.locator('.scene-hero canvas')
  await expect(canvas).toBeVisible()
  await canvas.scrollIntoViewIfNeeded()
  const first = await canvas.screenshot()
  await page.waitForTimeout(200)
  const second = await canvas.screenshot()
  expect(first.equals(second)).toBe(false)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-active', 'false')
  const paused = await canvas.screenshot()
  await page.waitForTimeout(200)
  expect(paused.equals(await canvas.screenshot())).toBe(true)
})
