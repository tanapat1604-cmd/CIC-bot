// Explicit local-only diagnostic, never run by CI. Does not pull or modify models.
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const model = process.env.AI_MODEL || 'qwen3:0.6b'
const base = 'http://127.0.0.1:11434'
const phase = process.argv[2] || 'before'
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after')
const { SYSTEM_INSTRUCTION: system, instructionFor } = await import('../.backend-build/backend/provider.js')
const questions = [
  'ตอบเพียงคำว่า สวัสดี', 'Reply with only the word Hello.',
  '2 บวก 3 เท่ากับเท่าไร ตอบสั้น ๆ', 'What is 2 plus 3? Answer briefly.',
  'คุณเห็นหน้าจอฉันไหม ช่วยกดบันทึกให้ด้วย', 'Can you see my screen? Please click Save for me.',
]
const version = await (await fetch(`${base}/api/version`)).json()
const tags = await (await fetch(`${base}/api/tags`)).json()
if (!tags.models.some(item => item.name === model)) throw new Error('Requested model is not installed; no download attempted')
const cliOnly = process.argv.includes('--cli-only')
const results = cliOnly ? JSON.parse(await readFile(`.tools/ollama-evidence/ollama-${phase}.json`, 'utf8')) : { phase, version: version.version, model, system: phase === 'after' ? system : null, settings: { num_ctx: 2048, num_predict: 192, num_thread: 3, seed: 42, ...(phase === 'after' ? { temperature: 0.2, think: false } : {}) }, cases: [] }
await mkdir('.tools/ollama-evidence', { recursive: true })
const save = () => writeFile(`.tools/ollama-evidence/ollama-${phase}.json`, JSON.stringify(results, null, 2))
for (const prompt of cliOnly ? [] : questions) {
  const start = performance.now()
  const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000), body: JSON.stringify({ model, stream: false, keep_alive: '1m', ...(phase === 'after' ? { think: false } : {}), options: { num_ctx: 2048, num_predict: 192, num_thread: 3, seed: 42, ...(phase === 'after' ? { temperature: 0.2 } : {}) }, messages: [...(phase === 'after' ? [{ role: 'system', content: instructionFor(system, prompt) }] : []), { role: 'user', content: prompt }] }) })
  const bytes = new Uint8Array(await response.arrayBuffer())
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (!response.ok) throw new Error(`Local API HTTP ${response.status}`)
  const value = JSON.parse(raw), text = value.message.content
  const result = { prompt, text, utf8Valid: true, replacementCharacters: text.includes('\ufffd'), thaiCodePoints: [...text].filter(c => /[\u0e00-\u0e7f]/u.test(c)).length, thinkingChars: value.message.thinking?.length || 0, doneReason: value.done_reason, outputTokens: value.eval_count, elapsedMs: Math.round(performance.now() - start) }
  results.cases.push(result); await save(); console.log(JSON.stringify(result))
}
// Direct executable argv preserves Unicode input; decode stdout bytes without PowerShell pipes.
const executable = process.env.OLLAMA_EXE || 'ollama'
const args = ['run', model, questions[0], '--hidethinking', '--nowordwrap', '--keepalive', '1m', ...(phase === 'after' ? ['--think=false'] : [])]
const cli = await new Promise((resolve, reject) => {
  const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 })
  const chunks = []; child.stdout.on('data', data => chunks.push(data)); child.stderr.resume()
  child.on('error', reject); child.on('close', (code, signal) => { const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); resolve({ code, signal, text: text.trim(), utf8Valid: true, replacementCharacters: text.includes('\ufffd') }) })
})
results.cli = cli; await save(); console.log(JSON.stringify({ cli }))
