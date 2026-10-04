import type { ReplySource } from '../../shared/capabilities'
export type Mode = 'chat' | 'observe' | 'assist'
export type ScreenStatus = 'disconnected' | 'selecting' | 'connected' | 'error'
export type AgentStatus = 'idle' | 'responding' | 'awaiting-approval' | 'executing' | 'paused' | 'error'
export type Layout = 'expanded' | 'compact'
export type Connection = 'demo' | 'test' | 'live'
export type SourceKind = 'desktop' | 'window' | 'tab'
export interface ScreenSource { id: string; kind: SourceKind; name: string }
export type Attachment = { id: string; kind: 'link'; name: string; url: string } | { id: string; kind: 'image'; name: string; url: string; file: File }
export type ActionCommand = { kind: 'click-save'; button: 'บันทึก' } | { kind: 'type-text'; text: string } | { kind: 'task-list' }
export interface ActionProposal { sessionId: string; operationId: string; sourceId: string | null; command: ActionCommand }
export type ActionStatus = 'pending' | 'executing' | 'done' | 'rejected' | 'cancelled' | 'error'
export interface ProposedAction extends ActionProposal {
  id: string; title: string; target: string; details: string; effect: string; status: ActionStatus
}
export type ResponseStatus = 'streaming' | 'complete' | 'stopped' | 'error'
export interface Message { id: string; role: 'user' | 'assistant'; text: string; attachments?: Attachment[]; action?: ProposedAction; operationId?: string; responseStatus?: ResponseStatus; replySource?: ReplySource }
export interface Session {
  connection: Connection; contextNotice: boolean; model?: string
  id: string; title: string; mode: Mode; screen: ScreenStatus; source: ScreenSource | null
  agent: AgentStatus; operationId: string | null; messages: Message[]; draft: string; attachments: Attachment[]
  error: string | null; retryText: string | null
}
export interface WorkspaceState { sessions: Session[]; sessionId: string; layout: Layout }
// Object URLs belong to the view. A future transport serializes File data explicitly.
export type AgentAttachment = { kind: 'link'; name: string; url: string } | { kind: 'image'; name: string; file: File }
export interface AgentMessage { id: string; role: 'user' | 'assistant'; text: string; attachments: AgentAttachment[]; responseStatus?: ResponseStatus }
export interface AgentRequest { sessionId: string; operationId: string; messages: AgentMessage[]; mode: Mode; source: ScreenSource | null }
export type AgentEvent = { sessionId: string; operationId: string } & (
  { type: 'delta'; text: string } | { type: 'action'; proposal: ActionProposal } | { type: 'done'; source?: ReplySource } | { type: 'cancelled' } | { type: 'error'; message: string }
)
export interface ScreenSourceAdapter { select(kind: SourceKind, signal: AbortSignal): Promise<ScreenSource> }
export interface AgentAdapter { respond(request: AgentRequest, signal: AbortSignal): AsyncIterable<AgentEvent> }
export interface ControlAdapter { execute(action: ProposedAction, signal: AbortSignal): Promise<string> }
export interface SessionStore {
  getSnapshot(): WorkspaceState
  subscribe(listener: () => void): () => void
  newSession(connection?: Connection, model?: string): void
  switchSession(id: string): void
  setLayout(layout: Layout): void
  setMode(mode: Mode): void
  setDraft(text: string): void
  send(): void
  retry(): void
  stop(): void
  openSources(): void
  cancelSources(): void
  selectSource(kind: SourceKind): void
  disconnect(): void
  approve(id: string): void
  reject(id: string): void
  addLink(url: string): void
  addImage(file: File): Promise<void>
  removeAttachment(id: string): void
  dispose(): void
}
