import {test,expect,type Page} from '@playwright/test'
import {once} from 'node:events'
import {createScheduler} from '../backend/core/scheduler'
import {createChromeResearchCore} from '../backend/chrome/core'
import {createVoiceCore} from '../backend/voice/core'
import {createChatServer} from '../backend/server'
import {proposeChromeQuery,selectChromeResult,chromeResultCandidates} from '../backend/chrome/planner'
import {parseChromeResearchInput,parseChromeObservation,type ChromeObservation} from '../shared/chromeObservation'
const input=(instruction='วิธีออกกำลังกาย20นาที')=>({version:1,operationId:crypto.randomUUID(),instruction})
function snapshot(query='วิธีออกกำลังกาย20นาที'):ChromeObservation{const observationId=crypto.randomUUID();return{source:'native-chrome-uia',readOnly:true,instanceId:crypto.randomUUID(),observationId,windowId:'123',pid:456,startTicks:'789',query,urlVerified:true,title:'FIXTURE search page',nodes:[{reference:observationId+':0',role:'Hyperlink',name:'FIXTURE public exercise article',enabled:true,contentLink:true}],truncated:false,elapsedMs:1,geometry:{left:0,top:0,right:100,bottom:100}}}
function fixture(options:{allowed?:(owner:string)=>boolean;free?:()=>number;alive?:()=>boolean;select?:typeof selectChromeResult;changed?:boolean;closeFailure?:boolean}={}){
 let launches=0,closed=false,observes=0
 const scheduler=createScheduler({freeMiB:()=>4096,externalBusy:()=>false})
 const core=createChromeResearchCore({sessionAllowed:options.allowed,scheduler,externalBusy:()=>false,ownerAlive:options.alive??(()=>true),freeMiB:options.free??(()=>4096),propose:async text=>text,select:options.select??(async()=> 'FIXTURE public exercise article'),start:async query=>{launches++;return{alive:()=>!closed,observe:async()=>{observes++;return{...snapshot(query),urlVerified:!options.changed||observes===1}},close:async()=>{closed=true;if(options.closeFailure)throw Error('close-unverified')}}}})
 return{core,launches:()=>launches,closed:()=>closed,async close(){await core.close();scheduler.close()}}
}
test('search input and observation are data, not arbitrary control permission',()=>{
 expect(parseChromeResearchInput(input()).instruction).toBe('วิธีออกกำลังกาย20นาที')
 for(const bad of [{...input(),approved:true},{...input(),windowId:'999'},{...input(),url:'file:///x'},{...input(),instruction:'x\nSendInput'},{...input(),operationId:'bad'}])expect(()=>parseChromeResearchInput(bad)).toThrow()
 expect(parseChromeObservation(snapshot()).readOnly).toBe(true)
 expect(()=>parseChromeObservation({...snapshot(),source:'model-guess'})).toThrow()
 expect(()=>parseChromeObservation({...snapshot(),nodes:[{reference:'foreign:0',role:'Button',name:'x',enabled:true}]})).toThrow()
})
test('model proposal launches nothing; one owner-bound approval precedes readback and reader exit',async()=>{
 const f=fixture();try{const j=f.core.plan('owner',input());await expect.poll(()=>f.core.get('owner',j.taskId).state).toBe('waiting-permission');expect(f.launches()).toBe(0);expect(()=>f.core.get('foreign',j.taskId)).toThrow('not-found');expect(()=>f.core.approve('foreign',j.taskId)).toThrow('not-found');f.core.approve('owner',j.taskId);expect(()=>f.core.approve('owner',j.taskId)).toThrow('permission-denied');await expect.poll(()=>f.core.get('owner',j.taskId).state).toBe('succeeded');expect(f.launches()).toBe(1);expect(f.closed()).toBe(true);expect(f.core.get('owner',j.taskId).result).toMatchObject({source:'native-chrome-uia',windowVerified:true,selectionIsProposal:true});expect((await f.core.stop('owner')).chromeWindowsClosed).toBe(false)}finally{await f.close()}
})
test('cancel-before-plan, low memory and revoked session cannot launch Chrome or resurrect an old nonce',async()=>{
 const f=fixture();try{const value=input();await f.core.cancelOperation('owner',value.operationId);expect(()=>f.core.plan('owner',value)).toThrow('replay');expect(f.launches()).toBe(0)}finally{await f.close()}
 for(const options of [{free:()=>Number.NaN},{free:()=>1535},{alive:()=>false}]){const g=fixture(options);try{expect(()=>g.core.plan('owner',input())).toThrow();expect(g.launches()).toBe(0)}finally{await g.close()}}
})
test('Stop waits for planner settlement, closes only its reader and suppresses late selected output',async()=>{
 let release:()=>void=()=>{},entered:()=>void=()=>{};const started=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r)
 const f=fixture({select:async()=>{entered();await held;return 'FIXTURE public exercise article'}})
 try{const j=f.core.plan('owner',input());await expect.poll(()=>f.core.get('owner',j.taskId).state).toBe('waiting-permission');f.core.approve('owner',j.taskId);await started;let settled=false;const stop=f.core.stop('owner').then(r=>{settled=true;return r});await expect.poll(()=>f.closed()).toBe(true);expect(settled).toBe(false);release();expect((await stop).settled).toBe(true);expect(f.core.get('owner',j.taskId).state).toBe('cancelled');expect(f.core.get('owner',j.taskId).result).toBeUndefined()}finally{release();await f.close()}
})
test('changed Chrome URL cannot pass final verification, and uncertain reader exit locks further work',async()=>{
 for(const options of [{changed:true},{closeFailure:true}]){const f=fixture(options);try{const j=f.core.plan('owner',input());await expect.poll(()=>f.core.get('owner',j.taskId).state).toBe('waiting-permission');f.core.approve('owner',j.taskId);await expect.poll(()=>f.core.get('owner',j.taskId).state).toBe(options.changed?'failed':'stop-unverified');expect(f.core.get('owner',j.taskId).result).toBeUndefined();if(options.closeFailure)expect(()=>f.core.plan('owner',input())).toThrow('busy')}finally{await f.close()}}
})
const env={AI_PROVIDER:'ollama',AI_MODEL:'qwen3:0.6b'}
function modelFetch(reply:unknown,remote=false){return(async(url:unknown)=>{const route=String(url);return new Response(JSON.stringify(route.endsWith('/api/ps')?{models:[]}:route.endsWith('/api/show')?{capabilities:['completion'],...(remote?{remote_host:'cloud'}:{})}:{done:true,done_reason:'stop',message:{content:JSON.stringify(reply)}}),{status:200})}) as typeof fetch}
test('local planner copies a real substring, rejects cloud mapping and cannot invent a live result reference',async()=>{
 expect(await proposeChromeQuery('ช่วยค้นหาวิธีออกกำลังกาย20นาที',new AbortController().signal,{env,fetcher:modelFetch({kind:'search',query:'วิธีออกกำลังกาย20นาที'}),freeMiB:()=>4096})).toBe('วิธีออกกำลังกาย20นาที')
 for(const reply of [{kind:'search',query:'invented-topic'},{kind:'search',query:'วิธีออกกำลังกาย20นาที',approved:true},{kind:'clarify',query:null}])await expect(proposeChromeQuery('วิธีออกกำลังกาย20นาที',new AbortController().signal,{env,fetcher:modelFetch(reply),freeMiB:()=>4096})).rejects.toThrow()
 await expect(proposeChromeQuery('วิธีออกกำลังกาย20นาที',new AbortController().signal,{env,fetcher:modelFetch({query:'วิธีออกกำลังกาย20นาที'},true),freeMiB:()=>4096})).rejects.toThrow()
 await expect(selectChromeResult('topic',snapshot(),new AbortController().signal,{env,fetcher:modelFetch({index:500}),freeMiB:()=>4096})).rejects.toThrow('invalid-model-plan')
})
test('HTTP rejects absent/foreign sessions and extra authority; exhausted rate never blocks Stop',async()=>{
 const f=fixture(),server=createChatServer({chrome:f.core,requestsPerMinute:1});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:4173'
 try{
  expect((await fetch(base+'/chrome/plans',{method:'POST',headers:{Origin,'Content-Type':'application/json'},body:JSON.stringify(input())})).status).toBe(401)
  const session=await fetch(base+'/session',{method:'POST',headers:{Origin}}),Cookie=session.headers.get('set-cookie')!.split(';')[0],headers={Origin,Cookie,'Content-Type':'application/json'}
  expect((await fetch(base+'/chrome/plans',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify(input())})).status).toBe(403)
  const created=await fetch(base+'/chrome/plans',{method:'POST',headers,body:JSON.stringify(input())});expect(created.status).toBe(201);const job=await created.json()
  const other=await fetch(base+'/session',{method:'POST',headers:{Origin}}),foreign=other.headers.get('set-cookie')!.split(';')[0]
  expect((await fetch(base+'/chrome/jobs/'+job.taskId,{headers:{Origin,Cookie:foreign}})).status).toBe(404)
  expect((await fetch(base+'/chrome/plans',{method:'POST',headers,body:JSON.stringify(input())})).status).toBe(429)
  expect((await fetch(base+'/chrome/stop',{method:'POST',headers,body:'{}'})).status).toBe(200);expect(f.launches()).toBe(0)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close()}
})
async function uiFixture(page:Page,baseURL:string){
 let grantedOwner='';const f=fixture({allowed:owner=>owner===grantedOwner}),scheduler=createScheduler({freeMiB:()=>4096,externalBusy:()=>false}),voice=createVoiceCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>4096,runner:async()=>{throw Error('no ASR or TTS simulation needed')}})
 const server=createChatServer({chrome:f.core,voice,origins:[new URL(baseURL).origin]});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port
 await page.route('http://127.0.0.1:8787/**',async route=>{
  const request=route.request(),response=await route.fetch({url:request.url().replace('http://127.0.0.1:8787',base)})
  // The injected native fixture mirrors the real server's successful scope
  // receipt, bound to its synthetic session; this never touches user Chrome.
  if(response.ok()&&request.url().endsWith('/conversation/grant'))grantedOwner=/(?:^|;\s*)cic_local=([a-f0-9]{64})/.exec((await request.allHeaders()).cookie??'')?.[1]??''
  if(request.url().endsWith('/conversation/revoke'))grantedOwner=''
  await route.fulfill({response})
 })
 await page.goto('./#/voice')
 return{...f,base,async close(){if(!page.isClosed())await page.goto('about:blank');await page.unrouteAll({behavior:'ignoreErrors'});server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();await voice.close();scheduler.close()}}
}
test('main conversation understands a general typed topic through the proposal adapter and still requires one approval; fixture UI only',async({page,baseURL})=>{
 const f=await uiFixture(page,baseURL!);try{await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill('วิธีออกกำลังกาย20นาที');await page.getByRole('button',{name:'ส่ง',exact:true}).click();await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true})).toBeVisible();expect(f.launches()).toBe(0);await expect(page.getByRole('log',{name:'สถานะคำสั่งเสียง'})).toContainText('วิธีออกกำลังกาย20นาที');await page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true}).click();await expect(page.getByRole('log',{name:'สถานะคำสั่งเสียง'})).toContainText('FIXTURE public exercise article');expect(f.launches()).toBe(1);await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยุติแล้ว')}finally{await f.close()}
})
test('denying a general search plan or pressing Stop cannot launch its Chrome window; fixture UI only',async({page,baseURL})=>{
 const f=await uiFixture(page,baseURL!);try{await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill('ไอเดียปลูกผักที่บ้าน');await page.getByRole('button',{name:'ส่ง',exact:true}).click();await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true})).toBeVisible();await page.getByRole('button',{name:'ไม่ต้อง',exact:true}).click();await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true})).toHaveCount(0);expect(f.launches()).toBe(0);await page.getByRole('button',{name:'หยุด',exact:true}).click();expect(f.launches()).toBe(0)}finally{await f.close()}
})


