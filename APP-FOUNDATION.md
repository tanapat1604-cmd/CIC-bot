# CIC app foundation

CIC เป็นผู้ช่วยที่วางแผนให้ใช้บริบทจากหน้าจอที่ผู้ใช้เลือก เว็บสาธารณะยังเป็น **ตัวอย่างแอป** มี backend แชตข้อความสำหรับทดสอบในเครื่องแล้ว แต่ยังไม่มี AI จริง, login, screen capture, desktop control หรือไฟล์ติดตั้ง

## เส้นทางและโครงหน้า

- Landing `/CIC-bot/` และ anchors เดิม เช่น `#about`, `#capabilities`
- Workspace `/CIC-bot/#/app` เข้าโดยตรง รีเฟรช และ Back/Forward ได้บน GitHub Pages
- `Router.tsx` lazy-load แต่ละหน้า; เข้าแอปโดยตรงไม่โหลด Landing หรือ Three.js
- Landing selectors ถูกจำกัดใน `.landing`; Workspace ใช้ CSS Modules; `base.css` และ `Brand.tsx` ใช้ร่วมกัน
- Expanded: sidebar 240px (ยุบเป็น 76px), แชตกลาง, บริบท 320px เมื่อจอกว้างตั้งแต่ 1320px; จอเล็กใช้ modal drawer เพื่อไม่บีบแชต
- Compact: พื้นที่เว็บกว้างสูงสุด 440px ชิดขวาบนจอกว้าง และเต็มความกว้างในหน้าต่างแคบ ใช้ Chat และ SessionStore เดิม ไม่มีหน้าต่าง always-on-top และไม่ลอยทับโปรแกรมอื่น
- บนจอกว้างการซ่อนบริบทรักษาความกว้างคอลัมน์เพื่อไม่ย้ายข้อความ/ช่องพิมพ์ ข้อมูลบริบทที่ซ่อนถูก inert

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
- ส่งข้อความ: responding → idle หรือ awaiting-approval; แต่ละคำตอบมี streaming / complete / stopped / error แยกต่างหาก เก็บข้อความที่หยุดหรือผิดพลาดกลางทางพร้อมป้ายว่ายังไม่ครบ; อนุญาต: executing → done/idle; ปฏิเสธ: rejected/idle; หยุด: cancelled/paused
- `AbortController` ยกเลิก timers; ตรวจ sessionId + operationId ซ้ำก่อนรับผล แม้ adapter ไม่เคารพ AbortSignal ก็ใส่ผลเก่าไม่ได้
- เปลี่ยนโหมด/เลือกหรือหยุดบริบท/สลับแชต/แชตใหม่/ออกจากแอป ยกเลิกคำขอ pending/executing
- Approval ผูก sessionId, operationId และ sourceId; การเลือกแหล่งใหม่แม้ชนิดเดิมได้ identity ใหม่ กดซ้ำหรืออนุมัติหลังเปลี่ยนเป้าหมายไม่ได้ การลองทำงานใหม่ต้องมีการ์ดและคำอนุญาตใหม่
- โหมดคุยส่ง source=null ให้ AgentAdapter แม้มีแหล่งเดิมอยู่; การวิเคราะห์ไม่สร้าง approval การร้องขอให้ลงมือในโหมด assist เท่านั้นที่สร้าง
- Reply errors ใช้ retry โดยไม่เพิ่มข้อความผู้ใช้ซ้ำ เก็บคำตอบเก่าที่ผิดพลาดพร้อมสถานะและสร้างคำตอบใหม่; execution errors ต้องส่งคำขอและอนุญาตใหม่

### AgentAdapter streaming contract

`respond(request, signal): AsyncIterable<AgentEvent>`

