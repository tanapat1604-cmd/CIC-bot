# CIC app foundation

CIC เป็นผู้ช่วยที่ใช้บริบทจากหน้าจอที่ผู้ใช้เลือก รอบนี้เป็น **ตัวอย่างแอป** เท่านั้น ไม่มี AI, backend, login, screen capture, desktop control หรือไฟล์ติดตั้ง

## เส้นทางและโครงหน้า

- Landing `/CIC-bot/` และ anchors เดิม เช่น `#about`, `#capabilities`
- Workspace `/CIC-bot/#/app` เข้าโดยตรง รีเฟรช และ Back/Forward ได้บน GitHub Pages
- `Router.tsx` lazy-load แต่ละหน้า; เข้าแอปโดยตรงไม่โหลด Landing หรือ Three.js
- Landing selectors ถูกจำกัดใน `.landing`; Workspace ใช้ CSS Modules; `base.css` และ `Brand.tsx` ใช้ร่วมกัน
- Expanded: sidebar 240px (ยุบเป็น 76px), แชตกลาง, บริบท 320px เมื่อจอกว้างตั้งแต่ 1320px; จอเล็กใช้ modal drawer เพื่อไม่บีบแชต
- Compact: พื้นที่เว็บกว้างสูงสุด 440px ใช้ Chat และ SessionStore เดิม ไม่มีหน้าต่าง always-on-top
- บนจอกว้างการซ่อนบริทบรักษาความกว้างคอลัมน์เพื่อไม่ย้ายข้อความ/ช่องพิมพ์ ข้อมูลบริบทที่ซ่อนถูก inert

## สีและการเคลื่อนไหว

| Token | สี |
| --- | --- |
| Background / Surface | `#F4F7FB` / `#FFFFFF` |
| Ink / Navy | `#14233D` / `#111E36` |
| Primary / Accent | `#2459F5` / `#71E1ED` |
| Muted / Border | `#667189` / `#DCE4EF` |
| Success / Warning / Error | `#176744` / `#805600` / `#AD2538` |

ใช้ฟอนต์ Inter/Noto Sans Thai เดิม ระยะ 4/8px, radius 8–14px, ข้อความแชต 15px/1.85; cyan เป็นจุดเน้นบน navy เท่านั้น
คำนวณ contrast ด้วย relative luminance: success บน `#E9F5EE` 6.13:1, warning บน `#FFF5DA` 5.95:1, error บนขาว 6.78:1, muted บนพื้นแอป 4.56:1, ขาวบน primary 5.49:1
Controls 180ms, ข้อความ 220ms, modal/drawer 260ms; ลดการเคลื่อนไหวตามระบบ และใช้ native dialog สำหรับ focus trap/Escape/คืน focus

## State และการยกเลิกงาน

`types.ts` แยก `mode`, `screen`, `agent`, `layout` ออกจากกัน ไม่ผูกสถานะบริบทเข้ากับสถานะแชต

- Mode: chat / observe / assist
- Screen: disconnected / selecting / connected / error
- Agent: idle / responding / awaiting-approval / executing / paused / error
- Layout: expanded / compact
- แต่ละ session เก็บ mode, source, messages, draft, attachments และ operationId ของตนเอง
- `createSessionStore()` เป็น external store ที่ส่ง immutable snapshots ให้ `useSyncExternalStore`; ทุกมุมมองอ่าน instance เดียวกัน สลับ route กลับมาแชตยังอยู่ แต่การออกจากแอปยกเลิกงานค้าง
- ส่งข้อความ: responding → idle หรือ awaiting-approval; อนุญาต: executing → done/idle; ปฏิเสธ: rejected/idle; หยุด: cancelled/paused
- `AbortController` ยกเลิก timers; ตรวจ sessionId + operationId ซ้ำก่อนรับผล แม้ adapter ไม่เคารพ AbortSignal ก็ใส่ผลเก่าไม่ได้
- เปลี่ยนโหมด/เลือกหรือหยุดบริบท/สลับแชต/แชตใหม่/ออกจากแอป ยกเลิกคำขอ pending/executing
- Approval ผูก sessionId, operationId และ sourceId; กดซ้ำหรืออนุมัติหลังเปลี่ยนเป้าหมายไม่ได้ การลองทำงานใหม่ต้องมีการ์ดและคำอนุญาตใหม่
- โหมดคุยส่ง source=null ให้ AgentAdapter แม้มีแหล่งเดิมอยู่; การวิเคราะห์ไม่สร้าง approval การร้องขอให้ลงมือในโหมด assist เท่านั้นที่สร้าง
- Reply errors ใช้ retry โดยไม่เพิ่มข้อความผู้ใช้ซ้ำ; execution errors ต้องส่งคำขอและอนุญาตใหม่