test('expired session frees the composer, late401 cannot revoke a new connection, and the old search does not replay; fixture UI only',async({page,baseURL})=>{
 const f=await uiFixture(page,baseURL!);let expire=true,delayCancel=true;const plans:string[]=[]
 await page.route('http://127.0.0.1:8787/chrome/**',async route=>{
  const req=route.request(),url=req.url()
  if(req.method()==='POST'&&url.endsWith('/plans'))plans.push(req.postDataJSON().instruction)
  if(req.method()==='GET'&&url.includes('/jobs/')&&expire){expire=false;await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'unauthorized'})});return}
  if(req.method()==='POST'&&url.endsWith('/cancel')&&delayCancel){delayCancel=false;await route.fetch({url:url.replace('http://127.0.0.1:8787',f.base)});await new Promise(r=>setTimeout(r,800));await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'unauthorized'})});return}
  await route.fallback()
 })
 try{
  await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill('เรื่องต้นไม้');await page.getByRole('button',{name:'ส่ง',exact:true}).click()
  await expect.poll(()=>plans.length).toBe(1)
  await expect(page.getByRole('button',{name:'เริ่มคุย',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true})).toHaveCount(0)
  await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill('เรื่องผัก');await page.getByRole('button',{name:'ส่ง',exact:true}).click()
  await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true})).toBeVisible()
  await expect(page.getByRole('log',{name:'สถานะคำสั่งเสียง'})).toContainText('เรื่องผัก')
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว',exact:true})).toBeVisible()
  expect(plans).toEqual(['เรื่องต้นไม้','เรื่องผัก']);expect(f.launches()).toBe(0)
  await page.getByRole('button',{name:'ไม่ต้อง',exact:true}).click()
 }finally{await f.close()}
})

