import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  retries: process.env.CI ? 1 : 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173/CIC-bot/', reducedMotion: 'reduce', trace: { mode: 'retain-on-failure', screenshots: false }, launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173/CIC-bot/', reuseExistingServer: !process.env.CI },
})
