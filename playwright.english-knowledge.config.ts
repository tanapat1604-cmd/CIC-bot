import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/(?:assistant|english-knowledge|model-shape|tool-eligibility|model-compare)\.spec\.ts$/,workers:1,retries:0,reporter:'list'})
