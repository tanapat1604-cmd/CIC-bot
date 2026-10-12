import {spawn,type ChildProcess} from 'node:child_process'
import {access,constants} from 'node:fs/promises'
import {CoreError} from '../../shared/core.js'
import {watchUrl} from '../../shared/youtube.js'
export const NORMAL_CHROME_PATH='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
export type ChromeLaunchReceipt={accepted:true;source:'installed-chrome-launcher';windowVerified:false}
export async function openNormalChrome(url:string,signal:AbortSignal,spawner:typeof spawn=spawn,exists:()=>Promise<void>=()=>access(NORMAL_CHROME_PATH,constants.F_OK)):Promise<ChromeLaunchReceipt>{
 if(watchUrl(url)!==url)throw new CoreError('unsafe-video')
 signal.throwIfAborted();await exists();signal.throwIfAborted()
 // The user's normal profile is used by Chrome itself. No debugger/profile/cookie access.
 const child:ChildProcess=spawner(NORMAL_CHROME_PATH,['--new-window',url],{shell:false,detached:true,stdio:'ignore',windowsHide:false})
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>finish(new CoreError('chrome-launch-unverified')),5000);timer.unref();const finish=(error?:Error)=>{clearTimeout(timer);child.off('spawn',launched);child.off('error',failed);if(error)reject(error);else resolve()},launched=()=>finish(),failed=()=>finish(new CoreError('chrome-launch-failed'));child.once('spawn',launched);child.once('error',failed)})
 child.unref()
 // Spawn acceptance is not proof that a visible window exists or media plays there.
 return{accepted:true,source:'installed-chrome-launcher',windowVerified:false}
}

// Explicit open-only request for the user's installed Chrome. No profile attach,
// URL supplied by a model, shell, cookie access, or claim of visible-window proof.
export async function openNormalChromeHome(signal:AbortSignal,spawner:typeof spawn=spawn,exists:()=>Promise<void>=()=>access(NORMAL_CHROME_PATH,constants.F_OK)):Promise<ChromeLaunchReceipt>{
 signal.throwIfAborted();await exists();signal.throwIfAborted()
 const child:ChildProcess=spawner(NORMAL_CHROME_PATH,['--new-window'],{shell:false,detached:true,stdio:'ignore',windowsHide:false})
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>finish(new CoreError('chrome-launch-unverified')),5000);timer.unref();const finish=(error?:Error)=>{clearTimeout(timer);child.off('spawn',launched);child.off('error',failed);if(error)reject(error);else resolve()},launched=()=>finish(),failed=()=>finish(new CoreError('chrome-launch-failed'));child.once('spawn',launched);child.once('error',failed)})
 child.unref();return{accepted:true,source:'installed-chrome-launcher',windowVerified:false}
}

// Fixed YouTube home only, using the user's normal installed browser.
export async function openNormalYouTubeHome(signal:AbortSignal,spawner:typeof spawn=spawn,exists:()=>Promise<void>=()=>access(NORMAL_CHROME_PATH,constants.F_OK)):Promise<ChromeLaunchReceipt>{
 signal.throwIfAborted();await exists();signal.throwIfAborted()
 const child=spawner(NORMAL_CHROME_PATH,['--new-window','https://www.youtube.com/'],{shell:false,detached:true,stdio:'ignore',windowsHide:false})
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>finish(new CoreError('chrome-launch-unverified')),5000);timer.unref();const finish=(error?:Error)=>{clearTimeout(timer);child.off('spawn',launched);child.off('error',failed);if(error)reject(error);else resolve()},launched=()=>finish(),failed=()=>finish(new CoreError('chrome-launch-failed'));child.once('spawn',launched);child.once('error',failed)})
 child.unref();return{accepted:true,source:'installed-chrome-launcher',windowVerified:false}
}
