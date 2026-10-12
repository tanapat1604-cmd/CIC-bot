import {setTimeout as delay} from 'node:timers/promises'
import {createRequire} from 'node:module'
import type {BrowserServer,Browser,Page} from 'playwright-core'
import {CoreError} from '../../shared/core.js'
import {channelUrl,watchUrl,youtubeUrl,type MusicIntent,type YouTubeResult} from '../../shared/youtube.js'
// Exact Playwright 1.63 default: remove it rather than disable HTTPS upgrades or storage partitioning.
const defaultDisabledFeatures='--disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion'

export function allowedResource(raw:string,topNavigation=false){
 try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return false
  if(topNavigation)return u.hostname==='www.youtube.com'&&(/^\/(?:results|watch)?$/.test(u.pathname)||/^\/(?:@[\p{L}\p{N}_.-]+|channel\/UC[\w-]{22})(?:\/videos)?$/u.test(decodeURIComponent(u.pathname)))
  return ['youtube.com','youtube-nocookie.com','googlevideo.com','ytimg.com','gstatic.com','google.com','googleapis.com','doubleclick.net','googlesyndication.com','googleadservices.com','googletagservices.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))
 }catch{return false}
}
export function fullMusicTitle(title:string){return /official\s+(?:(?:music|lyric)\s+)?(?:video|audio|visualizer)|official\s*\)|\(audio\)/i.test(title)&&!/teaser|trailer|behind|live\b|reaction|preview|เบื้องหลัง|ทีเซอร์/i.test(title)}
export type MusicBrowser={pid:number;alive:()=>boolean;run:(intent:MusicIntent,signal:AbortSignal,event:(text:string)=>void)=>Promise<YouTubeResult>;screenshot:()=>Promise<Buffer>;close:()=>Promise<void>;show?:()=>Promise<{requested:true;windowState:'maximized'}>;openPage?:(appId:'chrome'|'youtube',signal:AbortSignal)=>Promise<{source:'owned-chrome';url:'about:blank'|'https://www.youtube.com/';windowVerified:true;playbackVerified:false}>;diagnostics?:()=>Promise<unknown>}
export async function startMusicBrowser():Promise<MusicBrowser>{
 const version:unknown=createRequire(import.meta.url)('playwright-core/package.json').version
 if(version!=='1.63.0')throw new CoreError('browser-version-mismatch')
 const {chromium}=await import('playwright-core')
 let server:BrowserServer|undefined,browser:Browser|undefined,page:Page|undefined,closed=false,exited=false,closing:Promise<void>|undefined
 const exitPromise=()=>{const p=server?.process();if(!p||exited||p.exitCode!==null||p.signalCode!==null)return Promise.resolve();return new Promise<void>(resolve=>p.once('exit',()=>resolve()))}
 async function close(){if(closing)return closing;if(closed&&exited)return;closed=true;closing=(async()=>{const done=exitPromise();try{if(server)await Promise.race([server.close(),delay(5000).then(()=>{throw Error('close-timeout')})])}catch{await server?.kill()}if(server)await Promise.race([done,delay(5000).then(()=>{throw new CoreError('browser-stop-unverified')})]);exited=true})();return closing}
 try{
  // Fresh temporary profile, visible branded Chrome with media codecs. No personal profile/CDP attach.
  server=await chromium.launchServer({channel:'chrome',headless:false,chromiumSandbox:true,host:'127.0.0.1',timeout:20000,ignoreDefaultArgs:['--mute-audio','--disable-client-side-phishing-detection','--unsafely-disable-devtools-self-xss-warnings','--enable-unsafe-swiftshader',defaultDisabledFeatures]})
  const process=server.process();process.once('exit',()=>{exited=true})
  browser=await chromium.connect(server.wsEndpoint());const context=await browser.newContext({viewport:null,locale:'en-US',acceptDownloads:false,serviceWorkers:'block'})
  context.on('page',p=>{if(page&&p!==page)void p.close()})
  await context.route('**/*',route=>{const req=route.request(),top=req.isNavigationRequest()&&req.frame()===page?.mainFrame();return allowedResource(req.url(),top)?route.continue():route.abort('blockedbyclient')})
  await context.routeWebSocket(/.*/,ws=>ws.close())
  page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000)
  const target=page
  async function show(){if(closed||exited||target.isClosed())throw new CoreError('browser-exited');const session=await context.newCDPSession(target);try{const {windowId}=await session.send('Browser.getWindowForTarget');await session.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'maximized'}});await target.bringToFront();const {bounds}=await session.send('Browser.getWindowBounds',{windowId});if(bounds.windowState!=='maximized')throw new CoreError('chrome-display-unverified');return{requested:true as const,windowState:'maximized' as const}}finally{await session.detach()}}
  await show()
  return{pid:process.pid!,alive:()=>!closed&&!exited&&!target.isClosed(),close,show,screenshot:()=>target.screenshot({type:'jpeg',quality:70}),diagnostics:()=>target.evaluate(()=>({url:location.href,headings:[...document.querySelectorAll('h1')].map(e=>({text:e.textContent,aria:e.getAttribute('aria-label'),html:e.outerHTML.slice(0,1500)})),badges:[...document.querySelectorAll('[aria-label*="Artist"], [aria-label*="Verified"]')].slice(0,10).map(e=>e.outerHTML.slice(0,1200)),cards:[...document.querySelectorAll('ytd-video-renderer')].slice(0,3).map(e=>({text:(e as HTMLElement).innerText.slice(0,600),anchors:[...e.querySelectorAll('ytd-channel-name a')].map(a=>({text:a.textContent,href:a.getAttribute('href')}))}))})),
   async openPage(appId,signal){
    const abort=()=>{void close().catch(()=>{})};signal.addEventListener('abort',abort,{once:true})
    try{signal.throwIfAborted();const url=appId==='chrome'?'about:blank' as const:'https://www.youtube.com/' as const;if(appId==='youtube')await target.goto(url,{waitUntil:'domcontentloaded'});signal.throwIfAborted();await show();if(target.url()!==url||target.isClosed()||!server||closed||exited)throw new CoreError('chrome-display-unverified');if(appId==='youtube'){await target.locator('ytd-app').waitFor({state:'visible'});if(await target.getByRole('button',{name:/confirm you.re not a bot/i}).count())throw new CoreError('human-required')}signal.throwIfAborted();return{source:'owned-chrome',url,windowVerified:true,playbackVerified:false}}finally{signal.removeEventListener('abort',abort)}
   },
   async run(intent,signal,event){
    const abort=()=>{void close().catch(()=>{})};signal.addEventListener('abort',abort,{once:true})
    const guard=()=>{signal.throwIfAborted();if(closed||exited||target.isClosed())throw new CoreError('browser-exited');youtubeUrl(target.url())}
    async function barrier(){guard();const text=await target.locator('body').innerText();if(/unusual traffic|confirm you.re not a bot|sign in to confirm|age.restricted|verify your age|not available in your country/i.test(text))throw new CoreError('human-required')}
    try{
     signal.throwIfAborted();event('ค้น YouTube จากศิลปินที่โมเดลเลือก: '+intent.artist)
     await target.goto('https://www.youtube.com/results?search_query='+encodeURIComponent(intent.artist+' official'),{waitUntil:'domcontentloaded'})
     await target.locator('ytd-video-renderer').first().waitFor({state:'visible'});await target.locator('ytd-video-renderer [aria-label="Official Artist Channel"]').first().waitFor({state:'attached'});await barrier()
     const candidates=await target.locator('ytd-video-renderer').evaluateAll(es=>es.slice(0,8).flatMap(e=>{const a=e.querySelector('ytd-channel-name a[href]'),badge=e.querySelector('[aria-label="Official Artist Channel"]');return a&&badge?[{name:a.textContent?.trim()??'',href:a.getAttribute('href')??''}]:[]}))
     const unique=[...new Map(candidates.map(c=>[c.href,c])).values()];if(unique.length!==1||!unique[0].name)throw Object.assign(new CoreError('artist-channel-ambiguous'),{cause:{candidates,unique}})
     const chosen=unique[0],official=channelUrl(chosen.href);event('พบข้อมูล Official Artist Channel: '+chosen.name)
     await target.goto(official,{waitUntil:'domcontentloaded'});await target.getByRole('heading',{level:1}).first().waitFor({state:'visible'});await barrier()
     const heading=target.getByRole('heading',{level:1}).first();const accessible=await heading.getAttribute('aria-label')??'';const label=await heading.innerText();if(!label.includes(chosen.name)||!(/Official Artist Channel/i.test(accessible)||(await target.getByRole('main').locator('[aria-label="Official Artist Channel"]').count())>0))throw new CoreError('channel-verification-failed')
     await target.getByRole('tab',{name:'Videos',exact:true}).click();const latest=target.getByRole('tab',{name:'Latest',exact:true});await latest.waitFor({state:'visible'});if(await latest.getAttribute('aria-selected')!=='true')await latest.click();if(await latest.getAttribute('aria-selected')!=='true')throw new CoreError('latest-not-selected')
     await target.locator('ytd-rich-item-renderer h3 a').first().waitFor({state:'visible'});guard()
     const listing=await target.locator('ytd-rich-item-renderer').evaluateAll(es=>es.slice(0,24).map(e=>({title:e.querySelector('h3')?.textContent?.trim()??'',href:e.querySelector('h3 a')?.getAttribute('href')??'',text:(e as HTMLElement).innerText.slice(0,600)})))
     const song=listing.find(v=>fullMusicTitle(v.title)&&v.href.startsWith('/watch?'));if(!song)throw new CoreError('full-song-not-found')
     const published=song.text.match(/\b\d+\s*(?:[smhdwy]|seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/i)?.[0]??'';if(!published)throw new CoreError('publication-not-visible')
     const url=watchUrl(song.href),title=song.title.slice(0,300);event('เลือกเพลงเต็มจาก Videos / Latest: '+title+' · '+published)
     await target.goto(url,{waitUntil:'domcontentloaded'});await target.getByRole('heading',{level:1}).first().waitFor({state:'visible'});await barrier()
     // Page observation after every action. Never force play through page JS or skip hidden ads.
     let before:number|null=null
     for(let i=0;i<120;i++){
      guard();const state=await target.evaluate(()=>{const player=document.querySelector('#movie_player'),video=player?.querySelector('video');return {title:document.querySelector('ytd-watch-metadata h1')?.textContent?.trim()??'',ad:!!player?.classList.contains('ad-showing'),time:video?.currentTime??0,paused:video?.paused??true,ready:video?.readyState??0,ended:video?.ended??false,muted:video?.muted??true,volume:video?.volume??0}})
      if(watchUrl(target.url())!==url)throw new CoreError('video-changed')
      if(state.paused){const play=target.getByRole('button',{name:'Play (k)',exact:true});if(await play.isVisible())await play.click();before=null}
      if(!state.ad&&state.ready>=3&&!state.paused&&!state.ended){if(state.title!==title)throw new CoreError('title-changed');if(state.muted){const unmute=target.getByRole('button',{name:'Unmute (m)',exact:true});if(await unmute.isVisible())await unmute.click();before=null}else if(state.volume<=0){throw new CoreError('volume-zero')}else if(before!==null&&state.time>before+.5){event('เพลงหลักเล่นแล้ว: เวลาเดินและไม่มีโฆษณา ไม่ยืนยันเสียงจากลำโพง');return{title,url,channel:chosen.name,channelUrl:official,published,latestEvidence:'Videos / Latest selected; first full music upload in visible ordered list',playerStarted:true,audibility:'not-verified',timeBefore:before,timeAfter:state.time}}else before=state.time}else before=null
      await delay(750,undefined,{signal})
     }
     throw new CoreError('playback-unverified')
    }finally{signal.removeEventListener('abort',abort)}
   },
  }
 }catch(e){await close();throw e}
}
