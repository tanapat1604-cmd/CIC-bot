export function explicitChromeQuery(raw:string):string|null{
 const text=raw.normalize('NFC').trim();if(text.length>200||[...text].some(c=>c.charCodeAt(0)<32)||/[;&|`<>]|https?:|www\.|[\\/]/iu.test(text))return null
 if(missingChromeQuery(text))return null
 const match=/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:ค้นหา|ค้นเว็บ|ค้น|search instead(?: for)?|search(?: for)?|หา(?:ข้อมูล|ข่าว|เรื่อง)|เปลี่ยนคำค้น(?:ให้)?(?:เป็น)?|ค้น(?:ใหม่|ต่อ)(?:เรื่อง|ว่า)?|change(?: the)? search(?: to)?)\s+(.+)$/iu.exec(text)??/^(?:(?:ช่วย|กรุณา)\s*)?(?:ค้นหา|ค้นเว็บ|เปลี่ยนคำค้น(?:ให้)?(?:เป็น)?|ค้น(?:ใหม่|ต่อ)(?:เรื่อง|ว่า)?)\s*(.+)$/u.exec(text)
 return match?.[1]?.trim()||null
}
export const missingChromeQuery=(text:string)=>/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:เปลี่ยนคำค้น(?:ให้)?(?:เป็น)?|ค้น(?:ใหม่|ต่อ)(?:เรื่อง|ว่า)?|change(?: the)? search(?: to)?)(?:\s*(?:ให้หน่อย|หน่อย|ครับ|ค่ะ))*$/iu.test(text)
