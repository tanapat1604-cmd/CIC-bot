import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/chrome-reuse\.spec\.ts$/,workers:1,retries:0,fullyParallel:false,timeout:10000,reporter:[['./scripts/cic-thousand-reporter.ts'],['json',{outputFile:process.env.CIC_THOUSAND_OUTPUT??'validation/2026-10-13-chrome-reuse/1000-run-1.json'}]]})
