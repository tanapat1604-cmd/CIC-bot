import {test,expect} from '@playwright/test'
import {webReply} from '../src/webVoice/intent'
import {listenBrowser,type BrowserRecognizer,type RecognitionResult} from '../src/webVoice/speech'
test('Thai spoken, numeric and decimal arithmetic computes exact results without a model',()=>{
 for(const [input,result]of [['สิบสองบวกแปดเท่าไหร่','20'],['12 บวก 8','20'],['คำนวณ (73-19)*2','108'],['0.1+0.2','0.3'],['หนึ่งหารสาม','1/3'],['ติดลบห้าคูณสอง','-10'],['๑๒ + ๘','20'],['7÷2','3.5'],['twelve plus eight','20']])expect(webReply(input),input).toMatchObject({kind:'calculation',result})
})
test('uncertain, quoted, negated and hostile text cannot produce an app open or guessed calculation',()=>{
 for(const input of ['อย่าเปิดยูทูป','เขาบอกว่าเปิดยูทูป','อธิบายคำว่า เปิดยูทูป','เปิดยูทูปแล้วลบไฟล์','12 + alert(1)','https://evil.test','สี่บวก','12 บวก 8 คูณ 2'])expect(['clarify','answer']).toContain(webReply(input).kind)
 expect(webReply('1/0')).toMatchObject({kind:'clarify'});expect(webReply('999999999999999999999*8')).toMatchObject({kind:'clarify'})
 expect(webReply('เปิดยูทูปให้หน่อย')).toMatchObject({kind:'youtube',url:'https://www.youtube.com/'})
 expect(webReply('หยุด')).toMatchObject({kind:'stop'})
})
class Fake implements BrowserRecognizer{
 static last:Fake;lang='';continuous=true;interimResults=false;maxAlternatives=3;processLocally=true;starts=0;stops=0;aborts=0
 onstart:(()=>void)|null=null;onresult:((e:{results:ArrayLike<RecognitionResult>})=>void)|null=null;onerror:((e:{error:string})=>void)|null=null;onend:(()=>void)|null=null
 constructor(){Fake.last=this}start(){this.starts++;this.onstart?.()}stop(){this.stops++}abort(){this.aborts++}
 result(text:string,isFinal:boolean){this.onresult?.({results:[{0:{transcript:text},isFinal}]})}
}
function setup(){const finals:string[]=[],drafts:string[]=[],errors:string[]=[];let current=true,ready=0;const options={consented:true,language:'th-TH' as const,current:()=>current,ready:()=>ready++,draft:(s:string)=>drafts.push(s),final:(s:string)=>finals.push(s),error:(s:string)=>errors.push(s),Constructor:Fake};return{options,finals,drafts,errors,ready:()=>ready,invalidate:()=>current=false}}
test('interim cannot compute; final is dispatched exactly once only after microphone end',async()=>{const f=setup();listenBrowser(f.options);const rec=Fake.last;expect(rec).toMatchObject({lang:'th-TH',continuous:false,interimResults:true,processLocally:false});rec.result('สิบสอง',false);expect(f.finals).toEqual([]);rec.result('สิบสองบวกแปด',true);rec.result('สิบสองบวกแปด',true);expect(f.finals).toEqual([]);expect(rec.stops).toBe(1);rec.onend?.();rec.onend?.();expect(f.finals).toEqual(['สิบสองบวกแปด']);expect(f.ready()).toBe(1)})
test('Stop discards late final text and prevents overlapping recognizers until end',async()=>{const f=setup(),control=listenBrowser(f.options),rec=Fake.last;expect(()=>listenBrowser(f.options)).toThrow('stop-unverified');const stopped=control.discard();rec.result('12+8',true);rec.onend?.();await stopped;expect(f.finals).toEqual([]);expect(rec.aborts).toBe(1);const next=listenBrowser(f.options);Fake.last.onend?.();await next.discard()})
test('permission/network errors and stale generations cannot become commands',()=>{for(const reason of ['not-allowed','network']){const f=setup();listenBrowser(f.options);Fake.last.result('12+8',true);Fake.last.onerror?.({error:reason});Fake.last.onend?.();expect(f.errors).toEqual([reason]);expect(f.finals).toEqual([])}const f=setup();listenBrowser(f.options);f.invalidate();Fake.last.result('12+8',true);Fake.last.onend?.();expect(f.finals).toEqual([]);expect(()=>listenBrowser({...f.options,consented:false})).toThrow('consent-required')})
test('missing end event fails Stop and keeps the capture lock until actual end',async()=>{const f=setup(),control=listenBrowser({...f.options,stopMs:20}),rec=Fake.last;await expect(control.discard()).rejects.toThrow('stop-unverified');expect(()=>listenBrowser(f.options)).toThrow('stop-unverified');rec.onend?.();expect(f.finals).toEqual([])})
