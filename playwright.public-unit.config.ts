import {defineConfig} from '@playwright/test'
export default defineConfig({
 testDir:'./tests',workers:1,retries:0,reporter:'list',
 testMatch:['core','lab','notepad','youtube','voice','desktop','personal-chrome-exit','training-pilot','model-prepare','assistant','personal-memory'].map(name=>'**/'+name+'.spec.ts'),
 // The memory UI test belongs to the browser suite; this command never opens a browser/mic.
 grepInvert:/unified entry exposes real persistent memory/,
})