## UI จริงและบริการจำลอง

UI ที่ทำงานจริง: สร้าง/สลับแชต, เก็บ draft, ส่งข้อความ, ย่อ/ขยายมุมมอง, เลือกบริบท, อนุญาต/ปฏิเสธ/หยุด, ลิงก์ตรวจ http/https, ภาพ preview, keyboard/IME, เลื่อนตามเมื่ออยู่ท้ายแชต และปุ่มข้อความใหม่เมื่ออ่านย้อนหลัง

`adapters.ts` แยก mock implementations ของ `ScreenSourceAdapter`, `AgentAdapter`, `ControlAdapter` ออกจาก interfaces และ SessionStore เลือกแหล่ง/ตอบ/ทำงานใช้ AbortSignal ทุกครั้ง คำตอบกำหนดแน่นอนตามประเภทคำขอและติดป้าย ไม่วิเคราะห์ภาพหรือลิงก์ ไม่เรียกเครือข่ายภายนอก

ไฟล์ภาพ PNG/JPEG/WebP/GIF ไม่เกิน 5 MB และ 24 ล้านพิกเซล ตรวจ decode ก่อนแนบ; สูงสุด 6 attachments ต่อข้อความ ใช้ object URLs และคืนเมื่อเอาออกหรือ dispose ภาพที่ส่งแล้วยังใช้ในประวัติจนจบ session ไม่มีการบันทึกข้อความหรือภาพลง localStorage/sessionStorage
ภาพบริบทเป็น HTML/CSS ที่สร้างเอง ไม่มี `getDisplayMedia` และตัวเลือกพื้นที่เฉพาะถูกปิดพร้อมระบุว่ายังไม่รองรับ

## จุดต่อรอบถัดไป

1. เริ่มที่ AgentAdapter: ออกแบบ server API, authentication, streaming, error/cancellation และจัดการ secret ที่ server ก่อนเปลี่ยน mock
2. ScreenSourceAdapter: ตรวจความสามารถและสิทธิ์จริงตาม browser/OS, handle user cancel/track ended, บอกแหล่งและขอบเขตที่ใช้จริง, ไม่สมมติว่าเลือกพื้นที่ได้ทุกแพลตฟอร์ม
3. ControlAdapter: ต่อ desktop bridge แยกจากหน้าเว็บ ผูก authorization กับ action/target จริง ตรวจซ้ำตอน execute และหยุดได้ ไม่ใช้คำอนุญาตจาก UI อย่างเดียวเป็นขอบเขตความปลอดภัย
4. Desktop integration: native window/side panel/always-on-top, OS permissions, source capture และ computer control ยังต้องออกแบบและทดสอบแยกทั้งหมด
5. SessionStore: ค่อยเพิ่ม persistence แบบ opt-in หลังออกแบบสิทธิ์เข้าถึง อายุข้อมูล และการลบข้อมูล; รอบนี้รีเฟรชแล้วเริ่มใหม่

## การตรวจสอบ

`npm run build`, `npm run lint`, `npm test`
`tests/store.spec.ts` ฉีด adapter ขัดข้อง/ผลมาช้าเพื่อทดสอบ cancellation, stale approvals, retry และบริบทโหมดคุย โดยไม่มี debug controls ในหน้าใช้งานจริง
`tests/workspace.spec.ts` ตรวจ routing, history, context, attachments, keyboard/IME, dialog focus, reduced motion, scroll following, modal motion และภาพที่ 1440×900, 1280×720, 390×844, 360×480
เก็บ screenshots ใน `test-results/` (gitignored) ชุด landing/motion เดิมยังตรวจฉาก WebGL และ fallback
ข้อจำกัด: Chromium บน Windows และ viewport จำลอง ไม่ใช่การตรวจบนโทรศัพท์จริง, Safari/Firefox, screen reader หรือ native IME ทุกระบบ
