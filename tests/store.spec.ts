import { test, expect } from '@playwright/test'
import { createSessionStore } from '../src/workspace/store'
import { createMockAdapters, abortableDelay } from '../src/workspace/adapters'
import type { SessionStore } from '../src/workspace/types'

const active = (store: SessionStore) => store.getSnapshot().sessions.find(s => s.id === store.getSnapshot().sessionId)!
const send = (store: SessionStore, text: string) => { store.setDraft(text); store.send() }
test('stop and chat switch reject even adapters that ignore AbortSignal', async () => {
  const adapters = createMockAdapters()
  adapters.agent.respond = async function* (request) { await new Promise(resolve => setTimeout(resolve, 100)); yield { sessionId: request.sessionId, operationId: request.operationId, type: 'delta', text: 'LATE RESULT' }; yield { sessionId: request.sessionId, operationId: request.operationId, type: 'done' } }
  const store = createSessionStore(adapters)
  send(store, 'first'); store.stop()
  await new Promise(resolve => setTimeout(resolve, 150))
  expect(active(store).messages.map(m => m.text)).toEqual(['first'])
  const first = active(store).id
  send(store, 'second'); store.newSession()
  send(store, 'third'); store.stop()
  await new Promise(resolve => setTimeout(resolve, 150))
  expect(active(store).messages.map(m => m.text)).toEqual(['third'])
  store.switchSession(first)
  expect(active(store).messages.map(m => m.text)).toEqual(['first', 'second'])
  store.dispose()
})
test('approvals bind to source, mode, session and operation; duplicate approval is ignored', async () => {
  const store = createSessionStore(createMockAdapters({ responseMs: 1, executeMs: 100 }))
  store.setMode('assist'); send(store, 'ช่วยทำรายการงาน')
  await expect.poll(() => active(store).agent).toBe('awaiting-approval')
  const oldAction = active(store).messages.at(-1)!.action!
  store.openSources(); store.selectSource('window')
  await expect.poll(() => active(store).screen).toBe('connected')
  store.approve(oldAction.id)
  expect(active(store).messages.at(-1)!.action!.status).toBe('cancelled')
  send(store, 'ช่วยทำรายการใหม่')
  await expect.poll(() => active(store).agent).toBe('awaiting-approval')
  const next = active(store).messages.at(-1)!.action!
  expect(next.sourceId).toBe(active(store).source?.id)
  store.setMode('chat'); store.approve(next.id)
  expect(active(store).messages.at(-1)!.action!.status).toBe('cancelled')
  store.setMode('assist'); send(store, 'ช่วยทำรายการ')
  await expect.poll(() => active(store).agent).toBe('awaiting-approval')
  const accepted = active(store).messages.at(-1)!.action!
  store.approve(accepted.id); store.approve(accepted.id)
  expect(active(store).agent).toBe('executing')
  store.stop()
  await new Promise(resolve => setTimeout(resolve, 180))
  expect(active(store).messages.at(-1)!.action!.status).toBe('cancelled')
  expect(active(store).messages.at(-1)!.text).not.toContain('ผลจำลอง:')
  store.dispose()
})
test('rejection, completion and layout preserve the same session', async () => {
  const store = createSessionStore(createMockAdapters({ responseMs: 1, executeMs: 1 }))
  store.setMode('assist'); send(store, 'ช่วยทำรายการ')
  await expect.poll(() => active(store).agent).toBe('awaiting-approval')
  store.reject(active(store).messages.at(-1)!.action!.id)
  expect(active(store).messages.at(-1)!.action!.status).toBe('rejected')
  send(store, 'ช่วยทำรายการใหม่')
  await expect.poll(() => active(store).agent).toBe('awaiting-approval')
  const session = active(store), action = session.messages.at(-1)!.action!
  store.setLayout('compact'); store.approve(action.id)
  await expect.poll(() => active(store).messages.at(-1)!.action!.status).toBe('done')
  store.setLayout('expanded')
  expect(active(store).id).toBe(session.id)
  expect(active(store).messages).toHaveLength(4)
  store.dispose()
})
test('deterministic errors retry once without duplicating user messages; source errors recover', async () => {
  const store = createSessionStore(createMockAdapters({ responseMs: 1, failResponses: 1, failSources: 1 }))
  send(store, 'วางแผนงาน')
  await expect.poll(() => active(store).agent).toBe('error')
  store.retry()
  await expect.poll(() => active(store).agent).toBe('idle')
  expect(active(store).messages).toHaveLength(2)
  store.selectSource('tab')
  await expect.poll(() => active(store).screen).toBe('error')
  store.selectSource('tab')
  await expect.poll(() => active(store).screen).toBe('connected')
  expect(active(store).source?.kind).toBe('tab')
  store.dispose()
})
test('chat excludes screen context; analysis never requests control; execution errors need new permission', async () => {
  const adapters = createMockAdapters({ responseMs: 1, executeMs: 1, failExecutions: 1 })
  const original = adapters.agent.respond
  let lastSource: string | null | undefined
  adapters.agent.respond = (request, signal) => { lastSource = request.source?.id ?? null; return original(request, signal) }
  const store = createSessionStore(adapters)
  store.selectSource('desktop'); await expect.poll(() => active(store).screen).toBe('connected')
  send(store, 'วิเคราะห์หน้าจอ'); await expect.poll(() => active(store).agent).toBe('idle')
  expect(lastSource).toBeNull()
  store.setMode('assist'); send(store, 'วิเคราะห์งานนี้')
  await expect.poll(() => active(store).agent).toBe('idle')
  expect(active(store).messages.at(-1)?.action).toBeUndefined()
  expect(lastSource).toBe(active(store).source?.id)
  send(store, 'ช่วยทำรายการ'); await expect.poll(() => active(store).agent).toBe('awaiting-approval')
  store.approve(active(store).messages.at(-1)!.action!.id)
  await expect.poll(() => active(store).agent).toBe('error')
  expect(active(store).retryText).toBeNull()
  expect(active(store).messages.at(-1)!.action!.status).toBe('error')
  store.dispose()
})
test('URL validation blocks executable protocols and credentials; cancellation rejects promise', async () => {
  const store = createSessionStore()
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'not a url', 'https://user:password@example.com']) expect(() => store.addLink(value)).toThrow()
  store.addLink('https://example.com/hello')
  expect(active(store).attachments[0].name).toBe('example.com')
  store.removeAttachment(active(store).attachments[0].id)
  expect(active(store).attachments).toHaveLength(0)
  const controller = new AbortController()
  const pending = abortableDelay(1000, controller.signal)
  controller.abort()
  await expect(pending).rejects.toThrow('Cancelled')
  store.dispose()
})
