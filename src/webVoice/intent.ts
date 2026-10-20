import {calculate} from '../../shared/calculate'
import {spokenArithmetic} from '../../shared/spokenArithmetic'
export type WebReply={kind:'answer'|'calculation'|'youtube'|'stop'|'clarify';text:string;expression?:string;result?:string;url?:'https://www.youtube.com/'}
export function webReply(raw:string,now=new Date()):WebReply{
 const original=raw.normalize('NFC').trim()
 if(!original||original.length>200)return{kind:'clarify',text:'บอกคำสั่งสั้น ๆ หนึ่งอย่างได้เลยครับ'}
 if(/^(?:หยุด|พอแล้ว|หยุดก่อน|stop)(?:ครับ|ค่ะ)?[.!?]?$/iu.test(original))return{kind:'stop',text:'หยุดฟังและหยุดเสียงตอบแล้วครับ'}
 if(/^(?:สวัสดี|หวัดดี|hello|hi)(?:ครับ|ค่ะ|ซีไอซี| CiC)?[.!?]?$/iu.test(original))return{kind:'answer',text:'สวัสดีครับ ลองบอกให้ฉันคิดเลข เช่น สิบสองบวกแปด ได้เลย'}
 if(/^(?:ตอนนี้)?กี่โมง(?:แล้ว)?[?]?$/u.test(original)||/^what time is it[?]?$/iu.test(original))return{kind:'answer',text:'ตอนนี้เวลา '+new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false}).format(now)+' นาฬิกา ตามเวลาอุปกรณ์ของคุณ'}
 if(/^(?:(?:ช่วย|please)\s*)?(?:เปิด\s*(?:ยูทูป|ยูทูบ|youtube)|open\s+youtube)(?:\s*(?:ให้หน่อย|หน่อย|ครับ|ค่ะ|please))*[.!?]?$/iu.test(original))return{kind:'youtube',text:'เตรียมหน้า YouTube ให้แล้วครับ กดปุ่มเปิด YouTube ด้านล่างได้เลย',url:'https://www.youtube.com/'}
 if(/^(?:ช่วยอะไรได้บ้าง|ทำอะไรได้บ้าง|help)[?]?$/iu.test(original))return{kind:'answer',text:'ฉันช่วยคิดเลข บวก ลบ คูณ หาร บอกเวลา และเตรียมเปิด YouTube ได้ครับ'}
 const text=original.replace(/^(?:ช่วย|กรุณา)\s*/u,'').replace(/(?:ครับ|ค่ะ|please)[.!?]?$/iu,'').trim().replace(/(?:เท่ากับ|ได้)?\s*(?:เท่าไร|เท่าไหร่|กี่)\s*[?]?$/u,'').trim()
 const symbolic=text.replace(/^(?:คำนวณ|คิดเลข|calculate|compute|\/calc)\s*/iu,'').replace(/[๐-๙]/gu,c=>String(c.charCodeAt(0)-0x0e50)).replace(/×/gu,'*').replace(/÷/gu,'/')
 const spoken=spokenArithmetic(text)
 const expression=/^[\d\s.+*/()-]+$/u.test(symbolic)?symbolic:spoken?.kind==='complete'?spoken.expression:null
 if(expression){try{const result=calculate(expression);return{kind:'calculation',expression,result,text:'ผลลัพธ์คือ '+(result.includes('/')?result.replace('/',' ส่วน '):result)}}catch(e){return{kind:'clarify',text:'คำนวณไม่ได้: '+(e instanceof Error?e.message:'ตรวจสมการอีกครั้ง')}}}
 if(spoken?.kind==='missing')return{kind:'clarify',text:spoken.question}
 return{kind:'clarify',text:'ยังเข้าใจคำสั่งนี้ไม่ครบครับ ลองบอกสมการ เช่น สิบสองบวกแปด หรือพิมพ์แก้คำที่ได้ยินได้เลย'}
}