- Request: sessionId, operationId, mode, source ที่โหมดอนุญาต และ messages (role, text, responseStatus, typed attachments)
- Link attachment มี URL; image attachment มี File (ชื่อ/type/size/data) ไม่ส่ง object URL ของ UI เป็นตัวแทนภาพให้บริการ ใน mock ไม่มีการอ่านข้อมูลภาพหรือส่งเครือข่าย
- Event ทุกตัวมี sessionId/operationId: `delta` เพิ่มข้อความ, `action` เสนอ ActionProposal, `done` จบ, `cancelled` ยกเลิก, `error` แจ้งผิดพลาด; จบ iterator โดยไม่มี terminal event ถือว่าขาดช่วง
- Store ตรวจ identity ทุก event และ AbortSignal อีกชั้น แม้ adapter ไม่ยอมหยุดก็เพิ่มผลเก่าไม่ได้; หยุด/ออกจากแอปไม่เริ่มงานต่อเอง
- ActionProposal เป็น command union: `click-save` + ชื่อปุ่ม, `type-text` + ข้อความสูงสุด 500 ตัวอักษร, `task-list` สำหรับรายการตัวอย่าง
- `actions.ts` ตรวจโหมด identity แหล่งและ payload; สร้างหัวข้อ/รายละเอียด/ผลที่คาดจาก command ที่ตรวจแล้ว ข้อเสนอรออยู่ภายในจนได้ `done` จึงแสดงปุ่มอนุญาต ถ้า error/cancel ก่อนจบจะไม่มีการ์ดที่นำไปอนุมัติได้
- ไม่มีการแปลงข้อความ delta ให้เป็นคำสั่งควบคุมเครื่อง เมื่อเชื่อมจริงต้องมี runtime validation ที่ transport/backend และบริการลงมือเพิ่มเติม

## UI จริงและบริการจำลอง

UI ที่ทำงานจริง: สร้าง/สลับแชต, เก็บ draft, ส่งข้อความ, ย่อ/ขยายมุมมอง, เลือกบริบท, อนุญาต/ปฏิเสธ/หยุด, ลิงก์ตรวจ http/https, ภาพ preview, keyboard/IME, เลื่อนตามเมื่ออยู่ท้ายแชต และปุ่มข้อความใหม่เมื่ออ่านย้อนหลัง

`adapters.ts` แยก mock implementations ของ `ScreenSourceAdapter`, `AgentAdapter`, `ControlAdapter` ออกจาก interfaces และ SessionStore เลือกแหล่ง/ตอบ/ทำงานใช้ AbortSignal ทุกครั้ง คำตอบกำหนดแน่นอนตามประเภทคำขอและติดป้าย ไม่วิเคราะห์ภาพหรือลิงก์ ไม่เรียกเครือข่ายภายนอก

Mock ทยอยตอบ 4 ช่วงสั้น ๆ รวมประมาณ 320ms โดยค่าเริ่มต้น ใช้ทดสอบการหยุด ไม่ใช่การวัดเวลาตอบของ AI รองรับวิเคราะห์โค้ด วางแผนงาน คิดโปสเตอร์ และวิเคราะห์หน้าจอจำลอง
โหมดช่วยทำมีตัวอย่าง `ช่วยคลิกปุ่มบันทึกในหน้าต่างนี้`, `พิมพ์ข้อความ "สวัสดี"` (ต้องเลือกแหล่งจำลอง) และ `ช่วยทำรายการงาน` คำสั่งที่ไม่รู้จักจะบอกขอบเขต preview ไม่สร้างการกระทำที่ไม่เกี่ยวข้อง การจับวลีเหล่านี้อยู่เฉพาะ mock ไม่ใช่ parser สำหรับข้อความ AI

ไฟล์ภาพ PNG/JPEG/WebP/GIF ไม่เกิน 5 MB และ 24 ล้านพิกเซล ตรวจ decode ก่อนแนบ; สูงสุด 6 attachments ต่อข้อความ ใช้ object URLs และคืนเมื่อเอาออกหรือ dispose ภาพที่ส่งแล้วยังใช้ในประวัติจนจบ session ไม่มีการบันทึกข้อความหรือภาพลง localStorage/sessionStorage
ภาพบริบทเป็น HTML/CSS ที่สร้างเอง ไม่มี `getDisplayMedia` และตัวเลือกพื้นที่เฉพาะถูกปิดพร้อมระบุว่ายังไม่รองรับ

## จุดต่อรอบถัดไป

### ขั้น 3A: transport/backend ที่เพิ่มแล้ว

`Session.connection` แยก demo/test/live แบบคงที่ต่อแชต เปลี่ยนการเชื่อมต่อด้วยแชตใหม่และรักษาประวัติเดิมไว้แยกกัน `SessionStore` เลือก adapter ตามแชต ไม่กระจาย fetch ใน components; demo ยังใช้ adapters เดิมและมี 3 โหมด ส่วน backend เปิดแค่ข้อความ ไม่มี attachments/source/actions

`transport.ts` ใช้ POST fetch + NDJSON streaming และ AbortSignal ส่งเฉพาะประวัติข้อความของ session ปัจจุบัน ตัดเป็นข้อความเต็มช่วงล่าสุดไม่เกิน 24 ข้อความ/24,000 ตัวอักษร ข้อความละ 8,000 ละ assistant ที่ stopped/error/streaming ไม่ส่งเสมือนตอบครบ UI แจ้งเมื่อมีการละประวัติ ทุก event ตรวจ runtime schema/identity และ terminal; ขาดช่วงแสดง error ไม่ถือว่าเสร็จ ไม่มี auto retry และไม่ fallback เป็น mock

