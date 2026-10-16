import {test,expect} from '@playwright/test'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import type {ChildProcessWithoutNullStreams} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {collectPersonalChrome} from '../backend/chrome/personalChromeCollector'
function child(){const c=Object.assign(new EventEmitter(),{pid:123,stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>{queueMicrotask(()=>c.emit('exit',null));return true}});return c as unknown as ChildProcessWithoutNullStreams}
const response=(operationId:string,nonce:string)=>JSON.stringify({version:1,ok:true,operationId,nonce,windowId:'789',pid:456,startTicks:'12345',windowVerified:true,reused:true,foregroundVerified:true,profileRead:false})+'\n'
test('process exit settles verified focus even when inherited stdout never emits close',async()=>{const c=child(),op=randomUUID(),nonce=randomUUID();let settled=false;const p=collectPersonalChrome(c,new AbortController().signal,op,nonce).then(r=>{settled=true;return r});c.emit('spawn');c.stdout.emit('data',Buffer.from(response(op,nonce)));await new Promise(r=>setTimeout(r,10));expect(settled).toBe(false);c.emit('exit',0);await expect(p).resolves.toMatchObject({source:'personal-chrome-window',windowId:'789',pid:456,reused:true,foregroundVerified:true});expect(c.stdout.destroyed).toBe(true)})
test('Stop requires helper exit and only destroys its pipes, not personal Chrome',async()=>{const c=child(),controller=new AbortController(),p=collectPersonalChrome(c,controller.signal,randomUUID(),randomUUID());c.emit('spawn');controller.abort();await expect(p).rejects.toThrow('cancelled');expect(c.stdout.destroyed).toBe(true);expect(c.stderr.destroyed).toBe(true)})
test('mismatched nonce or missing complete receipt remains protocol failure after exit',async()=>{const c=child(),op=randomUUID(),nonce=randomUUID(),p=collectPersonalChrome(c,new AbortController().signal,op,nonce);c.emit('spawn');c.stdout.emit('data',Buffer.from(response(op,randomUUID())));c.emit('exit',0);await expect(p).rejects.toThrow('protocol');const d=child(),q=collectPersonalChrome(d,new AbortController().signal,op,nonce);d.emit('spawn');d.emit('exit',0);await expect(q).rejects.toThrow('protocol')})

test('explicit Chrome selection is transmitted as exact HWND PID birth and a crossed receipt is rejected after exit',async()=>{
 const c=child(),op=randomUUID(),nonce=randomUUID(),target={windowId:'789',pid:456,startTicks:'12345'};let sent='';c.stdin.on('data',b=>sent+=b);const p=collectPersonalChrome(c,new AbortController().signal,op,nonce,target);c.emit('spawn');expect(JSON.parse(sent).target).toEqual(target);c.stdout.emit('data',Buffer.from(response(op,nonce)));c.emit('exit',0);await expect(p).resolves.toMatchObject(target);
 const d=child(),q=collectPersonalChrome(d,new AbortController().signal,op,nonce,{...target,startTicks:'99999'});d.emit('spawn');d.stdout.emit('data',Buffer.from(response(op,nonce)));d.emit('exit',0);await expect(q).rejects.toThrow('personal-chrome-target-changed');expect(d.stdout.destroyed).toBe(true)
})