test('session grant admits sequential work with fresh nonces; revocation and a new owner never inherit authority',async()=>{
 let allowed=true;const f=fixture({allowed:owner=>owner==='owner'&&allowed});
 try{
  const first=input();const a=f.core.plan('owner',first);await expect.poll(()=>f.core.get('owner',a.taskId).state).toBe('succeeded');expect(f.launches()).toBe(1);expect(()=>f.core.plan('owner',first)).toThrow('replay');await f.core.cancelOperation('owner',first.operationId);
  const b=f.core.plan('owner',input('เรื่องต้นไม้'));await expect.poll(()=>f.core.get('owner',b.taskId).state).toBe('succeeded');expect(f.launches()).toBe(2);await f.core.stop('owner');allowed=false;
  const c=f.core.plan('owner',input());await expect.poll(()=>f.core.get('owner',c.taskId).state).toBe('waiting-permission');expect(f.launches()).toBe(2);await f.core.stop('owner');
  allowed=true;const d=f.core.plan('foreign',input());await expect.poll(()=>f.core.get('foreign',d.taskId).state).toBe('waiting-permission');expect(f.launches()).toBe(2)
 }finally{await f.close()}
})
test('conversation grant is exact, session-bound, revocable and does not add control scopes',async()=>{
 const f=fixture(),server=createChatServer({chrome:f.core});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:4173';
 try{const auth=await fetch(base+'/session',{method:'POST',headers:{Origin}}),Cookie=auth.headers.get('set-cookie')!.split(';')[0],headers={Origin,Cookie,'Content-Type':'application/json'};
  const grant={operationId:crypto.randomUUID(),sessionRevision:0,acknowledged:true,scopes:['app-open','chrome-search-read']};
  expect((await fetch(base+'/conversation/grant',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify(grant)})).status).toBe(403);
  expect((await fetch(base+'/conversation/grant',{method:'POST',headers,body:JSON.stringify({...grant,scopes:['app-open','arbitrary-desktop']})})).status).toBe(400);
  expect((await fetch(base+'/conversation/grant',{method:'POST',headers,body:JSON.stringify(grant)})).status).toBe(200);
  expect(await(await fetch(base+'/conversation/permission',{headers})).json()).toMatchObject({granted:true});
  const other=await fetch(base+'/session',{method:'POST',headers:{Origin}});expect(await(await fetch(base+'/conversation/permission',{headers:{Origin,Cookie:other.headers.get('set-cookie')!.split(';')[0]}})).json()).toMatchObject({granted:false});
  expect(await(await fetch(base+'/conversation/revoke',{method:'POST',headers,body:'{}'})).json()).toMatchObject({revoked:true,settled:true,chromeWindowsClosed:false});
  expect(await(await fetch(base+'/conversation/permission',{headers})).json()).toMatchObject({granted:false});
  expect((await fetch(base+'/conversation/notepad/open',{method:'POST',headers,body:JSON.stringify({version:1,operationId:crypto.randomUUID(),acknowledged:true})})).status).toBe(403);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close()}
})

