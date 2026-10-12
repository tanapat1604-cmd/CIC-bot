import {createChromeResearchCore} from './chrome/core.js'
import {createVoiceCore} from './voice/core.js'
import {createAppOpenCore} from './voice/apps.js'
import {createYouTubeCore} from './youtube/core.js'
import {createNotepadCore} from './notepad/core.js'
import {createLabCore} from './lab/core.js'
import {createScheduler} from './core/scheduler.js'
import {freemem} from 'node:os'
import {createCore} from './core/core.js'
import {coreCapabilities} from './core/capabilities.js'
import {CoreError,exact,uuid} from '../shared/core.js'
import { createOcrManager, OcrError } from './ocr.js'
import { withOcrReference } from './ocrReference.js'
import { createSlidesManager, SlidesError } from './slides.js'
import { createChessEngine, EngineError, type ChessEngine } from './chessEngine.js'
import { parseChessRequest } from '../shared/chess.js'
import { CIC_CAPABILITIES } from '../shared/capabilities.js'
import { createLiveReply } from './liveReply.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { ChatError, LIMITS, validateRequest, type ErrorCode, type TextEvent } from '../shared/chatProtocol.js'
import { SYSTEM_INSTRUCTION, testProvider, type Provider } from './provider.js'

type Options = { chrome?: ReturnType<typeof createChromeResearchCore>; voice?: ReturnType<typeof createVoiceCore>; youtube?: ReturnType<typeof createYouTubeCore>; notepad?: ReturnType<typeof createNotepadCore>; lab?: ReturnType<typeof createLabCore>; core?: ReturnType<typeof createCore>; ocr?: ReturnType<typeof createOcrManager>; slides?: ReturnType<typeof createSlidesManager>; chess?: ChessEngine; origins?: string[]; provider?: Provider; timeoutMs?: number; requestsPerMinute?: number; maxRequests?: number; maxConcurrent?: number; enabled?: boolean; log?: (entry: { requestId: string; status: string; durationMs: number }) => void }
type Access = { conversationGranted?: boolean; conversationPaused?: boolean; conversationPauseSettled?: boolean; conversationRevision?: number; conversationNonces?: Set<string>; voiceRate?: { window:number; asr:number; tts:number }; expires: number; active: number; window: number; count: number; operations: Set<string> }
const loopback = (address?: string) => address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
export function createChatServer(options: Options = {}) {
  const origins = options.origins ?? ['http://127.0.0.1:5173', 'http://127.0.0.1:4173']
  // Local trust boundary only. Public deployment needs a separately reviewed identity layer.
  if (origins.some(origin => { const url = new URL(origin); return url.origin !== origin || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' })) throw new Error('Only explicit 127.0.0.1 development origins are supported')
  const provider = options.provider ?? testProvider
  const chess = options.chess ?? createChessEngine()
  const slides = options.slides ?? createSlidesManager()
  const ocr = options.ocr ?? createOcrManager()
  let chessWindow = Date.now(), chessCalls = 0
  const access = new Map<string, Access>(), controllers = new Set<AbortController>()
  const conversationAllowed=(owner:string)=>access.get(owner)?.conversationGranted===true&&access.get(owner)?.conversationPaused!==true&&(access.get(owner)?.expires??0)>Date.now()
  let active = 0, spent = 0, bootstrapWindow = Date.now(), bootstraps = 0
  const sharedScheduler=options.chrome||options.core||options.lab||options.notepad||options.youtube||options.voice?undefined:createScheduler({freeMiB:()=>freemem()/1048576,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()})
  const core:ReturnType<typeof createCore>=options.core??createCore({scheduler:sharedScheduler,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()||(youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy())||(!sharedScheduler&&(lab.isBusy()||notepad.isBusy())),ownerAlive:owner=>(access.get(owner)?.expires??0)>Date.now()})
  const lab:ReturnType<typeof createLabCore>=options.lab??createLabCore({scheduler:sharedScheduler,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()||(youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy())||(sharedScheduler?sharedScheduler.busy():core.isBusy()||notepad.isBusy()),ownerAlive:owner=>(access.get(owner)?.expires??0)>Date.now()})
  const notepad:ReturnType<typeof createNotepadCore>=options.notepad??createNotepadCore({scheduler:sharedScheduler,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()||(youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy())||(sharedScheduler?sharedScheduler.busy():core.isBusy()||lab.isBusy()),ownerAlive:who=>(access.get(who)?.expires??0)>Date.now()})
  const youtube:ReturnType<typeof createYouTubeCore>=options.youtube??createYouTubeCore({scheduler:sharedScheduler??createScheduler({freeMiB:()=>freemem()/1048576,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()}),externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy()||(sharedScheduler?sharedScheduler.busy():core.isBusy()||lab.isBusy()||notepad.isBusy()),ownerAlive:who=>(access.get(who)?.expires??0)>Date.now()})
  const voice:ReturnType<typeof createVoiceCore>=options.voice??createVoiceCore({scheduler:sharedScheduler??createScheduler({freeMiB:()=>freemem()/1048576,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()}),externalBusy:kind=>!!active||slides.isBusy()||ocr.isBusy()||(kind==='tts'?youtube.isExecuting()||apps.isExecuting():youtube.isBusy()||apps.isBusy())||core.isBusy()||lab.isBusy()||notepad.isBusy()||chrome.isBusy(),ownerAlive:who=>(access.get(who)?.expires??0)>Date.now()})
  const apps=createAppOpenCore({sessionAllowed:conversationAllowed,scheduler:sharedScheduler??createScheduler({freeMiB:()=>freemem()/1048576,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()}),externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()||voice.isBusy()||youtube.isBusy()||core.isBusy()||lab.isBusy()||notepad.isBusy()||chrome.isBusy(),ownerAlive:who=>(access.get(who)?.expires??0)>Date.now()})
  const chrome:ReturnType<typeof createChromeResearchCore>=options.chrome??createChromeResearchCore({sessionAllowed:conversationAllowed,scheduler:sharedScheduler??createScheduler({freeMiB:()=>freemem()/1048576,externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()}),externalBusy:()=>!!active||slides.isBusy()||ocr.isBusy()||voice.isBusy()||youtube.isBusy()||apps.isBusy()||core.isBusy()||lab.isBusy()||notepad.isBusy(),ownerAlive:who=>(access.get(who)?.expires??0)>Date.now()})
  const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
  // Drain rejected bodies without buffering so HTTP clients can receive the error
  // before reusing/closing the socket; requestTimeout bounds unfinished uploads.
  const fail = (res: ServerResponse, status: number, code: ErrorCode) => { res.req.resume(); json(res, status, { code }) }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
    // Reject DNS rebinding, proxies and non-loopback peers before all endpoints.
    const port = (server.address() as { port: number }).port
    if (!loopback(req.socket.remoteAddress) || req.headers.host !== `127.0.0.1:${port}` || req.headers['x-forwarded-for'] || req.headers.forwarded) { fail(res, 403, 'unauthorized'); return }
    const origin = req.headers.origin
    if (origin && !origins.includes(origin)) { fail(res, 403, 'unauthorized'); return }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin') }
    if (req.method === 'OPTIONS' && origin) { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); res.end(); return }
    if(req.url?.startsWith('/conversation/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        if(req.method==='GET'&&req.url==='/conversation/permission'){json(res,200,{granted:session.conversationGranted===true,expiresAt:session.expires,revision:session.conversationRevision??0});return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(req.url==='/conversation/grant'){
          if(!exact(value,['acknowledged','scopes','operationId','sessionRevision'])||value.acknowledged!==true||!uuid(value.operationId)||!Number.isSafeInteger(value.sessionRevision)||Number(value.sessionRevision)<0||!Array.isArray(value.scopes)||value.scopes.length!==2||value.scopes[0]!=='app-open'||value.scopes[1]!=='chrome-search-read')throw new CoreError('invalid')
          const nonces=session.conversationNonces??=new Set<string>();if(nonces.has(value.operationId as string))throw new CoreError('replay');if(nonces.size>=128)throw new CoreError('capacity');nonces.add(value.operationId as string);if(value.sessionRevision!==(session.conversationRevision??0)||session.expires<=Date.now())throw new CoreError('permission-denied');
          if(session.conversationPaused&&session.conversationPauseSettled!==true)throw new CoreError('busy');session.conversationGranted=true;session.conversationPaused=false;session.expires=Date.now()+600000;res.setHeader('Set-Cookie','cic_local='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=600');json(res,200,{granted:true,expiresAt:session.expires});return
        }
        if(req.url==='/conversation/continue'){
          if(!exact(value,['sessionRevision'])||!Number.isSafeInteger(value.sessionRevision))throw new CoreError('invalid')
          if(value.sessionRevision!==(session.conversationRevision??0)||session.conversationGranted!==true||session.expires<=Date.now())throw new CoreError('permission-denied')
          if(session.conversationPaused&&session.conversationPauseSettled!==true)throw new CoreError('busy')
          session.conversationPaused=false;session.expires=Date.now()+600000
          res.setHeader('Set-Cookie','cic_local='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=600')
          json(res,200,{granted:true,expiresAt:session.expires});return
        }
        if(req.url==='/conversation/pause'||req.url==='/conversation/revoke'){
          if(!exact(value,[]))throw new CoreError('invalid')
          const revoke=req.url==='/conversation/revoke';if(revoke)session.conversationGranted=false;session.conversationPaused=true;session.conversationPauseSettled=false;const revision=session.conversationRevision=(session.conversationRevision??0)+1
          const settled=await Promise.all([apps.stop(token!),chrome.stop(token!),notepad.stop(token!).catch(e=>{if(e instanceof CoreError&&e.code==='not-found')return{settled:true};throw e})])
          const stopped=settled.every(r=>r.settled===true);if(session.conversationRevision===revision)session.conversationPauseSettled=stopped;json(res,200,{revoked:revoke,paused:true,settled:stopped,chromeWindowsClosed:false});return
        }
        if(req.url==='/conversation/notepad/open'){
          if(!conversationAllowed(token!))throw new CoreError('permission-denied')
          if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
          if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
          json(res,201,await notepad.open(token!,value));return
        }
        throw new CoreError('invalid')
      }catch(error){const code=error instanceof CoreError?error.code:'failed';json(res,code==='permission-denied'?403:code==='busy'?429:400,{code});return}
    }
    if(req.url?.startsWith('/chrome/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/chrome\/jobs\/([a-f0-9-]{36})(?:\/(approve|session-approve))?$/.exec(req.url),operation=/^\/chrome\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1])||operation&&!uuid(operation[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&match&&!match[2]){json(res,200,chrome.get(token!,match[1]));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(operation||match?.[2]||req.url==='/chrome/stop'){
          if(!exact(value,[]))throw new CoreError('invalid')
          if(operation){await chrome.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true});return}
          if(req.url==='/chrome/stop'){json(res,200,await chrome.stop(token!));return}
          json(res,200,chrome.approve(token!,match![1],match![2]==='session-approve'));return
        }
        if(req.url!=='/chrome/plans')throw new CoreError('invalid')
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
        if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,chrome.plan(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='busy'||code==='memory'||code==='capacity'?429:400,{code});return}
    }
    if(req.url?.startsWith('/apps/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/apps\/jobs\/([a-f0-9-]{36})(?:\/(approve|session-approve))?$/.exec(req.url),operation=/^\/apps\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1])||operation&&!uuid(operation[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&match&&!match[2]){json(res,200,apps.get(token!,match[1]));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(operation||match?.[2]||req.url==='/apps/stop'){
          if(!exact(value,[]))throw new CoreError('invalid')
          if(operation){await apps.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true});return}
          if(req.url==='/apps/stop'){json(res,200,await apps.stop(token!));return}
          json(res,200,apps.approve(token!,match![1],match![2]==='session-approve'));return
        }
        if(req.url!=='/apps/plans')throw new CoreError('invalid')
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
        if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,apps.plan(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='busy'||code==='memory'||code==='capacity'?429:400,{code});return}
    }
    if(req.url?.startsWith('/voice/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/voice\/jobs\/([a-f0-9-]{36})(?:\/(audio))?$/.exec(req.url),operation=/^\/voice\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1])||operation&&!uuid(operation[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&req.url==='/voice/status'){json(res,200,{...voice.status(),sessionExpiresAt:session.expires});return}
        if(req.method==='GET'&&match){if(match[2]){const wav=voice.audio(token!,match[1]);res.writeHead(200,{'Content-Type':'audio/wav'});res.end(wav)}else json(res,200,voice.get(token!,match[1]));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),700000)
        if(operation||req.url==='/voice/stop'){if(!exact(value,[]))throw new CoreError('invalid');if(operation){await voice.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true})}else json(res,200,await voice.stop(token!));return}
        if(req.url!=='/voice/jobs')throw new CoreError('invalid')
        // Speech input and fixed speech output each retain ten requests/minute.
        // A reply does not consume the next listening turn or native-tool budget.
        // Invalid requests are still charged, and Stop/cancel remain exempt.
        const rate=session.voiceRate??={window:Date.now(),asr:0,tts:0}
        if(Date.now()-rate.window>60000){rate.window=Date.now();rate.asr=0;rate.tts=0}
        const kind=typeof value==='object'&&value!==null&&'kind'in value&&value.kind==='tts'?'tts':'asr'
        if(++rate[kind]>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,voice.create(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='busy'||code==='voice-memory'||code==='capacity'?429:code==='too_large'?413:400,{code});return}
    }
    if(req.url?.startsWith('/youtube/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/youtube\/jobs\/([a-f0-9-]{36})(?:\/(approve|screenshot|show|normal-chrome))?$/.exec(req.url),operation=/^\/youtube\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1])||operation&&!uuid(operation[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&match&&!match[2]){json(res,200,youtube.get(token!,match[1]));return}
        if(req.method==='GET'&&match?.[2]==='screenshot'){const shot=await youtube.screenshot(token!,match[1]);res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(shot);return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(match?.[2]==='normal-chrome'){json(res,200,youtube.normalChrome(token!,match[1],value));return}
        if(match?.[2]==='show'){if(!exact(value,[]))throw new CoreError('invalid');json(res,200,await youtube.show(token!,match[1]));return}
        if(operation||match?.[2]==='approve'||req.url==='/youtube/stop'){
          if(!exact(value,[]))throw new CoreError('invalid')
          if(operation){await youtube.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true});return}
          if(req.url==='/youtube/stop'){json(res,200,await youtube.stop(token!));return}
          json(res,200,youtube.approve(token!,match![1]));return
        }
        if(req.url!=='/youtube/plans')throw new CoreError('invalid')
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
        if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,youtube.plan(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='busy'||code==='model-memory'||code==='capacity'?429:code==='too_large'?413:400,{code});return}
    }
    if(req.url?.startsWith('/notepad/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/notepad\/jobs\/([a-f0-9-]{36})(?:\/(approve))?$/.exec(req.url),operation=/^\/notepad\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1])||operation&&!uuid(operation[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&match&&!match[2]){json(res,200,notepad.get(token!,match[1]));return}
        if(req.method==='GET'&&req.url==='/notepad/observation'){json(res,200,await notepad.observe(token!));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(operation||match?.[2]||req.url==='/notepad/stop'){
          if(!exact(value,[]))throw new CoreError('invalid')
          if(operation){await notepad.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true});return}
          if(req.url==='/notepad/stop'){json(res,200,await notepad.stop(token!));return}
          json(res,200,notepad.approve(token!,match![1]));return
        }
        if(!['/notepad/open','/notepad/plans'].includes(req.url))throw new CoreError('invalid')
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
        if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,req.url==='/notepad/open'?await notepad.open(token!,value):await notepad.plan(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='busy'||code==='memory'||code==='capacity'?429:code==='too_large'?413:400,{code});return}
    }
    if(req.url?.startsWith('/lab/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/lab\/jobs\/([a-f0-9-]{36})(?:\/(approve))?$/.exec(req.url),operation=/^\/lab\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&match&&!match[2]){json(res,200,lab.get(token!,match[1]));return}
        if(req.method==='GET'&&req.url==='/lab/observation'){json(res,200,await lab.observe(token!));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(operation||match?.[2]||req.url==='/lab/stop'){
          if(!exact(value,[]))throw new CoreError('invalid')
          if(operation){await lab.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true});return}
          if(req.url==='/lab/stop'){json(res,200,await lab.stop(token!));return}
          json(res,200,lab.approve(token!,match![1]));return
        }
        if(!['/lab/open','/lab/plans'].includes(req.url))throw new CoreError('invalid')
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
        if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,req.url==='/lab/open'?await lab.open(token!,value):await lab.plan(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='busy'||code==='memory'||code==='capacity'?429:code==='too_large'?413:400,{code});return}
    }
    if(req.url==='/core/capabilities'&&req.method==='GET'){json(res,200,coreCapabilities(ocr.status(),voice.status()));return}
    if(req.url?.startsWith('/core/')){
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1],session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      try{
        const match=/^\/core\/jobs\/([a-f0-9-]{36})(?:\/(approve|cancel))?$/.exec(req.url),operation=/^\/core\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(match&&!uuid(match[1]))throw new CoreError('invalid')
        if(req.method==='GET'&&match&&!match[2]){json(res,200,core.get(token!,match[1]));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const value=await readBody(req,AbortSignal.timeout(5000),4096)
        if(match?.[2]||operation||req.url==='/core/stop'){
          if(!exact(value,[]))throw new CoreError('invalid')
          if(operation){if(!uuid(operation[1]))throw new CoreError('invalid');core.cancelOperation(token!,operation[1]);json(res,200,{acknowledged:true});return}
          if(req.url==='/core/stop'){json(res,200,core.stop(token!));return}
          json(res,200,match![2]==='approve'?core.approve(token!,match![1]):core.cancel(token!,match![1]));return
        }
        if(req.url!=='/core/plans')throw new CoreError('invalid')
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}
        if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        json(res,201,core.plan(token!,value));return
      }catch(error){const code=error instanceof CoreError?error.code:error instanceof ChatError?error.code:'failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='permission-denied'?403:code==='capacity'||code==='busy'?429:code==='too_large'?413:400,{code});return}
    }
    if (req.url === '/ocr/status' && req.method === 'GET') { json(res,200,ocr.status()); return }
    if (req.url === '/slides/status' && req.method === 'GET') { json(res, 200, slides.status()); return }
    if (req.url === '/chess/status' && req.method === 'GET') { json(res, 200, chess.status()); return }
    if (req.url === '/health' && req.method === 'GET') {
      let ready = options.enabled !== false && spent < (options.maxRequests ?? 100)
      let code: ErrorCode | undefined
      const probe = new AbortController(), closed = () => probe.abort()
      res.once('close', closed)
      try { if (ready) await provider.check?.(AbortSignal.any([probe.signal, AbortSignal.timeout(2500)])) }
      catch (error) { ready = false; code = error instanceof ChatError ? error.code : 'unavailable' }
      finally { res.off('close', closed); probe.abort() }
      if (!res.destroyed) json(res, 200, { version: 1, ready, kind: provider.kind, capabilities: ['text-stream'], ...(provider.kind === 'live' ? { capabilityProfile: CIC_CAPABILITIES } : {}), ...(provider.model ? { model: provider.model, location: 'local' } : {}), ...(code ? { code } : {}) })
      return
    }
    if (req.url?.startsWith('/ocr/')) {
      const token=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1], session=token?access.get(token):undefined
      if(!session||session.expires<Date.now()){fail(res,401,'unauthorized');return}
      const match=/^\/ocr\/jobs\/([a-f0-9-]{36})(?:\/(cancel|clear))?$/.exec(req.url)
      try {
        if(req.method==='GET'&&match&&!match[2]){json(res,200,ocr.get(token!,match[1]));return}
        if(!origin||req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']){fail(res,403,'unauthorized');return}
        const operation=/^\/ocr\/operations\/([a-f0-9-]{36})\/cancel$/.exec(req.url)
        if(operation||match?.[2]){const value=await readBody(req,AbortSignal.timeout(5000));if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length)throw new OcrError('invalid');if(operation)ocr.cancelOperation(token!,operation[1]);else if(match![2]==='clear')ocr.clear(token!,match![1]);else ocr.cancel(token!,match![1]);json(res,200,{ok:true});return}
        if(req.url!=='/ocr/jobs')throw new OcrError('invalid')
        if((core.isBusy()||lab.isBusy()||notepad.isBusy()||(youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy()))||active||session.active||slides.isBusy()||ocr.isBusy()){json(res,429,{code:'busy'});req.resume();return}
        if(Date.now()-session.window>60000){session.window=Date.now();session.count=0}if(++session.count>(options.requestsPerMinute??10)){fail(res,429,'limited');return}
        const controller=new AbortController(),closing=()=>controller.abort();res.once('close',closing);active++;session.active++
        try {const value=await readBody(req,AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]),5600000);controller.signal.throwIfAborted();const job=ocr.create(token!,value);res.once('close',()=>{if(!res.writableFinished)ocr.cancelOperation(token!,job.operationId)});json(res,202,job)}
        finally{res.off('close',closing);controller.abort();active--;session.active--}
      }catch(error){const code=error instanceof OcrError?error.code:error instanceof ChatError?error.code:'ocr-failed';if(!res.destroyed)json(res,code==='not-found'?404:code==='invalid'||code==='dimensions'||code==='unsupported'?400:code==='too-large'?413:code==='busy'||code==='capacity'?429:503,{code})}return
    }
    // No shared secret in the frontend: issue a short-lived HttpOnly local session.
    // Any trusted local process can bootstrap; this is not public user authentication.
    if (req.url?.startsWith('/slides/jobs')) {
      const token = /(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]
      const session = token ? access.get(token) : undefined
      if (!session || session.expires < Date.now()) { fail(res, 401, 'unauthorized'); return }
      try {
        const match = /^\/slides\/jobs\/([a-f0-9-]{36})(?:\/(cancel)|\/files\/(deck\.pptx|deck\.pdf|slide-0[1-8]\.png))?$/.exec(req.url)
        if (req.method === 'GET' && match && !match[2]) {
          if (!match[3]) { json(res, 200, slides.get(token!, match[1])); return }
          const data = await slides.file(token!, match[1], match[3])
          res.writeHead(200, { 'Content-Type': match[3].endsWith('.png') ? 'image/png' : match[3].endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Length': data.length, ...(match[3].startsWith('deck.') ? { 'Content-Disposition': 'attachment; filename="CIC-' + match[1] + '-' + match[3] + '"' } : {}) }); res.end(data); return
        }
        if (!origin || req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['content-encoding']) { fail(res, 403, 'unauthorized'); return }
        if (!match?.[2] && ((core.isBusy() || lab.isBusy() || notepad.isBusy() || (youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy())) || session.active || active || ocr.isBusy())) { json(res, 429, { code: 'busy' }); req.resume(); return }
        if (Date.now() - session.window > 60000) { session.window=Date.now();session.count=0 }
        // Stopping an owned job remains possible after the creation quota is spent.
        if (!match?.[2] && ++session.count > (options.requestsPerMinute ?? 10)) { fail(res,429,'limited');return }
        const value = await readBody(req, AbortSignal.timeout(5000))
        if (match?.[2]) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw new SlidesError('invalid');json(res,200,slides.cancel(token!,match[1]));return }
        if (req.url !== '/slides/jobs') throw new SlidesError('invalid')
        if((core.isBusy()||lab.isBusy()||notepad.isBusy()||(youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy()))||active||ocr.isBusy())throw new SlidesError('busy')
        const job = slides.create(token!, value)
        res.once('close', () => { if (!res.writableFinished) slides.cancel(token!,job.id) })
        json(res,202,job);return
      } catch(error) { const code = error instanceof SlidesError ? error.code : error instanceof ChatError ? error.code : 'unavailable'; json(res,code==='not-found'?404:code==='invalid'?400:code==='busy'||code==='capacity'?429:503,{code});return }
    }
    if (!origin || req.method !== 'POST') { fail(res, 403, 'unauthorized'); return }
    if (req.url === '/session') {
      if (Number(req.headers['content-length'] ?? 0) !== 0 || req.headers['transfer-encoding']) { fail(res, 400, 'invalid'); return }
      const now = Date.now()
      for (const [token, session] of access) if (session.expires < now && !session.active) access.delete(token)
      const existingToken=/(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1]
      const existing=existingToken?access.get(existingToken):undefined
      if(existing&&existing.expires>now){res.setHeader('Set-Cookie','cic_local='+existingToken+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+Math.max(1,Math.floor((existing.expires-now)/1000)));json(res,200,{ready:true});return}
      if (now - bootstrapWindow > 60000) { bootstrapWindow = now; bootstraps = 0 }
      if (++bootstraps > 10 || access.size >= 32) { fail(res, 429, 'limited'); return }
      const token = randomBytes(32).toString('hex')
      access.set(token, { expires: now + 600000, active: 0, window: now, count: 0, operations: new Set() })
      res.setHeader('Set-Cookie', `cic_local=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`)
      json(res, 200, { ready: true }); return
    }
    if (req.url !== '/chat' && req.url !== '/chess/analyze') { fail(res, 404, 'invalid'); return }
    const token = /(?:^|;\s*)cic_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]
    const session = token ? access.get(token) : undefined
    if (!session || session.expires < Date.now()) { fail(res, 401, 'unauthorized'); return }
    if ((core.isBusy() || lab.isBusy() || notepad.isBusy() || (youtube.isBusy()||voice.isBusy()||apps.isBusy()||chrome.isBusy())) || slides.isBusy() || ocr.isBusy()) { json(res,429,{ code: 'limited' });req.resume();return }
    if (req.url === '/chess/analyze') {
      if (req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['content-encoding']) { fail(res, 400, 'invalid'); return }
      if (Date.now() - chessWindow > 60000) { chessWindow = Date.now(); chessCalls = 0 }
      if (active || ++chessCalls > 90) { json(res, 429, { code: 'busy' }); req.resume(); return }
      const controller = new AbortController(), start = Date.now(), requestId = randomUUID()
      const closed = () => controller.abort()
      const timer = setTimeout(() => controller.abort(), 12000)
      controllers.add(controller); res.once('close', closed); active++; session.active++
      let status = 'error'
      try {
        let request
        try { request = parseChessRequest(await readBody(req, controller.signal)) } catch { throw new EngineError('invalid') }
        const result = await chess.run(request, controller.signal)
        if (!controller.signal.aborted && !res.destroyed) { json(res, 200, result); status = 'done' }
      } catch (error) {
        const code = error instanceof EngineError ? error.code : 'unavailable'
        status = controller.signal.aborted ? 'cancelled' : code
        if (!res.destroyed) json(res, code === 'invalid' ? 400 : code === 'busy' ? 429 : 503, { code })
      } finally {
        clearTimeout(timer); controller.abort(); controllers.delete(controller); res.off('close', closed); active--; session.active--
        if (!res.destroyed && !res.writableEnded) res.end()
        options.log?.({ requestId, status: 'chess-' + status, durationMs: Date.now() - start })
      }
      return
    }
    if (options.enabled === false) { fail(res, 503, 'unavailable'); return }
    if (spent >= (options.maxRequests ?? 100)) { fail(res, 429, 'limited'); return }
    if (Date.now() - session.window > 60000) { session.window = Date.now(); session.count = 0 }
    if (session.active || active >= (options.maxConcurrent ?? 2) || ++session.count > (options.requestsPerMinute ?? 10)) { fail(res, 429, 'limited'); return }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['content-encoding']) { fail(res, 400, 'invalid'); return }
    const controller = new AbortController(), requestId = randomUUID(), start = Date.now()
    const closed = () => controller.abort()
    res.once('close', closed); controllers.add(controller); active++; session.active++
    let timeout = false, status = 'error', identity: { sessionId: string; operationId: string } | undefined
    const timer = setTimeout(() => { timeout = true; controller.abort() }, options.timeoutMs ?? 30000)
    const event = async (value: TextEvent) => {
      if (res.destroyed) return
      if (!res.write(JSON.stringify(value) + '\n')) await once(res, 'drain', { signal: controller.signal })
    }
    try {
      const request = validateRequest(await readBody(req, controller.signal))
      let reference:unknown
      if(request.reference){try{reference=ocr.reference(token!,request.reference.jobId,request.reference.text)}catch{throw new ChatError('reference_expired')}}
      const selectedProvider=withOcrReference(provider,reference)
      if (spent >= (options.maxRequests ?? 100)) throw new ChatError('limited')
      identity = { sessionId: request.sessionId, operationId: request.operationId }
      if (session.operations.has(request.operationId)) throw new ChatError('invalid')
      session.operations.add(request.operationId); spent++
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' })
      res.flushHeaders()
      let length = 0
      const input = { messages: request.messages, system: SYSTEM_INSTRUCTION, maxOutputChars: LIMITS.outputChars }
      const reply = provider.kind === 'live' ? createLiveReply(selectedProvider, input, controller.signal) : null
      const responseSource = reply?.source ?? 'model'
      const stream = reply?.stream ?? selectedProvider.stream(input, controller.signal)
      const iterator = stream[Symbol.asyncIterator]()
      try {
        while (true) {
          const next = await abortable(iterator.next(), controller.signal)
          if (next.done) break
          if (typeof next.value !== 'string') throw new ChatError('unavailable')
          if (!next.value) continue
          length += next.value.length
          if (length > LIMITS.outputChars) throw new ChatError('output_limit')
          await event({ ...identity, type: 'delta', text: next.value, ...(provider.kind === 'live' ? { source: responseSource } : {}) })
        }
        await event({ ...identity, type: 'done', ...(provider.kind === 'live' ? { source: responseSource } : {}) }); status = 'done'
      } finally { controller.abort(); void iterator.return?.().catch(() => {}) }
    } catch (error) {
      const code = timeout ? 'timeout' : error instanceof ChatError ? error.code : 'unavailable'
      status = res.destroyed ? 'cancelled' : code
      if (!res.destroyed) {
        if (res.headersSent && identity) res.write(JSON.stringify({ ...identity, type: 'error', code }) + '\n')
        else fail(res, code === 'too_large' ? 413 : code === 'invalid' ? 400 : code === 'limited' ? 429 : 503, code)
      }
    } finally {
      clearTimeout(timer); controller.abort(); res.off('close', closed); controllers.delete(controller); session.active--; active--
      if (!res.writableEnded && !res.destroyed) res.end()
      options.log?.({ requestId, status, durationMs: Date.now() - start })
    }
  })
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 30
  server.on('close', () => { controllers.forEach(controller => controller.abort()); core.close(); void lab.close(); void notepad.close(); void youtube.close(); void voice.close(); void apps.close(); void chrome.close(); slides.close(); ocr.close(); access.clear() })
  return server
}
async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let listener: () => void = () => {}
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { listener = () => reject(signal.reason); signal.addEventListener('abort', listener, { once: true }) })]) }
  finally { signal.removeEventListener('abort', listener) }
}
async function readBody(req: IncomingMessage, signal: AbortSignal, maxBytes:number=LIMITS.bodyBytes) {
  if (Number(req.headers['content-length'] ?? 0) > maxBytes) throw new ChatError('too_large')
  const chunks: Buffer[] = []; let size = 0
  const iterator = req[Symbol.asyncIterator]()
  while (true) {
    const chunk = await abortable(iterator.next(), signal)
    if (chunk.done) break
    size += chunk.value.length
    if (size > maxBytes) throw new ChatError('too_large')
    chunks.push(chunk.value)
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) }
  catch { throw new ChatError('invalid') }
}

