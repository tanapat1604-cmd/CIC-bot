import fs from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {CoreError,exact,uuid} from '../shared/core.js'
export type MemoryEntry={id:string;label:string;value:string;confirmed:true;updatedAt:string}
export type MemorySnapshot={version:1;revision:number;entries:MemoryEntry[]}
const clean=(value:unknown,limit:number)=>{if(typeof value!=='string'||!value.trim()||value.length>limit||Array.from(value).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new CoreError('invalid');return value.normalize('NFC').trim()}
export function createPersonalMemory(file=path.resolve('.tools/personal-memory.json')){
 let queue:Promise<unknown>=Promise.resolve()
 async function read():Promise<MemorySnapshot>{
  try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>100000)throw new CoreError('failed');const row=JSON.parse(await fs.readFile(file,'utf8')) as MemorySnapshot
   if(!exact(row,['version','revision','entries'])||row.version!==1||!Number.isSafeInteger(row.revision)||row.revision<0||!Array.isArray(row.entries)||row.entries.length>50||new Set(row.entries.map(e=>e.id)).size!==row.entries.length)throw new CoreError('failed')
   for(const e of row.entries)if(!exact(e,['id','label','value','confirmed','updatedAt'])||!uuid(e.id)||e.confirmed!==true||clean(e.label,80)!==e.label||clean(e.value,400)!==e.value||typeof e.updatedAt!=='string'||!Number.isFinite(Date.parse(e.updatedAt)))throw new CoreError('failed')
   return row
  }catch(error){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')return{version:1,revision:0,entries:[]};throw error}
 }
 return{read,change(value:unknown):Promise<MemorySnapshot>{const operation=queue.then(async()=>{
  const add=exact(value,['version','operationId','acknowledged','revision','action','label','value']),edit=exact(value,['version','operationId','acknowledged','revision','action','id','label','value']),remove=exact(value,['version','operationId','acknowledged','revision','action','id'])
  if(!add&&!edit&&!remove||value.version!==1||!uuid(value.operationId)||value.acknowledged!==true||!Number.isSafeInteger(value.revision)||!(add&&value.action==='add'||edit&&value.action==='edit'||remove&&value.action==='delete'))throw new CoreError('invalid')
  const row=await read();if(value.revision!==row.revision)throw new CoreError('replay')
  const now=new Date().toISOString()
  if(value.action==='add'){if(row.entries.length>=50)throw new CoreError('capacity');row.entries.push({id:randomUUID(),label:clean(value.label,80),value:clean(value.value,400),confirmed:true,updatedAt:now})}
  else{if(!uuid(value.id))throw new CoreError('invalid');const index=row.entries.findIndex(e=>e.id===value.id);if(index<0)throw new CoreError('not-found');if(value.action==='delete')row.entries.splice(index,1);else row.entries[index]={...row.entries[index],label:clean(value.label,80),value:clean(value.value,400),updatedAt:now}}
  row.revision++;await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp'
  try{await fs.writeFile(temporary,JSON.stringify(row,null,2),{flag:'wx'});await fs.rename(temporary,file)}finally{await fs.unlink(temporary).catch(()=>{})}
  return row
 });queue=operation.catch(()=>{});return operation}}
}
