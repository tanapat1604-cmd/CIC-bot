import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {CoreError,uuid} from '../../shared/core.js'
import {collectPersonalChrome} from './personalChromeCollector.js'
const SOURCE_SHA='cd3cf1cba85f40fcfab9f04cdc375eeac5eb3d953327091cf5d75b50bdc24b79'
const BINARY_SHA='74210b7d8f529e46aa5866565b51ff65e77db7546f76e54f826f15d2b3b18c07'
export type PersonalChromeTarget={windowId:string;pid:number;startTicks:string}
export type PersonalChromeReceipt={source:'personal-chrome-window';windowId:string;pid:number;startTicks:string;windowVerified:true;foregroundVerified:true;profileRead:false;reused:boolean}
export async function personalChromeConfigured(){try{const source=await fs.readFile(path.resolve('backend/chrome/CicPersonalChrome.cs')),exe=await fs.readFile(path.resolve('.tools/native-personal-chrome/CicPersonalChrome.exe'));return createHash('sha256').update(source).digest('hex')===SOURCE_SHA&&createHash('sha256').update(exe).digest('hex')===BINARY_SHA}catch{return false}}
export async function focusPersonalChrome(signal:AbortSignal,operationId:string,target?:PersonalChromeTarget):Promise<PersonalChromeReceipt>{
 if(!uuid(operationId))throw new CoreError('invalid');signal.throwIfAborted();if(!await personalChromeConfigured())throw new CoreError('personal-chrome-not-configured');signal.throwIfAborted()
 const nonce=randomUUID(),child=spawn(path.resolve('.tools/native-personal-chrome/CicPersonalChrome.exe'),[],{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']})
 return collectPersonalChrome(child,signal,operationId,nonce,target)
}
