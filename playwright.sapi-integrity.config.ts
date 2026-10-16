import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/sapi-integrity\.spec\.ts$/,workers:1,retries:0,reporter:'list'})
