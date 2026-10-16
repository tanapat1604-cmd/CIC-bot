import {englishKnowledgeReply} from './englishKnowledge.js'
// Current product knowledge, shared by typed guidance and tool handoff pages.
// Descriptions do not grant tool permission or indicate that a tool has run.
export const ASSISTANT_GUIDES={
 ocr:'OCR คือการอ่านข้อความจากภาพ เลือกภาพในหน้าอ่านภาพ หรือส่งภาพจากหน้าต่างที่คุณแชร์ แล้วตรวจตัวอักษรที่อ่านได้ก่อนใช้ ภาพไม่ได้ส่งไป AI บนคลาวด์',
 screen:'เลือกหน้าต่างที่ต้องการแชร์ในหน้าอ่านหน้าจอก่อน ฉันยังไม่เห็นหน้าจอคุณจนกว่าคุณจะเลือกแชร์ ภาพที่เลือกส่งอ่านตัวอักษรในเครื่องได้',
 slides:'เตรียมหัวข้อและเนื้อหาในหน้าสไลด์ แล้วตรวจร่างก่อนสร้างไฟล์ PPTX/PDF ในเครื่อง ตอนนี้ยังไม่ได้สร้างไฟล์ให้คุณและยังไม่มีแอนิเมชัน',
 apps:'ฉันช่วยเปิด Notepad, Chrome และ YouTube ได้ บอกชื่อแอปที่ต้องการและอนุญาตขอบเขตครั้งเดียวระหว่างใช้แอป ส่วนการเล่นเพลงตามศิลปินยังต้องตรวจระบบเพิ่มเติม',
 memory:'กด ความจำของฉัน ในหน้าคุย แล้วกรอกและยืนยันข้อมูลที่ให้จำ คุณดู แก้ หรือลบได้ ข้อมูลอยู่ในเครื่องและไม่ให้สิทธิ์สั่งเครื่องมือ',
 voice:'กดเริ่มคุยเพื่อเปิดไมค์ด้วยตัวคุณเอง เสียงถอดในเครื่อง กดหยุดได้ทุกเวลา การฟังคำและความเร็ว 1–2 วินาทียังอยู่ระหว่างทดสอบ',
 calculator:'บอกสมการ เช่น คำนวณ (12-3)*4 หรือ /calc (12-3)*4 ฉันใช้เครื่องคำนวณหาคำตอบ ไม่ให้ AI เดาผลตัวเลข',
 research:'บอกว่าค้นหาเรื่องอะไร ฉันเตรียมค้นและอ่านข้อมูลสาธารณะใน Chrome ภายใต้ขอบเขตที่คุณอนุญาต',
} as const
export function assistantKnowledgeReply(raw:string):string|null{
 const text=raw.normalize('NFC').trim()
 if(!/[\u0e00-\u0e7f]/u.test(text)){const english=englishKnowledgeReply(text);if(english)return english}
 if(!/(?:อะไร|ยังไง|อย่างไร|ไหม|มั้ย|ได้หรือ|หรือยัง|ต้องเตรียม|ใช้งาน|อธิบาย|ไม่เข้าใจ|ไม่รู้)/u.test(text))return null
 const self=/(?:คุณ|cic|ซีไอซี|นาย|บอท|ฉัน|ผม)/iu.test(text)
 if(self&&/(?:ความจำ|ความชอบ|นิสัย|จำ.+(?:ข้ามวัน|ระยะยาว))/u.test(text))return ASSISTANT_GUIDES.memory
 if(/(?:ocr|อ่าน(?:ตัวอักษร|ข้อความ).+(?:รูป|ภาพ)|อ่านภาพ|อ่านรูป)/iu.test(text))return ASSISTANT_GUIDES.ocr
 if(/(?:หน้าจอ|แชร์จอ)/u.test(text)&&self)return ASSISTANT_GUIDES.screen
 if(/(?:สไลด์|slides|pptx)/iu.test(text)&&self)return ASSISTANT_GUIDES.slides
 if(/(?:เปิดโปรแกรม|เปิดแอป|notepad|chrome|youtube|โน้ตแพด|โครม|ยูทูบ)/iu.test(text)&&self)return ASSISTANT_GUIDES.apps
 if(/(?:ไมค์|เสียง|เริ่มคุย)/u.test(text)&&self)return ASSISTANT_GUIDES.voice
 if(/(?:เครื่องคิดเลข|เครื่องคำนวณ|\/calc)/iu.test(text)&&self)return ASSISTANT_GUIDES.calculator
 if(/(?:ค้นหา|ค้นเว็บ)/u.test(text)&&self)return ASSISTANT_GUIDES.research
 if(self&&/(?:ทำ|ช่วย).+อะไรได้บ้าง/u.test(text))return 'ฉันช่วยคุยและเลือกเครื่องมือในเครื่อง คำนวณ บอกเวลา เปิด Notepad/Chrome/YouTube ภายใต้สิทธิ์ที่คุณอนุญาต และพาไปอ่านภาพ แชร์หน้าจอ หรือทำสไลด์โดยให้คุณเลือกข้อมูลก่อน'
 return null
}
