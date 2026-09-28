import { test, expect } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })
test.afterEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })

test('rapid tabs settle on latest choice, keep layout and move the indicator', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('./')
    await page.locator('.capability-tabs').scrollIntoViewIfNeeded()
    // Measure during a burst, including both the exit and entrance phases.
    const heights = await page.evaluate(async () => {
      const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      const panel = document.querySelector<HTMLElement>('.capability-panels')!
      const samples: number[] = []
      let sampling = true
      const record = () => { samples.push(panel.getBoundingClientRect().height); if (sampling) requestAnimationFrame(record) }
      record()
      for (const index of [4, 2, 0, 1, 3]) { tabs[index].click(); await new Promise(resolve => setTimeout(resolve, 24)) }
      await new Promise(resolve => setTimeout(resolve, 380))
      sampling = false
      return samples
    })
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2)
    await expect(page.getByRole('tab', { name: /งานออกแบบ/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toContainText('ให้ไอเดียสื่อสารได้ชัดขึ้น')
    const marker = await page.locator('.tab-indicator').boundingBox()
    const selected = await page.getByRole('tab', { name: /งานออกแบบ/ }).boundingBox()
    expect(Math.abs(marker!.x - selected!.x)).toBeLessThan(1)
    expect(Math.abs(marker!.y - selected!.y)).toBeLessThan(1)
    await page.getByRole('tab', { name: /เกม/ }).evaluate(node => (node as HTMLButtonElement).click())
    await expect(page.locator('#panel-design')).toHaveAttribute('inert', '')
    await expect(page.locator('#panel-design')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.getByRole('tabpanel')).toContainText('มองเกมให้กว้างกว่าเดิม')
    await page.screenshot({ path: `test-results/tabs-motion-${width}.png` })
  }
})

test('dialog animates while focus, Escape, rapid reopen and links stay immediate', async ({ page }) => {
  await page.goto('./')
  const trigger = page.getByRole('button', { name: 'ดาวน์โหลด', exact: true }).first()
  await trigger.click()
  const modal = page.locator('dialog')
  await expect(modal).toHaveAttribute('open', '')
  await expect(modal.locator('.dialog-close')).toBeFocused()
  expect(await modal.evaluate(node => node.getAnimations().some(animation => animation.effect?.getTiming().duration === 260))).toBe(true)
  await page.keyboard.press('Shift+Tab')
  await expect(modal.locator('.dialog-dismiss')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal).not.toHaveAttribute('open')
  await expect(modal).toHaveAttribute('inert', '')
  await expect(trigger).toBeFocused()
  // Reopen while the close transition is still running.
  await trigger.evaluate(node => (node as HTMLButtonElement).click())
  await expect(modal).toHaveAttribute('open', '')
  await expect(modal).not.toHaveAttribute('inert')
  await expect(modal.locator('.dialog-close')).toBeFocused()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/dialog-motion.png' })
  await modal.getByRole('link', { name: 'ดูตัวอย่างคอนเซปต์' }).click()
  await expect(page.getByRole('tab', { name: /งานประจำวัน/ })).toBeFocused()
  await expect(modal).not.toHaveAttribute('open')
})

test('FAQ reverses smoothly and the mobile menu becomes inert immediately on close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  const question = page.getByRole('button', { name: /ใช้งานได้แล้วหรือยัง/ })
  await question.scrollIntoViewIfNeeded()
  const answer = page.locator('#faq-answer-1')
  const sizes = await question.evaluate(async node => {
    (node as HTMLButtonElement).click()
    await new Promise(requestAnimationFrame)
    const answer = document.getElementById('faq-answer-1')!
    const transition = answer.getAnimations().find(animation => animation instanceof CSSTransition && animation.transitionProperty === 'grid-template-rows')
    if (!transition) throw new Error('FAQ height transition did not start')
    transition.pause()
    transition.currentTime = 90
    const during = answer.getBoundingClientRect().height
    transition.currentTime = 300
    const expanded = answer.getBoundingClientRect().height
    transition.play()
    return { during, expanded }
  })
  expect(sizes.during).toBeGreaterThan(0)
  expect(sizes.during).toBeLessThan(sizes.expanded)
  await question.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect(question).toHaveAttribute('aria-expanded', 'true')
  await question.press('Enter')
  await expect(answer).toHaveAttribute('inert', '')
  await page.waitForTimeout(350)
  expect((await answer.boundingBox())!.height).toBe(0)
  await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click()
  await expect(page.getByRole('navigation')).not.toHaveAttribute('inert')
  await page.keyboard.press('Escape')
  await expect(page.locator('#main-navigation')).toHaveAttribute('inert', '')
  await expect(page.getByRole('button', { name: 'เปิดเมนู', exact: true })).toBeFocused()
})

test('animated fallback pauses offscreen and respects reduced motion', async ({ page }) => {
  await page.route(/\/assets\/Scene-[^/]+\.js$/, route => route.abort())
  await page.goto('./')
  const scene = page.locator('.scene-hero')
  await expect(scene).toHaveAttribute('data-renderer', 'fallback')
  const orb = scene.locator('.fallback-orb')
  const first = await orb.evaluate(node => getComputedStyle(node).transform)
  await page.waitForTimeout(200)
  expect(await orb.evaluate(node => getComputedStyle(node).transform)).not.toBe(first)
  await page.screenshot({ path: 'test-results/fallback-motion.png' })
  await page.locator('footer').scrollIntoViewIfNeeded()
  await expect(scene).toHaveAttribute('data-active', 'false')
  const paused = await orb.evaluate(node => getComputedStyle(node).transform)
  await page.waitForTimeout(200)
  expect(await orb.evaluate(node => getComputedStyle(node).transform)).toBe(paused)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await orb.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
})

test('WebGL renders, scrolls both directions, and context loss shows the fallback', async ({ page }) => {
  test.setTimeout(90000)
  // Limit software-renderer readback cost; still exercise the desktop scroll camera.
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('./')
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-renderer', 'webgl')
  const hero = page.locator('.scene-hero')
  const box = (await hero.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.3)
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/webgl-parallax.png' })
  await page.mouse.move(10, 90)
  for (const [index, label] of [[0, 'start'], [1, 'middle'], [2, 'end'], [1, 'reverse']] as const) {
    await page.locator(`[data-step="${index}"]`).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await expect(page.locator('.scene-story')).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.locator(`[data-step="${index}"]`)).toHaveClass(/active/)
    await page.waitForTimeout(550)
    await page.screenshot({ path: `test-results/story-${label}.png` })
  }
  // Stop submitting GPU work before asking the test driver to lose its context.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  const supported = await page.locator('.scene-story canvas').evaluate(node => {
    const context = (node as HTMLCanvasElement).getContext('webgl2')!
    const extension = context.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return !!extension
  })
  expect(supported).toBe(true)
  await expect(page.locator('.scene-story')).toHaveAttribute('data-renderer', 'fallback')
  await expect(page.locator('.scene-story .scene-placeholder')).toBeVisible()
})
