import { chromium, expect } from '@playwright/test'
import { preview } from 'vite'

const server = await preview({ preview: { port: 4174, host: '127.0.0.1', strictPort: true } })
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4174/CIC-bot/')
  await page.addStyleTag({ content: '.header,.hero-bottom{display:none}.hero-layout{min-height:630px;height:630px;padding-top:35px;padding-bottom:35px}.hero-copy .eyebrow{font-size:12px}.hero-copy .eyebrow::before{content:"CIC BOT /";color:#2459f5;font-weight:600}.hero-visual{align-self:center;height:500px}.floating-label{bottom:30px}.hero-cta{display:none}' })
  await page.locator('.scene-hero canvas').waitFor()
  await expect(page.locator('.scene-hero')).toHaveAttribute('data-renderer', 'webgl')
  await page.evaluate(() => document.fonts.ready)
  // Let the first WebGL frame finish after the lazy canvas mounts.
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'public/social-preview.png' })
  console.log('Created public/social-preview.png (1200 × 630)')
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
