import type { Provider } from './provider.js'
import { ChatError, type TextMessage } from '../shared/chatProtocol.js'
import type { ReplySource } from '../shared/capabilities.js'
import { planRequest, type RequestPlan } from './requestPlan.js'
import { resolveTextUtility } from './textUtilities.js'

type Input = { messages: TextMessage[]; system: string; maxOutputChars: number }
export function createLiveReply(provider: Provider, input: Input, signal: AbortSignal): { source: ReplySource; plan: RequestPlan; stream: AsyncIterable<string> } {
  const plan = planRequest(input.messages)
  const thai = /[\u0e00-\u0e7f]/u.test(plan.original)
  const refusal = thai ? 'ข้อมูลจากระบบ: ไม่ได้ส่งข้อความ ตั้งเตือน ดูหน้าจอ กดปุ่ม หรือทำงานภายหลังให้' : 'System: no message was sent, reminder set, screen viewed, button pressed or future work scheduled.'
  const clarification = thai ? 'ต้องการให้ช่วยส่วนข้อความใด เช่น ร่างข้อความหรืออธิบายวิธีทำเอง? ระบบทำงานภายนอกให้ไม่ได้' : 'Which text task should I help with, such as drafting or instructions? CIC cannot perform external actions.'
  const utility = plan.kind === 'model' && /^\/(?:calc|time|capabilities)\b/i.test(plan.allowed[0]) ? resolveTextUtility(plan.allowed[0], input.messages) : null
  const source: ReplySource = plan.kind === 'mixed' ? 'mixed' : plan.kind === 'system' || plan.kind === 'clarify' ? 'capabilities' : utility?.source ?? 'model'
  async function* content() {
    signal.throwIfAborted()
    if (plan.kind === 'system') { yield refusal; return }
    if (plan.kind === 'clarify') { yield clarification; return }
    if (utility) { yield utility.text; return }
    if (plan.kind === 'model') {
      const messages = plan.resolvedFrom === undefined ? input.messages : [...input.messages.slice(0, -1), { role: 'user' as const, text: plan.allowed[0] }]
      yield* provider.stream({ ...input, messages }, signal); return
    }
    yield refusal + '\n' + (thai ? 'ส่วนที่ไม่ได้ทำ: ' : 'Parts not performed: ') + plan.denied.map(p => JSON.stringify(p)).join(', ') + '\n'
    const textParts: string[] = []
    for (const part of plan.allowed) {
      const result = /^\/(?:calc|time)\b/i.test(part) ? resolveTextUtility(part) : null
      if (result) yield '\n' + (thai ? 'ผลเครื่องมือในเครื่อง (' : 'Local tool (') + result.source + '):\n' + result.text + '\n'
      else textParts.push(part)
    }
    if (textParts.length) {
      const text = textParts.join('\n')
      yield '\n' + (thai ? 'ส่วนข้อความที่ส่งให้โมเดล: ' : 'Text task sent to model: ') + JSON.stringify(text) + '\n' + (thai ? 'คำตอบโมเดล (ข้อความอาจคลาดเคลื่อน ไม่ใช่ผลการทำงานภายนอก):\n' : 'Model reply (unverified text, not an external action result):\n')
      // Explicitly scoped subrequest, not deletion of keywords or filtering of model output.
      yield* provider.stream({ ...input, messages: [...input.messages.slice(0, -1), { role: 'user', text }] }, signal)
    }
  }
  async function* bounded() { let length = 0; for await (const chunk of content()) { signal.throwIfAborted(); length += chunk.length; if (length > input.maxOutputChars) throw new ChatError('output_limit'); yield chunk } }
  return { source, plan, stream: bounded() }
}