test('navigation links cannot compete with observed content titles; topic matching uses the actual query without a topic dictionary',async()=>{
 const o=snapshot('วิธีออกกำลังกาย20นาที');o.nodes=[
  {reference:o.observationId+':1',role:'Hyperlink',name:'ความช่วยเหลือเกี่ยวกับการช่วยเหลือพิเศษ',enabled:true,contentLink:false},
  {reference:o.observationId+':2',role:'Hyperlink',name:'ทั้งหมด',enabled:false,contentLink:false},
  {reference:o.observationId+':3',role:'Hyperlink',name:'20 นาที ออกกำลังกายง่ายๆ ได้เหงื่อ YouTube',enabled:true,contentLink:false}
 ];expect(chromeResultCandidates(o.query,o).map(n=>n.name)).toEqual(['20 นาที ออกกำลังกายง่ายๆ ได้เหงื่อ YouTube']);
 expect(await selectChromeResult(o.query,o,new AbortController().signal,{env,fetcher:modelFetch({index:0}),freeMiB:()=>4096})).toBe('20 นาที ออกกำลังกายง่ายๆ ได้เหงื่อ YouTube')
})

test('automatic public search never converts unsupported computer commands or ASR open mistakes into a web query',async()=>{
 for(const text of ['ลบไฟล์ทั้งหมดให้หน่อย','เปิดเกม','เปิดโครงให้หน่อย','ช่วยลบรูปทั้งหมด','please open Calculator','อย่าค้นหา']){
  let calls=0;const fetcher=(async()=>{calls++;return new Response('{}')}) as typeof fetch;
  await expect(proposeChromeQuery(text,new AbortController().signal,{env,fetcher,freeMiB:()=>4096})).rejects.toThrow('unsupported-request');expect(calls).toBe(0)
 }
 await expect(proposeChromeQuery('สวัสดี',new AbortController().signal,{env,fetcher:modelFetch({kind:'chat',query:'สวัสดี'}),freeMiB:()=>4096})).rejects.toThrow('needs-clarification')
 await expect(proposeChromeQuery('best beginner guitar lessons',new AbortController().signal,{env,fetcher:modelFetch({kind:'search',query:'best'}),freeMiB:()=>4096})).rejects.toThrow('needs-clarification')
 const f=fixture({allowed:()=>true});try{const job=f.core.plan('owner',input('เปิดโครงให้หน่อย'));await expect.poll(()=>f.core.get('owner',job.taskId).state).toBe('failed');expect(f.launches()).toBe(0)}finally{await f.close()}
})

