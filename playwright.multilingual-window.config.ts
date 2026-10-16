import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/(?:voice-multilingual-window|voice-teacher-window|voice-window|voice-ctc|voice-short-profile|assistant-settlement)\.spec\.ts$/,workers:1,retries:0,reporter:'json'})
