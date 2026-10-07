import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { parseSlideBrief, type SlideBrief, type SlideJob } from '../shared/slides.js'
type Stored = { owner: string; job: SlideJob; directory: string; controller: AbortController }
type Execute = (brief: SlideBrief, directory: string, signal: AbortSignal) => Promise<void>
export class SlidesError extends Error { constructor(public code: 'invalid' | 'busy' | 'unavailable' | 'not-found' | 'capacity') { super(code) } }
function processRun(command: string, args: string[], signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore','ignore','pipe'] })
    let output = ''; child.stderr?.on('data', chunk => { output = (output + chunk).slice(-1000) })
    const stop = () => {
      // Terminate our Node worker only. The renderer observes a cancellation marker;
      // never terminate a PowerPoint process that may now hold other user documents.
      child.kill('SIGKILL')
    }
    signal.addEventListener('abort', stop, { once: true }); if(signal.aborted) stop()
    child.once('error', error => { signal.removeEventListener('abort',stop); reject(error) })
    child.once('close', code => { signal.removeEventListener('abort',stop); if(signal.aborted) reject(signal.reason); else if(code === 0) resolve(); else reject(Error(output.includes('memory-low') ? 'memory-low' : output.includes('powerpoint-busy') ? 'powerpoint-busy' : 'render-failed')) })
  })
}
export function createSlidesManager(options: { root?: string; execute?: Execute; ready?: boolean; timeoutMs?: number } = {}) {
  const modulePath = process.env.CIC_SLIDES_MODULE
  const configured = options.ready ?? (process.platform === 'win32' && !!modulePath && path.isAbsolute(modulePath) && existsSync(modulePath) && existsSync('C:/Program Files/Microsoft Office/root/Office16/POWERPNT.EXE'))
  const root = path.resolve(options.root ?? '.cic-user-files/slides')
  const jobs = new Map<string, Stored>(); let occupied = false
  const execute: Execute = options.execute ?? (async (brief, directory, signal) => {
    const cancelled = () => { void writeFile(path.join(directory,'cancel.requested'),'cancelled').catch(()=>{}) }
    signal.addEventListener('abort',cancelled,{once:true})
    await writeFile(path.join(directory,'brief.json'), JSON.stringify(brief, null, 2), { flag:'wx' })
    let executionError: unknown, stopUnverified=false
    try { signal.throwIfAborted(); await processRun(process.execPath, ['--max-old-space-size=256',path.resolve('scripts/slides-worker.mjs'),directory],signal) }
    catch(error) { executionError=error }
    finally {
      signal.removeEventListener('abort',cancelled)
      try { if(signal.aborted)await writeFile(path.join(directory,'cancel.requested'),'cancelled'); await processRun('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.resolve('scripts/slides-render.ps1'),'-Directory',directory,'-CleanupOnly'],AbortSignal.timeout(12000)) }
      catch { stopUnverified=true }
    }
    if(stopUnverified)throw Error('stop-unverified')
    if(executionError!==undefined)throw executionError
  })
  const snapshot = (item: Stored) => ({ ...item.job })
  function own(owner: string, id: string) { const item=jobs.get(id); if(!item || item.owner!==owner) throw new SlidesError('not-found'); return item }
  return {
    status: () => ({ configured, format: 'professional-text-v1', limits: { minPages:2,maxPages:8,maxJobs:16,concurrency:1,timeoutMs:options.timeoutMs??90000 }, source:'local-file-builder', planning:'user-reviewed-outline' }),
    isBusy: () => occupied,
    create(owner: string, value: unknown) {
      if(!configured)throw new SlidesError('unavailable')
      if(occupied)throw new SlidesError('busy')
      if(jobs.size>=16)throw new SlidesError('capacity')
      let brief: SlideBrief;try{brief=parseSlideBrief(value)}catch{throw new SlidesError('invalid')}
      if(brief.parentId && own(owner,brief.parentId).job.state!=='ready')throw new SlidesError('invalid')
      const id=randomUUID(), controller=new AbortController(), directory=path.join(root,id)
      const item:Stored={owner,controller,directory,job:{id,title:brief.title,state:'queued',pageCount:brief.pages.length,created:Date.now(),...(brief.parentId?{parentId:brief.parentId}:{})}}
      occupied=true;jobs.set(id,item)
      const timer=setTimeout(()=>controller.abort(Error('timeout')),options.timeoutMs??90000)
      void (async()=>{
        try{await mkdir(directory,{recursive:true});controller.signal.throwIfAborted();item.job.state='running';await execute(brief,directory,controller.signal);controller.signal.throwIfAborted();for(const name of ['deck.pptx','deck.pdf',...brief.pages.map((_,i)=>`slide-${String(i+1).padStart(2,'0')}.png`)])if((await stat(path.join(directory,name))).size<100)throw Error('render-failed');item.job.state='ready'}
        catch(error){if(error instanceof Error && error.message==='stop-unverified'){item.job.state='error';item.job.error='stop-unverified'}else if(controller.signal.aborted){item.job.state=controller.signal.reason?.message==='timeout'?'error':'cancelled';if(item.job.state==='error')item.job.error='timeout'}else{item.job.state='error';item.job.error=error instanceof Error && ['memory-low','powerpoint-busy'].includes(error.message)?error.message:'render-failed'}}
        finally{clearTimeout(timer);item.job.ended=Date.now();item.job.durationMs=item.job.ended-item.job.created;occupied=item.job.error==='stop-unverified';await writeFile(path.join(directory,'job.json'),JSON.stringify(item.job,null,2)).catch(()=>{})}
      })()
      return snapshot(item)
    },
    get(owner:string,id:string){return snapshot(own(owner,id))},
    cancel(owner:string,id:string){const item=own(owner,id);if(['queued','running'].includes(item.job.state)){item.job.state='cancelling';item.controller.abort(Error('cancelled'))}return snapshot(item)},
    async file(owner:string,id:string,name:string){const item=own(owner,id);if(item.job.state!=='ready'||!(['deck.pptx','deck.pdf'].includes(name)||/^slide-0[1-8]\.png$/.test(name)))throw new SlidesError('not-found');return readFile(path.join(item.directory,name))},
    close(){jobs.forEach(item=>item.controller.abort(Error('cancelled')))},
  }
}