test('a rejected duplicate approval cannot downgrade the authority check of an automatic job',async()=>{
 let allowed=true,release:()=>void=()=>{},entered:()=>void=()=>{};const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 const f=fixture({allowed:()=>allowed,select:async()=>{entered();await held;return 'FIXTURE public exercise article'}});
 try{const job=f.core.plan('owner',input());await started;expect(()=>f.core.approve('owner',job.taskId)).toThrow('permission-denied');allowed=false;release();await expect.poll(()=>f.core.get('owner',job.taskId).state).toBe('failed');expect(f.core.get('owner',job.taskId).reason).toBe('permission-denied');expect(f.core.get('owner',job.taskId).result).toBeUndefined()}finally{release();await f.close()}
})

test('Stop revocation invalidates a delayed grant body and a spent grant nonce cannot resurrect session permission',async()=>{
 const f=fixture(),server=createChatServer({chrome:f.core});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:4173';
 try{const auth=await fetch(base+'/session',{method:'POST',headers:{Origin}}),Cookie=auth.headers.get('set-cookie')!.split(';')[0],headers={Origin,Cookie,'Content-Type':'application/json'},operationId=crypto.randomUUID(),body=Buffer.from(JSON.stringify({acknowledged:true,scopes:['app-open','chrome-search-read'],operationId,sessionRevision:0}));
  let entered:()=>void=()=>{};const began=new Promise<void>(r=>entered=r),listener=(req:import('node:http').IncomingMessage)=>{if(req.url==='/conversation/grant'){server.off('request',listener);entered()}};server.on('request',listener);
  const {request:httpRequest}=await import('node:http');let upload:import('node:http').ClientRequest;
  const response=new Promise<{status:number;data:{code?:string}}>((resolve,reject)=>{upload=httpRequest(base+'/conversation/grant',{method:'POST',headers:{...headers,'Content-Length':body.length}},res=>{let raw='';res.on('data',part=>raw+=part);res.on('end',()=>resolve({status:res.statusCode!,data:JSON.parse(raw)}))});upload.on('error',reject);upload.write(body.subarray(0,20))});
  await began;expect((await fetch(base+'/conversation/revoke',{method:'POST',headers,body:'{}'})).status).toBe(200);upload!.end(body.subarray(20));expect(await response).toMatchObject({status:403,data:{code:'permission-denied'}});
  const permission=await(await fetch(base+'/conversation/permission',{headers})).json();expect(permission).toMatchObject({granted:false,revision:1});
  const repeat=await fetch(base+'/conversation/grant',{method:'POST',headers,body:JSON.stringify({acknowledged:true,scopes:['app-open','chrome-search-read'],operationId,sessionRevision:1})});expect(await repeat.json()).toMatchObject({code:'replay'});expect(f.launches()).toBe(0)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close()}
})


