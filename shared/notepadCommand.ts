import {validNotepadText} from './notepad.js'
export function notepadInstruction(raw:string):string|null{
 const text=raw.normalize('NFC').trim();if(missingNotepadText(text))return null
 const match=/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:พิมพ์(?:ข้อความ)?(?:ใน|ลง)\s*(?:notepad|โน้ตแพด|สมุดบันทึก)(?:\s+ว่า\s*|ว่า\s*|\s+)|type in notepad\s+)(.+)$/iu.exec(text)
 return match&&validNotepadText(match[1])?'พิมพ์ '+match[1]:null
}
export function missingNotepadText(raw:string){return /^(?:(?:ช่วย|กรุณา|please)\s*)?(?:พิมพ์(?:ข้อความ)?(?:ใน|ลง)\s*(?:notepad|โน้ตแพด|สมุดบันทึก)|type in notepad)(?:\s*(?:ว่า|ให้หน่อย|ครับ|ค่ะ))*$/iu.test(raw.trim())}
