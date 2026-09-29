import { test, expect } from '@playwright/test'
import { createSessionStore } from '../src/workspace/store'
import { createMockAdapters } from '../src/workspace/adapters'
import type { AgentEvent, AgentRequest, SessionStore } from '../src/workspace/types'

const active = (store: SessionStore) => store.getSnapshot().sessions.find(s => s.id === store.getSnapshot().sessionId)!
const send = (store: SessionStore, text: string) => { store.setDraft(text); store.send() }
const settled = (store: SessionStore) => expect.poll(() => active(store).agent).not.toBe('responding')
const fast = () => createMockAdapters({ responseMs: 1, chunkMs: 1, executeMs: 1 })

test('explicit save/type scenarios match details and execution; advice and unknown commands never propose unrelated actions', async () => {
  const store = createSessionStore(fast())
  store.setMode('assist'); store.selectSource('window')
  await expect.poll(() => active(store).screen).toBe('connected')
  send(store, 'ช่วยคลิกปุ่มบันทึกในหน้าต่างนี้'); await settled(store)
  const save = active(store).messages.at(-1)!.action!
  expect(save.command).toEqual({ kind: 'click-save', button: 'บันทึก' })
  expect(save.title).toBe('จำลองคลิกปุ่มบันทึก')
  expect(save.target).toBe('หน้าต่างตัวอย่าง — VS Code')
  store.approve(save.id); await expect.poll(() => active(store).agent).toBe('idle')
  expect(active(store).messages.at(-1)!.text).toContain('จำลองคลิกปุ่มบันทึก')
  send(store, 'ช่วยพิมพ์ข้อความ "สวัสดี CIC" ในหน้าต่างนี้'); await settled(store)
  expect(active(store).messages.at(-1)!.action!.command).toEqual({ kind: 'type-text', text: 'สวัสดี CIC' })
  expect(active(store).messages.at(-1)!.action!.details).toBe('สวัสดี CIC')
  for (const text of ['วิเคราะห์โค้ดที่บันทึกไว้', 'วางแผนงาน', 'คลิกปุ่มลบ', 'ช่วยพิมพ์ข้อความ', 'ช่วยทำอะไรก็ได้']) {
    send(store, text); await settled(store)
    expect(active(store).messages.at(-1)!.action).toBeUndefined()
  }
  expect(active(store).messages.at(-1)!.text).toContain('ตัวอย่างนี้รองรับ')
  store.disconnect(); send(store, 'คลิกปุ่มบันทึก'); await settled(store)
  expect(active(store).messages.at(-1)!.text).toContain('ลองเลือกหน้าจอ')
  expect(active(store).messages.at(-1)!.action).toBeUndefined()
  store.dispose()
})

test('typed history and attachments reach adapter; chat mode strips retained screen context', async () => {
  const adapters = fast(), original = adapters.agent.respond
  const requests: AgentRequest[] = []
  adapters.agent.respond = (request, signal) => { requests.push(request); return original(request, signal) }
  const store = createSessionStore(adapters)
  store.selectSource('tab'); await expect.poll(() => active(store).screen).toBe('connected')
  store.addLink('https://example.com/context'); send(store, 'วางแผนงาน'); await settled(store)
  send(store, 'วิเคราะห์โค้ด'); await settled(store)
  expect(requests[0].source).toBeNull()
  expect(requests[0].messages[0].attachments).toEqual([{ kind: 'link', name: 'example.com', url: 'https://example.com/context' }])
  expect(requests[1].messages.map(message => message.role)).toEqual(['user', 'assistant', 'user'])
  expect(requests[0].operationId).not.toBe(requests[1].operationId)
  expect(active(store).source?.name).toContain('แท็บตัวอย่าง')
  store.dispose()
})

