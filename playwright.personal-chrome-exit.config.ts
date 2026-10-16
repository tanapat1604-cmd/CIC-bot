import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/personal-chrome-exit\.spec\.ts$/,workers:1,retries:0,reporter:'list'})
