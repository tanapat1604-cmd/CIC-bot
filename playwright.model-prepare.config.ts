import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/(?:model-prepare|assistant|assistant-settlement|voice-short-profile)\.spec\.ts$/,workers:1,retries:0,reporter:'list'})
