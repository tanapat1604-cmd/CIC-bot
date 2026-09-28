export type Mode = 'chat' | 'observe' | 'assist'
export type ScreenStatus = 'disconnected' | 'selecting' | 'connected' | 'error'
export type AgentStatus = 'idle' | 'responding' | 'awaiting-approval' | 'executing' | 'paused' | 'error'
export type Layout = 'expanded' | 'compact'
export type SourceKind = 'desktop' | 'window' | 'tab'
export interface ScreenSource { id: string; kind: SourceKind; name: string }
export interface Attachment { id: string; kind: 'link' | 'image'; name: string; url: string }
export type ActionStatus = 'pending' | 'executing' | 'done' | 'rejected' | 'cancelled' | 'error'
export interface ProposedAction {
  id: string; sessionId: string; operationId: string; sourceId: string | null
  title: string; target: string; effect: string; status: ActionStatus
}
export interface Message { id: string; role: 'user' | 'assistant'; text: string; attachments?: Attachment[]; action?: ProposedAction }
export interface Session {
  id: string; title: string; mode: Mode; screen: ScreenStatus; source: ScreenSource | null
  agent: AgentStatus; operationId: string | null; messages: Message[]; draft: string; attachments: Attachment[]
  error: string | null; retryText: string | null
}
export interface WorkspaceState { sessions: Session[]; sessionId: string; layout: Layout }
export interface AgentRequest {
  sessionId: string; operationId: string; text: string; mode: Mode; source: ScreenSource | null; attachmentCount: number
}
export interface AgentReply { text: string; action?: Omit<ProposedAction, 'id' | 'status'> }
export interface ScreenSourceAdapter { select(kind: SourceKind, signal: AbortSignal): Promise<ScreenSource> }
export interface AgentAdapter { respond(request: AgentRequest, signal: AbortSignal): Promise<AgentReply> }
export interface ControlAdapter { execute(action: ProposedAction, signal: AbortSignal): Promise<string> }
export interface SessionStore {
  getSnapshot(): WorkspaceState
  subscribe(listener: () => void): () => void
  newSession(): void
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