test('stop, mode change, chat switch and source change discard late stream events, preserve interrupted text', async () => {
  for (const cancel of ['stop', 'mode', 'new', 'switch', 'source', 'disconnect'] as const) {
    const adapters = fast()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    adapters.agent.respond = async function* (request) {
      const identity = { sessionId: request.sessionId, operationId: request.operationId }
      yield { ...identity, type: 'delta', text: 'ส่วนแรก' }
      await gate // Deliberately ignores AbortSignal to exercise stale-event guard.
      yield { ...identity, type: 'delta', text: 'ผลเก่า' }
      yield { ...identity, type: 'done' }
    }
    const store = createSessionStore(adapters)
    const other = active(store).id; store.newSession()
    const owner = active(store).id
    send(store, 'วางแผนงาน')
    await expect.poll(() => active(store).messages.at(-1)?.text).toBe('ส่วนแรก')
    if (cancel === 'stop') store.stop()
    if (cancel === 'mode') store.setMode('observe')
    if (cancel === 'new') store.newSession()
    if (cancel === 'switch') store.switchSession(other)
    if (cancel === 'source') store.openSources()
    if (cancel === 'disconnect') store.disconnect()
    release(); await new Promise(resolve => setTimeout(resolve, 20))
    const message = store.getSnapshot().sessions.find(s => s.id === owner)!.messages.at(-1)!
    expect(message.text).toBe('ส่วนแรก')
    expect(message.responseStatus).toBe('stopped')
    expect(message.action).toBeUndefined()
    store.dispose()
  }
})

test('partial error/retry and adapter cancellation remain distinct from completed answers', async () => {
  const store = createSessionStore(createMockAdapters({ responseMs: 1, chunkMs: 1, failAfterChunks: 1 }))
  send(store, 'วางแผนงาน'); await settled(store)
  expect(active(store).agent).toBe('error')
  expect(active(store).messages.at(-1)!.responseStatus).toBe('error')
  store.retry(); await settled(store)
  expect(active(store).messages.filter(m => m.role === 'user')).toHaveLength(1)
  expect(active(store).messages.at(-1)!.responseStatus).toBe('complete')
  expect(active(store).messages.filter(m => m.responseStatus === 'error')).toHaveLength(1)
  store.dispose()
  const adapters = fast()
  adapters.agent.respond = async function* (request) { yield { sessionId: request.sessionId, operationId: request.operationId, type: 'cancelled' } }
  const cancelled = createSessionStore(adapters)
  send(cancelled, 'วางแผนงาน'); await settled(cancelled)
  expect(active(cancelled).agent).toBe('paused')
  expect(active(cancelled).error).toBeNull()
  cancelled.dispose()
})

test('bad identities, malformed/unauthorized actions and missing terminal events fail closed', async () => {
  for (const scenario of ['identity', 'source', 'command', 'mode', 'truncated', 'text-only'] as const) {
    const adapters = fast()
    adapters.agent.respond = async function* (request) {
      const identity = { sessionId: request.sessionId, operationId: request.operationId }
      yield { ...identity, type: 'delta', text: 'คลิกปุ่มบันทึก' }
      if (scenario === 'truncated') return
      if (scenario === 'identity') { yield { ...identity, operationId: 'wrong', type: 'done' }; return }
      if (scenario !== 'text-only') yield {
        ...identity, type: 'action', proposal: { ...identity, sourceId: scenario === 'source' ? 'other' : null, command: scenario === 'command' ? { kind: 'delete-all' } : { kind: 'task-list' } },
      } as AgentEvent
      yield { ...identity, type: 'done' }
    }
    const store = createSessionStore(adapters)
    if (scenario !== 'mode') store.setMode('assist')
    send(store, 'คำขอ'); await settled(store)
    expect(active(store).messages.at(-1)!.action).toBeUndefined()
    expect(active(store).agent).toBe(scenario === 'text-only' ? 'idle' : 'error')
    store.dispose()
  }
})

test('same-kind source reselection gets a fresh identity and cancels pending approval; chat switch cannot restore it', async () => {
  const store = createSessionStore(fast())
  store.setMode('assist'); store.selectSource('window'); await expect.poll(() => active(store).screen).toBe('connected')
  const firstSource = active(store).source!.id
  send(store, 'คลิกปุ่มบันทึก'); await settled(store)
  const action = active(store).messages.at(-1)!.action!, owner = active(store).id
  store.selectSource('window'); await expect.poll(() => active(store).screen).toBe('connected')
  expect(active(store).source!.id).not.toBe(firstSource)
  store.approve(action.id); expect(active(store).messages.at(-1)!.action!.status).toBe('cancelled')
  send(store, 'คลิกปุ่มบันทึก'); await settled(store)
  const next = active(store).messages.at(-1)!.action!
  store.newSession(); store.switchSession(owner); store.approve(next.id)
  expect(active(store).messages.at(-1)!.action!.status).toBe('cancelled')
  store.dispose()
})