`shared/chatProtocol.ts` เป็น runtime schema/limits ร่วม frontend/backend; `backend/server.ts` ใช้ Node HTTP และ provider interface ใน `backend/provider.ts` มีเฉพาะ free test provider ที่ติดป้ายไม่ใช่ AI Server กำหนด system instruction เองและไม่รับ action จากข้อความ ใบอนุญาตจำลองเดิมไม่ใช้กับ endpoint นี้

หน้า Settings ตรวจ health และ local access session ก่อนให้เริ่มแชต backend; cookie HttpOnly อยู่ฝั่งเบราว์เซอร์ ไม่ฝัง shared secret UI/Public Pages ยังเปิด backend ไม่ได้โดยตั้ง VITE URL อย่างเดียว Readiness ของการเชื่อมต่อเป็นผลตรวจ ณ เวลานั้น หาก service หยุดภายหลังจะแสดง error จริง

รายละเอียดการรัน, protocol, loopback-only trust model, auth/rate/concurrency/body/time/output limits, logs และข้อกำหนดก่อนเปิดสาธารณะ: [backend/README.md](backend/README.md) ไม่มีการเชื่อม provider ที่เสียเงินในรอบ 3A และ test provider สำเร็จไม่เท่ากับ AI จริงสำเร็จ

1. ขั้น 3B: เลือก provider/model แล้วเพิ่ม provider adapter จริงหนึ่งราย ทดสอบตอบ/หยุดตามสิทธิ์ค่าใช้จ่ายที่ผู้ใช้อนุญาต ขั้น 3C: เลือก hosting และ public identity/quota/spend controls ก่อนเผยแพร่ backend; secret อยู่ server เท่านั้น ไม่มีช่องกรอก API key ในเว็บ GitHub Pages เสิร์ฟ frontend ส่วน backend ต้องมีที่รันแยก
2. ScreenSourceAdapter: ตรวจความสามารถและสิทธิ์จริงตาม browser/OS, handle user cancel/track ended, บอกแหล่งและขอบเขตที่ใช้จริง, ไม่สมมติว่าเลือกพื้นที่ได้ทุกแพลตฟอร์ม
3. ControlAdapter: ต่อ desktop bridge แยกจากหน้าเว็บ ผูก authorization กับ action/target จริง ตรวจซ้ำตอน execute และหยุดได้ ไม่ใช้คำอนุญาตจาก UI อย่างเดียวเป็นขอบเขตความปลอดภัย
4. Desktop integration: native window/side panel/always-on-top, OS permissions, source capture และ computer control ยังต้องออกแบบและทดสอบแยกทั้งหมด
5. SessionStore: ค่อยเพิ่ม persistence แบบ opt-in หลังออกแบบสิทธิ์เข้าถึง อายุข้อมูล และการลบข้อมูล; รอบนี้รีเฟรชแล้วเริ่มใหม่

## การตรวจสอบ

`npm run build`, `npm run lint`, `npm test`
`tests/store.spec.ts` ฉีด adapter ขัดข้อง/ผลมาช้าเพื่อทดสอบ cancellation, stale approvals, retry และบริบทโหมดคุย โดยไม่มี debug controls ในหน้าใช้งานจริง
`tests/workspace.spec.ts` ตรวจ routing, history, context, attachments, keyboard/IME, dialog focus, reduced motion, scroll following, modal motion และภาพที่ 1440×900, 1280×720, 390×844, 360×480
`tests/streaming.spec.ts` ตรวจคำสั่งตรงสถานการณ์, typed history, partial errors/retry, terminal events, malformed proposals และผลมาช้าหลังยกเลิก
`tests/readiness.spec.ts` ตรวจการคลิกบันทึกจริงใน flow จำลอง, draft/ภาพ/approval ข้ามมุมมอง, หยุด stream/ออกจาก route, ลบสิ่งแนบไม่ส่งฟอร์ม, ภาพเสีย/จำนวนเกิน และ header ชื่อยาวในหน้าต่างเตี้ย
เก็บ screenshots ใน `test-results/` (gitignored) ชุด landing/motion เดิมยังตรวจฉาก WebGL และ fallback
ข้อจำกัด: Chromium บน Windows และ viewport จำลอง ไม่ใช่การตรวจบนโทรศัพท์จริง, Safari/Firefox, screen reader หรือ native IME ทุกระบบ
