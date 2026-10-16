import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/(voice-apps|voice|chrome-youtube)\.spec\.ts$/,workers:1,fullyParallel:false,retries:0,reporter:'list'})
