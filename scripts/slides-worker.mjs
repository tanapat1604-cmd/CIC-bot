import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
const directory=path.resolve(process.argv[2])
const approvedRoot=path.resolve('.cic-user-files/slides')
if(!directory.startsWith(approvedRoot+path.sep)||!path.isAbsolute(process.env.CIC_SLIDES_MODULE??''))throw Error('Invalid operator configuration')
const brief=JSON.parse(await fs.readFile(path.join(directory,'brief.json'),'utf8'))
const PptxGenJS=createRequire(import.meta.url)(process.env.CIC_SLIDES_MODULE)
const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='CIC local file builder';pptx.subject=brief.brief;pptx.title=brief.title;pptx.lang='th-TH'
if(brief.design!==undefined&&!['professional','jarvis'].includes(brief.design))throw Error('Invalid slide design')
const dark=brief.design==='jarvis'
for(const [i,page] of brief.pages.entries()){
 const slide=pptx.addSlide();slide.background={color:dark?'071923':'F7F8FA'}
 const opts={fontFace:'Leelawadee UI',margin:0,breakLine:false,valign:'top',color:dark?'EFF7FA':'14243A'}
 slide.addText(page.title,{...opts,x:0.65,y:0.55,w:12,h:1.25,fontSize:30,bold:true})
 for(const [n,line] of page.body.entries()) {
  if(dark){
   slide.addText(String(n+1).padStart(2,'0'),{...opts,x:0.7,y:2.1+n*1.32,w:0.65,h:1.12,fontSize:24,bold:true,color:'67E8F9'})
   slide.addText(line,{...opts,x:1.55,y:2.1+n*1.32,w:11.05,h:1.12,fontSize:24,color:n===0?'67E8F9':'EFF7FA',bold:n===0})
  } else slide.addText(line,{...opts,x:0.7,y:2.1+n*1.32,w:11.9,h:1.12,fontSize:24})
 }
 slide.addText(`CIC เครื่องมือสร้างไฟล์ในเครื่อง   ${i+1}/${brief.pages.length}`,{...opts,x:0.7,y:7.03,w:11.8,h:0.25,fontSize:11,color:dark?'ABC2CF':'4C6078'})
 slide.addNotes(`Design: ${brief.design??'professional'}. Source: user-reviewed outline. No model planning or screen control. Brief: ${brief.brief}`)
}
await pptx.writeFile({fileName:path.join(directory,'deck-draft.pptx'),compression:true})
// PptxGenJS 4.0.1 emits unused slideMaster content-type overrides for text decks.
// Remove only phantom master overrides; reject all other missing package targets.
const JSZip=createRequire(process.env.CIC_SLIDES_MODULE)('jszip')
const zip=await JSZip.loadAsync(await fs.readFile(path.join(directory,'deck-draft.pptx'))),removed=[]
const attribute=(tag,name)=>new RegExp(name+'="([^"]*)"').exec(tag)?.[1]
let types=await zip.file('[Content_Types].xml').async('string')
types=types.replace(/<Override\b[^>]*\/>/g,tag=>{
 const part=attribute(tag,'PartName')?.replace(/^\//,'')
 if(part&&!zip.file(part)){
  if(!/^ppt\/slideMasters\/slideMaster[2-9][0-9]*\.xml$/.test(part))throw Error('Missing content type target')
  removed.push(part);return ''
 }
 return tag
})
zip.file('[Content_Types].xml',types)
for(const name of Object.keys(zip.files).filter(name=>name.endsWith('.rels'))){
 const owner=name==='_rels/.rels'?'':name.replace('/_rels/','/').replace(/\.rels$/,'')
 const rels=await zip.file(name).async('string')
 for(const tag of rels.match(/<Relationship\b[^>]*\/>/g)??[]){
  if(attribute(tag,'TargetMode')==='External')throw Error('External relationships unsupported')
  const target=attribute(tag,'Target');if(!target)throw Error('Missing relationship target')
  const resolved=target.startsWith('/')?target.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(owner),target))
  if(!zip.file(resolved))throw Error('Missing relationship part')
 }
}
await fs.writeFile(path.join(directory,'deck.pptx'),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),{flag:'wx'})
await fs.writeFile(path.join(directory,'package-check.json'),JSON.stringify({removedUnusedMasterOverrides:removed,internalRelationshipTargetsVerified:true,noExternalRelationships:true},null,2))
await new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.resolve('scripts/slides-render.ps1'),'-Directory',directory],{windowsHide:true,stdio:['ignore','ignore','pipe']});let err='';child.stderr.on('data',chunk=>err=(err+chunk).slice(-1000));child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error(err)))})