test('pause preserves consent but blocks execution until settled continuation; renewal cannot revive revoked or expired authority',async()=>{
 const f=fixture(),server=createChatServer({chrome:f.core});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:4173',now=Date.now;
 try{const auth=await fetch(base+'/session',{method:'POST',headers:{Origin}}),Cookie=auth.headers.get('set-cookie')!.split(';')[0],headers={Origin,Cookie,'Content-Type':'application/json'};
  const post=async(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)}),permission=async()=> (await fetch(base+'/conversation/permission',{headers})).json();
  expect((await post('/conversation/continue',{sessionRevision:0})).status).toBe(403);
  const operationId=crypto.randomUUID();expect((await post('/conversation/grant',{acknowledged:true,scopes:['app-open','chrome-search-read'],operationId,sessionRevision:0})).status).toBe(200);
  const initial=await permission();Date.now=()=>now()+120000;
  expect(await(await post('/conversation/pause',{})).json()).toMatchObject({revoked:false,paused:true,settled:true,chromeWindowsClosed:false});expect(await permission()).toMatchObject({granted:true,revision:1});
  expect((await post('/conversation/continue',{sessionRevision:0})).status).toBe(403);
  const continued=await post('/conversation/continue',{sessionRevision:1});expect(continued.status).toBe(200);expect(continued.headers.get('set-cookie')).toContain('Max-Age=600');const updated=await continued.json();expect(updated.expiresAt).toBeGreaterThan(initial.expiresAt+119000);
  expect((await post('/conversation/grant',{acknowledged:true,scopes:['app-open','chrome-search-read'],operationId,sessionRevision:1})).status).toBe(400);
  expect((await post('/conversation/continue',{sessionRevision:1,acknowledged:true})).status).toBe(400);
  expect((await post('/conversation/revoke',{})).status).toBe(200);expect(await permission()).toMatchObject({granted:false,revision:2});expect((await post('/conversation/continue',{sessionRevision:2})).status).toBe(403);
  expect((await post('/conversation/grant',{acknowledged:true,scopes:['app-open','chrome-search-read'],operationId:crypto.randomUUID(),sessionRevision:2})).status).toBe(200);
  Date.now=()=>now()+721001;expect((await post('/conversation/continue',{sessionRevision:2})).status).toBe(401);expect(f.launches()).toBe(0)
 }finally{Date.now=now;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close()}
})

