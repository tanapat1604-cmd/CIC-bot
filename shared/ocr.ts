import { record } from './chatProtocol.js'
export const OCR_LIMITS = { bytes: 4*1024*1024, pixels: 4000000, side: 4096, regions: 3, processedPixels: 8000000, textChars: 8000, words: 4000, jobs: 16, timeoutMs: 20000 } as const
export type OcrLanguage = 'tha' | 'eng' | 'tha+eng'
export type OcrRegion = { x:number; y:number; width:number; height:number; language:OcrLanguage }
export type OcrSource = { kind:'file'|'screen-frame'; frameId:string; sourceId:string }
export type OcrInput = { operationId:string; imageBase64:string; width:number; height:number; regions:OcrRegion[]; source:OcrSource }
export type OcrWord = { text:string; x:number; y:number; width:number; height:number; region:number }
export type OcrResult = { text:string; words:OcrWord[]; width:number; height:number; source:OcrSource; engine:'Tesseract fast'; languages:OcrLanguage[]; regions:OcrRegion[]; transforms:{region:number;scaleX:number;scaleY:number;cropX:number;cropY:number}[]; durationMs:number; memory?:{workerPeakMiB:number|null;engineSampledPeakMiB:number|null;engineSampleIntervalMs:number;scope:string} }
export type OcrJob = { id:string; operationId:string; state:'running'|'cancelling'|'cancelled'|'error'|'ready'; source:OcrSource; error?:string; result?:OcrResult }
export type OcrReference = { jobId:string; text:string }
export function parseOcrInput(value:unknown):OcrInput {
 if(!record(value)||Object.keys(value).sort().join(',')!=='height,imageBase64,operationId,regions,source,width'||typeof value.operationId!=='string'||! /^[a-f0-9-]{36}$/.test(value.operationId))throw Error('invalid')
 const dimension=(x:unknown):x is number=>Number.isInteger(x)&&Number(x)>0&&Number(x)<=OCR_LIMITS.side
 if(!dimension(value.width)||!dimension(value.height)||value.width*value.height>OCR_LIMITS.pixels||typeof value.imageBase64!=='string'||value.imageBase64.length>Math.ceil(OCR_LIMITS.bytes/3)*4||!value.imageBase64.length||value.imageBase64.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(value.imageBase64))throw Error('invalid')
 if(!record(value.source)||Object.keys(value.source).sort().join(',')!=='frameId,kind,sourceId'||!['file','screen-frame'].includes(String(value.source.kind))||![value.source.frameId,value.source.sourceId].every(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)))throw Error('invalid')
 if(!Array.isArray(value.regions)||!value.regions.length||value.regions.length>OCR_LIMITS.regions)throw Error('invalid')
 for(const r of value.regions){if(!record(r)||Object.keys(r).sort().join(',')!=='height,language,width,x,y'||![r.x,r.y,r.width,r.height].every(Number.isInteger)||Number(r.x)<0||Number(r.y)<0||Number(r.width)<1||Number(r.height)<1||Number(r.x)+Number(r.width)>value.width||Number(r.y)+Number(r.height)>value.height||!['tha','eng','tha+eng'].includes(String(r.language)))throw Error('invalid')}
 return value as OcrInput
}
export function imageHeader(bytes:Uint8Array):{format:'PNG'|'JPEG';width:number;height:number} {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 if(bytes.length>=33&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)){
  if(view.getUint32(8)!==13||String.fromCharCode(...bytes.slice(12,16))!=='IHDR'||bytes[24]!==8||![0,2,4,6].includes(bytes[25]))throw Error('unsupported')
  return {format:'PNG',width:view.getUint32(16),height:view.getUint32(20)}
 }
 if(bytes.length>4&&bytes[0]===255&&bytes[1]===216){
  let offset=2
  while(offset+4<=bytes.length){if(bytes[offset++]!==255)throw Error('invalid');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;if(offset+2>bytes.length)throw Error('invalid');const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)throw Error('invalid');if([192,193,194].includes(marker)){if(length<8||bytes[offset+2]!==8)throw Error('unsupported');return {format:'JPEG',height:view.getUint16(offset+3),width:view.getUint16(offset+5)}}offset+=length
  }
 }
 throw Error('unsupported')
}
