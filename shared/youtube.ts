import {record} from './chatProtocol.js'
import {CoreError,exact,uuid} from './core.js'
export type MusicIntent={artist:string;latest:boolean}
export const YOUTUBE_STATES=['planning','waiting-permission','queued','running','succeeded','failed','cancelling','cancelled','stop-unverified'] as const
export type YouTubeResult={title:string;url:string;channel:string;channelUrl:string;published:string;latestEvidence:string;playerStarted:true;audibility:'not-verified';timeBefore:number;timeAfter:number}
export type ChromeHandoff={operationId:string;destination:'normal-chrome';state:'opening'|'requested'|'failed';launchAccepted:boolean;playbackVerified:false;reason?:string}
export type YouTubeJob={version:1;taskId:string;operationId:string;instruction:string;state:typeof YOUTUBE_STATES[number];model:string;raw?:string;intent?:MusicIntent;reason?:string;events:{message:string;elapsedMs:number}[];result?:YouTubeResult;browserOpen?:boolean;handoff?:ChromeHandoff}
export function parseChromeHandoffInput(v:unknown){if(!exact(v,['version','operationId','acknowledged'])||v.version!==1||!uuid(v.operationId)||v.acknowledged!==true)throw new CoreError('permission-denied');return{operationId:v.operationId}}
export function parseMusicIntent(v:unknown):MusicIntent{
 if(!exact(v,['artist','latest'])||typeof v.artist!=='string'||v.artist!==v.artist.trim()||!v.artist||v.artist.length>80||!/[\p{L}\p{N}]/u.test(v.artist)||/[^\p{L}\p{M}\p{N} .&'’_-]/u.test(v.artist)||typeof v.latest!=='boolean')throw new CoreError('invalid-model-plan')
 return {artist:v.artist,latest:v.latest}
}
export function requireMusicRequest(instruction:string){if(!/เพลง|\b(?:music|songs?|listen)\b/iu.test(instruction))throw new CoreError('invalid-model-plan')}
export function requireNamedArtist(intent:MusicIntent,instruction:string){
 const normalize=(v:string)=>v.normalize('NFC').replace(/\s+/gu,' ').trim().toLowerCase()
 const artist=normalize(intent.artist)
 // Pronouns and temporal/request words are ambiguous, not permission to invent an artist.
 const ambiguous=/^(?:เขา|เธอ|เรา|ฉัน|ผม|มัน|ใคร|ใครก็ได้|อะไรก็ได้|ล่าสุด|ใหม่ล่าสุด|ใหม่ที่สุด|เพลงใหม่|เพลง|ศิลปิน|music|song|songs|someone|anyone)$/u
 if(ambiguous.test(artist)||!normalize(instruction).includes(artist))throw new CoreError('invalid-model-plan')
}
export function parseYouTubeInput(v:unknown){
 if(!exact(v,['version','operationId','instruction','acknowledged'])||v.version!==1||!uuid(v.operationId)||v.acknowledged!==true||typeof v.instruction!=='string'||!v.instruction.trim()||v.instruction.length>200||[...v.instruction].some(c=>c.charCodeAt(0)<32)||/https?:|www\.|@|[\\/]/i.test(v.instruction))throw new CoreError('invalid')
 return{operationId:v.operationId,instruction:v.instruction.trim()}
}
export function youtubeUrl(raw:string){const u=new URL(raw,'https://www.youtube.com');if(u.protocol!=='https:'||u.hostname!=='www.youtube.com'||u.username||u.password||u.port)throw new CoreError('unsafe-url');return u}
export function channelUrl(raw:string){const u=youtubeUrl(raw);if(!/^\/(?:@[\p{L}\p{N}_.-]+|channel\/UC[\w-]{22})$/u.test(decodeURIComponent(u.pathname))||u.search||u.hash)throw new CoreError('unsafe-channel');return u.href}
export function watchUrl(raw:string){const u=youtubeUrl(raw),id=u.searchParams.get('v');if(u.pathname!=='/watch'||!id||!/^[-\w]{11}$/.test(id))throw new CoreError('unsafe-video');return 'https://www.youtube.com/watch?v='+id}
export function parseYouTubeJob(v:unknown):YouTubeJob{
 if(!record(v)||v.version!==1||!uuid(v.taskId)||!uuid(v.operationId)||typeof v.instruction!=='string'||v.instruction.length>200||typeof v.model!=='string'||v.model.length>120||!YOUTUBE_STATES.includes(v.state as YouTubeJob['state'])||!Array.isArray(v.events)||v.events.length>24)throw new CoreError('protocol')
 for(const e of v.events)if(!exact(e,['message','elapsedMs'])||typeof e.message!=='string'||e.message.length>400||typeof e.elapsedMs!=='number'||!Number.isFinite(e.elapsedMs)||e.elapsedMs<0)throw new CoreError('protocol')
 if(v.intent)parseMusicIntent(v.intent)
 if(v.raw!==undefined&&(typeof v.raw!=='string'||v.raw.length>4096))throw new CoreError('protocol')
 if(v.reason!==undefined&&(typeof v.reason!=='string'||v.reason.length>100))throw new CoreError('protocol')
 if(v.browserOpen!==undefined&&typeof v.browserOpen!=='boolean')throw new CoreError('protocol')
 if(v.handoff){const h=v.handoff;if(!record(h)||Object.keys(h).some(k=>!['operationId','destination','state','launchAccepted','playbackVerified','reason'].includes(k))||!uuid(h.operationId)||h.destination!=='normal-chrome'||!['opening','requested','failed'].includes(String(h.state))||typeof h.launchAccepted!=='boolean'||h.playbackVerified!==false||h.state==='requested'&&!h.launchAccepted||h.reason!==undefined&&(typeof h.reason!=='string'||h.reason.length>100))throw new CoreError('protocol')}
 if(v.state==='waiting-permission'&&!v.intent)throw new CoreError('protocol')
 if(v.result){const r=v.result;if(!record(r)||v.state!=='succeeded'||typeof r.title!=='string'||r.title.length>300||typeof r.channel!=='string'||typeof r.channelUrl!=='string'||typeof r.published!=='string'||typeof r.latestEvidence!=='string'||typeof r.url!=='string'||r.playerStarted!==true||r.audibility!=='not-verified'||typeof r.timeBefore!=='number'||typeof r.timeAfter!=='number'||!Number.isFinite(r.timeBefore)||!Number.isFinite(r.timeAfter)||r.timeAfter<=r.timeBefore)throw new CoreError('protocol');watchUrl(r.url);channelUrl(r.channelUrl)}
 if(v.state==='succeeded'&&!v.result)throw new CoreError('protocol')
 return v as YouTubeJob
}
