import { createMockAdapters } from './adapters'
import type { Attachment, Session, SessionStore, WorkspaceState } from './types'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const id = () => crypto.randomUUID()
function newChat(): Session {
  return { id: id(), title: 'แชตใหม่', mode: 'chat', screen: 'disconnected', source: null, agent: 'idle', operationId: null, messages: [], draft: '', attachments: [], error: null, retryText: null }
}
export function createSessionStore(adapters = createMockAdapters()): SessionStore {
  const first = newChat()
  let state: WorkspaceState = { sessions: [first], sessionId: first.id, layout: 'expanded' }
  const listeners = new Set<() => void>(), objectUrls = new Set<string>()
  let controller: AbortController | null = null
  const publish = (next: WorkspaceState) => { state = next; listeners.forEach(listener => listener()) }
  const current = () => state.sessions.find(session => session.id === state.sessionId)!
  const patch = (sessionId: string, update: (session: Session) => Session) => publish({ ...state, sessions: state.sessions.map(session => session.id === sessionId ? update(session) : session) })
  const valid = (sessionId: string, operationId: string) => state.sessionId === sessionId && current().operationId === operationId && !controller?.signal.aborted
  function cancel() {
    controller?.abort(); controller = null
    const session = current()
    patch(session.id, s => ({ ...s, operationId: null, agent: ['responding', 'executing', 'awaiting-approval'].includes(s.agent) ? 'paused' : s.agent, screen: s.screen === 'selecting' ? (s.source ? 'connected' : 'disconnected') : s.screen,
      messages: s.messages.map(message => message.action && ['pending', 'executing'].includes(message.action.status) ? { ...message, action: { ...message.action, status: 'cancelled' } } : message),
    }))
  }
  function begin() {
    controller = new AbortController()
    return { sessionId: state.sessionId, operationId: id(), signal: controller.signal }
  }
  async function respond(text: string, retry = false) {
    if (!text.trim() || ['responding', 'executing'].includes(current().agent)) return
    cancel()
    const op = begin(), session = current()
    const count = retry ? (session.messages.filter(m => m.role === 'user').at(-1)?.attachments?.length ?? 0) : session.attachments.length
    patch(session.id, s => ({ ...s, agent: 'responding', operationId: op.operationId, error: null, retryText: text, draft: retry ? s.draft : '', attachments: retry ? s.attachments : [], title: s.messages.length ? s.title : text.slice(0, 38), messages: retry ? s.messages : [...s.messages, { id: id(), role: 'user', text, attachments: s.attachments }] }))
    try {
      const reply = await adapters.agent.respond({ sessionId: session.id, operationId: op.operationId, text, mode: session.mode, source: session.mode === 'chat' ? null : session.source, attachmentCount: count }, op.signal)
      if (!valid(op.sessionId, op.operationId)) return
      patch(session.id, s => ({ ...s, agent: reply.action ? 'awaiting-approval' : 'idle', operationId: reply.action ? op.operationId : null, retryText: null,
        messages: [...s.messages, { id: id(), role: 'assistant', text: reply.text, action: reply.action ? { ...reply.action, id: id(), status: 'pending' } : undefined }],
      }))
    } catch (error) {
      if (!valid(op.sessionId, op.operationId) || op.signal.aborted) return
      patch(session.id, s => ({ ...s, agent: 'error', operationId: null, error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' }))
    }
  }
  const store: SessionStore = {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    newSession() { cancel(); const session = newChat(); publish({ ...state, sessions: [...state.sessions, session], sessionId: session.id }) },
    switchSession(sessionId) { if (sessionId === state.sessionId || !state.sessions.some(s => s.id === sessionId)) return; cancel(); publish({ ...state, sessionId }) },
    setLayout(layout) { publish({ ...state, layout }) },
    setMode(mode) { if (current().mode === mode) return; cancel(); patch(state.sessionId, s => ({ ...s, mode, agent: 'idle', error: null, retryText: null })) },
    setDraft(draft) { patch(state.sessionId, s => ({ ...s, draft })) },
    send() { void respond(current().draft.trim()) },
    retry() { if (current().agent === 'error' && current().retryText) void respond(current().retryText!, true) },
    stop: cancel,
    openSources() { cancel(); patch(state.sessionId, s => ({ ...s, screen: 'selecting', error: null })) },
    cancelSources() { cancel() },
    async selectSource(kind) {
      cancel(); const op = begin()
      patch(state.sessionId, s => ({ ...s, screen: 'selecting', operationId: op.operationId, error: null }))
      try {
        const source = await adapters.screen.select(kind, op.signal)
        if (!valid(op.sessionId, op.operationId)) return
        patch(op.sessionId, s => ({ ...s, source, screen: 'connected', operationId: null, agent: 'idle' }))
      } catch (error) {
        if (!valid(op.sessionId, op.operationId) || op.signal.aborted) return
        patch(op.sessionId, s => ({ ...s, screen: 'error', operationId: null, error: error instanceof Error ? error.message : 'เลือกแหล่งไม่สำเร็จ' }))
      }
    },
    disconnect() { cancel(); patch(state.sessionId, s => ({ ...s, screen: 'disconnected', source: null, agent: 'idle', error: null, retryText: null })) },
    async approve(actionId) {
      const session = current(), action = session.messages.find(message => message.action?.id === actionId)?.action
      if (!action || action.status !== 'pending' || session.mode !== 'assist' || action.sessionId !== session.id || action.operationId !== session.operationId || action.sourceId !== (session.source?.id ?? null)) return
      const operationId = action.operationId
      controller = new AbortController(); const signal = controller.signal
      patch(session.id, s => ({ ...s, agent: 'executing', messages: s.messages.map(message => message.action?.id === actionId ? { ...message, action: { ...action, status: 'executing' } } : message) }))
      try {
        const result = await adapters.control.execute(action, signal)
        if (!valid(session.id, operationId)) return
        patch(session.id, s => ({ ...s, agent: 'idle', operationId: null, messages: s.messages.map(message => message.action?.id === actionId ? { ...message, action: { ...action, status: 'done' }, text: result } : message) }))
      } catch (error) {
        if (!valid(session.id, operationId) || signal.aborted) return
        patch(session.id, s => ({ ...s, agent: 'error', operationId: null, retryText: null, error: error instanceof Error ? error.message : 'การจำลองไม่สำเร็จ', messages: s.messages.map(message => message.action?.id === actionId ? { ...message, action: { ...action, status: 'error' } } : message) }))
      }
    },
    reject(actionId) {
      const action = current().messages.find(message => message.action?.id === actionId)?.action
      if (action?.status !== 'pending') return
      controller?.abort(); controller = null
      patch(state.sessionId, s => ({ ...s, agent: 'idle', operationId: null, messages: s.messages.map(message => message.action?.id === actionId ? { ...message, action: { ...action, status: 'rejected' } } : message) }))
    },
    addLink(value) {
      let url: URL
      try { url = new URL(value.trim()) } catch { throw new Error('กรุณาใส่ URL เต็ม เช่น https://example.com') }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('รองรับเฉพาะ http/https ที่ไม่มีชื่อผู้ใช้หรือรหัสผ่านใน URL')
      if (current().attachments.length >= 6) throw new Error('แนบได้สูงสุด 6 รายการต่อข้อความ')
      const attachment: Attachment = { id: id(), kind: 'link', name: url.hostname, url: url.href }
      patch(state.sessionId, s => ({ ...s, attachments: [...s.attachments, attachment] }))
    },
    async addImage(file) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('รองรับภาพ PNG, JPEG, WebP และ GIF เท่านั้น')
      if (file.size > MAX_IMAGE_BYTES) throw new Error('ภาพใหญ่เกินกำหนด กรุณาเลือกภาพไม่เกิน 5 MB')
      if (current().attachments.length >= 6) throw new Error('แนบได้สูงสุด 6 รายการต่อข้อความ')
      const sessionId = state.sessionId, url = URL.createObjectURL(file)
      try {
        const image = new Image(); image.src = url; await image.decode()
        if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('ภาพมีความละเอียดเกิน 24 ล้านพิกเซล กรุณาย่อภาพก่อน')
        if (state.sessionId !== sessionId || current().attachments.length >= 6) { URL.revokeObjectURL(url); return }
        objectUrls.add(url)
        patch(sessionId, s => ({ ...s, attachments: [...s.attachments, { id: id(), kind: 'image', name: file.name, url }] }))
      } catch (error) { URL.revokeObjectURL(url); throw new Error(error instanceof Error && error.message.includes('พิกเซล') ? error.message : 'เปิดภาพไม่ได้ กรุณาเลือกไฟล์ภาพที่สมบูรณ์') }
    },
    removeAttachment(attachmentId) {
      const attachment = current().attachments.find(item => item.id === attachmentId)
      if (attachment?.kind === 'image') { URL.revokeObjectURL(attachment.url); objectUrls.delete(attachment.url) }
      patch(state.sessionId, s => ({ ...s, attachments: s.attachments.filter(item => item.id !== attachmentId) }))
    },
    dispose() { cancel(); objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear(); const session = newChat(); publish({ sessions: [session], sessionId: session.id, layout: 'expanded' }) },
  }
  return store
}

export const sessionStore = createSessionStore()