test('a delayed continuation body cannot bypass a newer pause or explicit revocation',async()=>{
 const f=fixture(),server=createChatServer({chrome:f.core});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:4173';
 try{const auth=await fetch(base+'/session',{method:'POST',headers:{Origin}}),Cookie=auth.headers.get('set-cookie')!.split(';')[0],headers={Origin,Cookie,'Content-Type':'application/json'};
  await fetch(base+'/conversation/grant',{method:'POST',headers,body:JSON.stringify({acknowledged:true,scopes:['app-open','chrome-search-read'],operationId:crypto.randomUUID(),sessionRevision:0})});
  for(const [revision,path] of [[0,'pause'],[1,'revoke']] as const){
   const body=Buffer.from(JSON.stringify({sessionRevision:revision}));let entered:()=>void=()=>{};const began=new Promise<void>(r=>entered=r),listener=(req:import('node:http').IncomingMessage)=>{if(req.url==='/conversation/continue'){server.off('request',listener);entered()}};server.on('request',listener);
   const {request:httpRequest}=await import('node:http');let upload:import('node:http').ClientRequest;
   const response=new Promise<number>((resolve,reject)=>{upload=httpRequest(base+'/conversation/continue',{method:'POST',headers:{...headers,'Content-Length':body.length}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!))});upload.on('error',reject);upload.write(body.subarray(0,5))});
   await began;expect((await fetch(base+'/conversation/'+path,{method:'POST',headers,body:'{}'})).status).toBe(200);upload!.end(body.subarray(5));expect(await response).toBe(403)
  }
  expect(await(await fetch(base+'/conversation/permission',{headers})).json()).toMatchObject({granted:false,revision:2});expect(f.launches()).toBe(0)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close()}
})


test('retained consent cannot resume or grant execution while pause cleanup is still unsettled',async()=>{
 const f=fixture();let entered:()=>void=()=>{},release:()=>void=()=>{};const began=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),originalStop=f.core.stop;f.core.stop=async owner=>{entered();await gate;return originalStop(owner)};
 const server=createChatServer({chrome:f.core});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:4173';
 try{const auth=await fetch(base+'/session',{method:'POST',headers:{Origin}}),Cookie=auth.headers.get('set-cookie')!.split(';')[0],headers={Origin,Cookie,'Content-Type':'application/json'},post=(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
  expect((await post('/conversation/grant',{acknowledged:true,scopes:['app-open','chrome-search-read'],operationId:crypto.randomUUID(),sessionRevision:0})).status).toBe(200);
  const pausing=post('/conversation/pause',{});await began;
  expect((await post('/conversation/continue',{sessionRevision:1})).status).toBe(429);
  expect((await post('/conversation/grant',{acknowledged:true,scopes:['app-open','chrome-search-read'],operationId:crypto.randomUUID(),sessionRevision:1})).status).toBe(429);
  expect((await post('/conversation/notepad/open',{version:1,operationId:crypto.randomUUID(),acknowledged:true})).status).toBe(403);
  release();expect(await(await pausing).json()).toMatchObject({paused:true,settled:true,revoked:false});expect((await post('/conversation/continue',{sessionRevision:1})).status).toBe(200);expect(f.launches()).toBe(0)
 }finally{release();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close()}
})
