import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:['training-pilot.spec.ts','model-prepare.spec.ts'],workers:1,retries:0,reporter:'list'})
