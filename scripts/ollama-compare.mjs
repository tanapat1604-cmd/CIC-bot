// Explicit local benchmark. Never downloads models or runs in CI.
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createOllamaProvider, ollamaConfig } from '../.backend-build/backend/ollama.js'
import { SYSTEM_INSTRUCTION } from '../.backend-build/backend/provider.js'
const base = 'http://127.0.0.1:11434'
const models = ['qwen3:0.6b', 'qwen3:1.7b']
const api = async (path, body) => {
  const response = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) } : { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
}
const tags = await api('/api/tags')
if (!models.every(model => tags.models.some(item => item.name === model))) throw new Error('Both authorized models must already be installed')
const cases = JSON.parse(await readFile('scripts/ollama-thai-cases.json', 'utf8'))
const directory = process.argv[2] || 'validation/2026-10-04-thai'
try {
  await access(directory + '/comparison.json')
  throw new Error('Evidence already exists; pass a fresh output directory to preserve prior results')
} catch (error) { if (error.code !== 'ENOENT') throw error }
await mkdir(directory, { recursive: true })
const samples = [], output = { started: new Date().toISOString(), version: await api('/api/version'), tags, system: SYSTEM_INSTRUCTION, settings: ollamaConfig({ AI_MODEL: models[0] }), methodology: 'Frozen prompt and holdout cases. Two rounds in ABBA blocks, unload before each block, cold echo then warm cases. 30s per provider call including show; actual assistant history. OS/process samples nominally every 500ms plus CIM collection time; sampled peaks are lower bounds, process WS sums may double-count shared pages; private bytes are committed virtual memory, not physical RAM. No simultaneous browser/build workload.', cases, blocks: [], results: [] }
const sampler = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/ollama-memory.ps1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let pending = '', samplerError = ''
sampler.stdout.on('data', bytes => { pending += bytes.toString(); let end; while ((end = pending.indexOf('\n')) >= 0) { const line = pending.slice(0,end).trim(); pending = pending.slice(end+1); if (line) { try { samples.push(JSON.parse(line)) } catch { samplerError += line } } } })
sampler.stderr.on('data', b => { samplerError += b.toString() })
const save = async () => { await writeFile(`${directory}/comparison.json`, JSON.stringify(output,null,2)); await writeFile(`${directory}/memory-samples.json`, JSON.stringify({ samples, samplerError },null,2)) }
const measure = async (provider, testCase, messages, phase, round) => {
  const start = Date.now(), clock = performance.now(); let text = '', error = null, ttftMs = null, completion = null
  provider.capture = value => { completion = value }
  try { for await (const part of provider.stream({ messages, system: SYSTEM_INSTRUCTION, maxOutputChars: 12000 }, AbortSignal.timeout(30000))) { if (ttftMs === null) ttftMs = Math.round(performance.now()-clock); text += part } } catch (cause) { error = cause.code || cause.message }
  const end = Date.now(), elapsedMs = Math.round(performance.now()-clock)
  await new Promise(resolve => setTimeout(resolve, 800))
  const measured = samples.filter(s => s.timestamp >= start && s.timestamp <= end)
  const item = { model: provider.model, round, id: testCase.id, phase, set: testCase.set, category: testCase.category, messages, text, error, elapsedMs, ttftMs, completion, memory: measured.length ? { sampleCount: measured.length, minFreePhysicalMiB: Math.min(...measured.map(s=>s.freePhysicalBytes))/1048576, peakOllamaWorkingSetMiB: Math.max(...measured.map(s=>s.ollamaWorkingSetBytes))/1048576, peakOllamaPrivateMiB: Math.max(...measured.map(s=>s.ollamaPrivateBytes))/1048576 } : null, resident: await api('/api/ps') }
  output.results.push(item); await save(); console.log(JSON.stringify({ model: item.model, round, id: item.id, phase, text, error, elapsedMs, memory: item.memory }))
  return item
}
try {
  await new Promise(resolve => setTimeout(resolve,2000))
  if (!samples.length) throw new Error(`No RAM measurement: ${samplerError}`)
  for (const [block, model] of [models[0],models[1],models[1],models[0]].entries()) {
    for (const installed of models) await api('/api/generate', { model: installed, keep_alive: 0 })
    let provider
    provider = createOllamaProvider(ollamaConfig({ AI_MODEL: model }), async (url, init) => {
      const response = await fetch(url,init)
      if (String(url).endsWith('/api/chat') && response.ok && response.body) {
        const reader = response.body.getReader(), decoder = new TextDecoder(), lines = { value: '' }
        return new Response(new ReadableStream({ async pull(controller) { const item = await reader.read(); if(item.done) { controller.close(); return } lines.value += decoder.decode(item.value,{stream:true}); let end; while((end=lines.value.indexOf('\n'))>=0) { const line=lines.value.slice(0,end); lines.value=lines.value.slice(end+1); if(line.trim()) { const event=JSON.parse(line); if(event.done) provider.capture?.({ doneReason:event.done_reason, evalCount:event.eval_count, evalDurationNs:event.eval_duration, promptEvalCount:event.prompt_eval_count, loadDurationNs:event.load_duration, totalDurationNs:event.total_duration }) } } controller.enqueue(item.value) }, cancel(reason) { return reader.cancel(reason) } }), {status:response.status,headers:response.headers})
      }
      return response
    })
    const round = block < 2 ? 1 : 2
    output.blocks.push({ block,model,round,started:new Date().toISOString(),initialMemory:samples.at(-1) }); await save()
    for (const testCase of cases) {
      const messages=[{role:'user',text:testCase.prompt}]
      const initial=await measure(provider,testCase,messages,'initial',round)
      if(testCase.followup && !initial.error) await measure(provider,testCase,[...messages,{role:'assistant',text:initial.text},{role:'user',text:testCase.followup}],'followup',round)
    }
  }
  output.finished=new Date().toISOString()
} finally { sampler.kill(); await save() }
