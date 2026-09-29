import { createMockAdapters } from './adapters'
import { describeCommand, isAllowedProposal } from './actions'
import type { ActionProposal, AgentRequest, Attachment, Message, Session, SessionStore, WorkspaceState } from './types'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS = 6
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
      retryText: null,
      messages: s.messages.map(message => ({ ...message,
        responseStatus: message.responseStatus === 'streaming' ? 'stopped' : message.responseStatus,
        action: message.action && ['pending', 'executing'].includes(message.action.status) ? { ...message.action, status: 'cancelled' } : message.action,
      })),
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
    patch(session.id, s => ({ ...s, agent: 'responding', operationId: op.operationId, error: null, retryText: text, draft: retry ? s.draft : '', attachments: retry ? s.attachments : [], title: s.messages.length ? s.title : text.slice(0, 38), messages: retry ? s.messages : [...s.messages, { id: id(), role: 'user', text, attachments: s.attachments }] }))
    const request: AgentRequest = {
      sessionId: session.id, operationId: op.operationId, mode: session.mode, source: session.mode === 'chat' || !session.source ? null : { ...session.source },
      messages: current().messages.map(message => ({ id: message.id, role: message.role, text: message.text, responseStatus: message.responseStatus,
        attachments: (message.attachments ?? []).map(item => item.kind === 'image' ? { kind: 'image', name: item.name, file: item.file } : { kind: 'link', name: item.name, url: item.url }),
      })),
    }
    const responseId = id()
    let proposal: ActionProposal | undefined
    const updateResponse = (s: Session, update: (message: Message) => Message): Message[] => {
      const exists = s.messages.some(message => message.id === responseId)
      return exists ? s.messages.map(message => message.id === responseId ? update(message) : message) : [...s.messages, update({ id: responseId, role: 'assistant', text: '', operationId: op.operationId, responseStatus: 'streaming' })]
    }
    try {
      for await (const event of adapters.agent.respond(request, op.signal)) {
        if (!valid(op.sessionId, op.operationId) || op.signal.aborted) return
        if (event.sessionId !== op.sessionId || event.operationId !== op.operationId) throw new Error('คำตอบไม่ตรงกับคำขอปัจจุบัน กรุณาลองอีกครั้ง')
        if (event.type === 'error') throw new Error(event.message)
        if (event.type === 'cancelled') { cancel(); return }
        if (event.type === 'delta') {
          if (typeof event.text !== 'string') throw new Error('รูปแบบคำตอบไม่ถูกต้อง')
          patch(session.id, s => ({ ...s, messages: updateResponse(s, message => ({ ...message, text: message.text + event.text })) }))
        } else if (event.type === 'action') {
          if (proposal || !isAllowedProposal(event.proposal, request)) throw new Error('ข้อเสนอการกระทำไม่ตรงกับโหมดหรือบริบท จึงไม่ได้ขออนุญาต')
          // Copy the proposal so an adapter cannot mutate approved parameters later.
          proposal = { ...event.proposal, command: { ...event.proposal.command } }
        } else if (event.type === 'done') {
          const action = proposal ? { ...proposal, ...describeCommand(proposal.command), target: request.source?.name ?? 'พื้นที่ตัวอย่างในแชตนี้', id: id(), status: 'pending' as const } : undefined
          patch(session.id, s => ({ ...s, agent: action ? 'awaiting-approval' : 'idle', operationId: action ? op.operationId : null, retryText: null,
            messages: updateResponse(s, message => ({ ...message, responseStatus: 'complete', action })),
          }))
          return
        } else throw new Error('ไม่รองรับรูปแบบคำตอบนี้')
      }
      if (valid(op.sessionId, op.operationId)) throw new Error('การตอบขาดช่วงก่อนเสร็จ กรุณาลองอีกครั้ง')
    } catch (error) {
      if (!valid(op.sessionId, op.operationId) || op.signal.aborted) return
      controller?.abort()
      patch(session.id, s => ({ ...s, agent: 'error', operationId: null, error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', messages: s.messages.map(message => message.id === responseId ? { ...message, responseStatus: 'error' } : message) }))
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
      if (current().attachments.length >= MAX_ATTACHMENTS) throw new Error('แนบได้สูงสุด 6 รายการต่อข้อความ')
      const attachment: Attachment = { id: id(), kind: 'link', name: url.hostname, url: url.href }
      patch(state.sessionId, s => ({ ...s, attachments: [...s.attachments, attachment] }))
    },
    async addImage(file) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('รองรับภาพ PNG, JPEG, WebP และ GIF เท่านั้น')
      if (file.size > MAX_IMAGE_BYTES) throw new Error('ภาพใหญ่เกินกำหนด กรุณาเลือกภาพไม่เกิน 5 MB')
      if (current().attachments.length >= MAX_ATTACHMENTS) throw new Error('แนบได้สูงสุด 6 รายการต่อข้อความ')
      const sessionId = state.sessionId, url = URL.createObjectURL(file)
      try {
        const image = new Image(); image.src = url; await image.decode()
        if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('ภาพมีความละเอียดเกิน 24 ล้านพิกเซล กรุณาย่อภาพก่อน')
        if (state.sessionId !== sessionId) { URL.revokeObjectURL(url); return }
        if (current().attachments.length >= MAX_ATTACHMENTS) throw new Error('แนบได้สูงสุด 6 รายการต่อข้อความ')
        objectUrls.add(url)
        patch(sessionId, s => ({ ...s, attachments: [...s.attachments, { id: id(), kind: 'image', name: file.name, url, file }] }))
      } catch (error) { URL.revokeObjectURL(url); throw new Error(error instanceof Error && /พิกเซล|สูงสุด/.test(error.message) ? error.message : 'เปิดภาพไม่ได้ กรุณาเลือกไฟล์ภาพที่สมบูรณ์') }
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
