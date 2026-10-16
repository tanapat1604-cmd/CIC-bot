import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:/(voice|youtube|core|lab|notepad)\.spec\.ts$/,workers:1,fullyParallel:false,retries:0,reporter:'list'})
