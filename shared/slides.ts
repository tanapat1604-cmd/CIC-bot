import { record } from './chatProtocol.js'
export type SlidePage = { title: string; body: string[] }
export type SlideBrief = { title: string; brief: string; pages: SlidePage[]; parentId?: string }
export type SlideJob = { id: string; title: string; state: 'queued' | 'running' | 'cancelling' | 'cancelled' | 'error' | 'ready'; pageCount: number; created: number; ended?: number; durationMs?: number; parentId?: string; error?: string }
export function parseSlideBrief(value: unknown): SlideBrief {
  if (!record(value) || Object.keys(value).some(k => !['title','brief','pages','parentId'].includes(k))) throw Error('invalid')
  const valid = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !Array.from(v).some(c => c.charCodeAt(0)<32 && ![9,10,13].includes(c.charCodeAt(0)))
  if (!valid(value.title, 70) || !valid(value.brief, 1500) || !Array.isArray(value.pages) || value.pages.length < 2 || value.pages.length > 8 || value.parentId !== undefined && !/^[a-f0-9-]{36}$/.test(String(value.parentId))) throw Error('invalid')
  const pages = value.pages.map(page => {
    if (!record(page) || Object.keys(page).length !== 2 || !valid(page.title, 65) || !Array.isArray(page.body) || page.body.length < 1 || page.body.length > 3 || !page.body.every(line => valid(line, 115))) throw Error('invalid')
    return { title: page.title.trim(), body: page.body.map(line => (line as string).trim()) }
  })
  return { title: value.title.trim(), brief: value.brief.trim(), pages, ...(value.parentId ? { parentId: String(value.parentId) } : {}) }
}
export function outlinePages(outline: string): SlidePage[] {
  return outline.trim().split(/\n\s*\n/).map(block => { const [title, ...body] = block.split('\n').map(line => line.trim()).filter(Boolean); return { title: title ?? '', body } })
}
