# CIC Bot

รอบหมากรุก 2026-10-07: เพิ่มหน้าเล่นและวิเคราะห์ด้วย Stockfish 19 ในเครื่อง เลือกฝ่าย/ระดับ หยุดคิด และนำเข้า/ส่งออก FEN/PGN ได้ ดู [วิธีใช้หมากรุก](CHESS.md) และ [ผลตรวจจริง](validation/2026-10-07-chess/RESULTS.md) เว็บสาธารณะยังเป็น demo ไม่ติดต่อ backend ในเครื่อง สไลด์จากโครงเรื่องที่ผู้ใช้ตรวจรองรับแล้ว ดู SLIDES.md ส่วนวิดีโอยังไม่รองรับ

หน้าโปรโมต CIC Bot และ Workspace ภาษาไทย ใช้ React, TypeScript, Vite และ Three.js ผ่าน React Three Fiber (เฉพาะหน้าโปรโมต) เว็บไซต์สาธารณะยังเป็น **ตัวอย่างแอป** ส่วน backend ในเครื่องเชื่อมแชตข้อความกับ Ollama ได้แล้ว ไม่มีระบบบัญชีหรือการแชร์/ควบคุมหน้าจอจริง คุณภาพภาษาไทยของ qwen3:0.6b ยังมีข้อจำกัด ดู [ผลทดสอบจริง](OLLAMA-VALIDATION.md)

- [หน้าโปรโมต](https://tanapat1604-cmd.github.io/CIC-bot/)
- [ทดลองหน้าแอป](https://tanapat1604-cmd.github.io/CIC-bot/#/app)
- [โครงสร้างแอปและจุดต่อระบบจริง](APP-FOUNDATION.md)
- [สถานะการพัฒนาแต่ละขั้น](DEVELOPMENT-STATUS.md)

## รันและ build

ใช้ Node.js 22.12 ขึ้นไป (แนะนำ 22 LTS)

```sh
npm ci
npm run dev
```

เปิด URL ที่ Vite แสดง โดยใช้ path `/CIC-bot/`

```sh
npm run lint
npm run build
npm run preview
```

Build อยู่ใน `dist/` ตั้ง base เป็น `/CIC-bot/` ใน `vite.config.ts`

## Backend แชตข้อความในเครื่อง (ขั้น 3B)

ตั้ง `AI_PROVIDER=ollama` และ `AI_MODEL=qwen3:0.6b` ใน `backend/.env` สำหรับโมเดลที่ติดตั้งไว้แล้ว เปิดอีก terminal แล้วรัน `npm run backend:dev` จาก root จากนั้นเปิด frontend ที่ `http://127.0.0.1:5173/CIC-bot/#/app` เลือก **การเชื่อมต่อ → ตรวจการเชื่อมต่อ backend → เริ่มแชต AI ในเครื่อง** โดยต้องผ่าน health/session check ก่อน ปุ่มหยุดยกเลิกคำขอถึง Ollama และ retry ไม่เพิ่มข้อความผู้ใช้ซ้ำ ไม่ดาวน์โหลดโมเดลอัตโนมัติ หากต้องการตัวทดสอบที่ไม่เรียก AI ให้ใช้ `AI_PROVIDER=test`

ตั้งค่าได้จาก `backend/.env.example` → `backend/.env` (ไฟล์จริงถูก ignore); root `.env.example` มีเฉพาะ URL สาธารณะ ห้ามใส่ key ใน `VITE_*` ไม่ต้องมี key สำหรับ test provider ดู [วิธีรัน ขอบเขตสิทธิ์ และ protocol](backend/README.md) ใช้ `npm run backend:build` เพื่อตรวจ/คอมไพล์ backend และหยุด backend ที่เปิดเองก่อนรัน browser tests ซึ่งใช้ port 8787

ขั้น 3B เชื่อมและทดสอบ Ollama 0.34.4 และตรวจซ้ำบน 0.35.1 กับ qwen3:0.6b จริงแล้ว แต่ภาษาไทยทั่วไปยังไม่ผ่านการยอมรับ ตั้งต้น context 2048/output 192 tokens/3 threads/ปิด thinking/keep-alive 1 นาที ไม่รับประกัน RAM หรือความเร็ว เปลี่ยนโมเดลที่ติดตั้งผ่าน config ได้ ขั้น 3C/backend สาธารณะยังไม่ทำ เว็บ Pages เปิด demo ต่อได้ และไม่พยายามเชื่อม localhost หรือเปิด live ตาม config โดยอัตโนมัติ

## ทดสอบ

```sh
npx playwright install chromium
npm run build
npm test
```

ทดสอบ production preview: asset ภายใต้ `/CIC-bot/`, ฉาก 3 มิติ, scroll, แท็บทั้ง 5 และแป้นพิมพ์, ปุ่ม/dialog/focus/Escape, FAQ, เมนูมือถือ, ความกว้าง 320/390/768/1024 px, reduced motion และ fallback เมื่อ WebGL หรือโมดูล 3 มิติโหลดไม่ได้ ภาพหน้าจออยู่ใน `test-results/` (ไม่ commit)

## จุดแก้ไข

- `src/content.ts` — ตัวอย่างความสามารถ เรื่องเล่า และ FAQ
- `src/App.tsx` — Hero เมนู วิธีทำงาน ส่วนท้าย และ dialog
- `src/styles.css` — CSS หน้าโปรโมตที่จำกัด selector ใน `.landing`
- `src/base.css`, `src/Brand.tsx` — tokens/reset และ Brand ร่วมกัน
- `src/Router.tsx` — lazy hash route แยก Landing กับ Workspace
- `src/workspace/` — UI, CSS Modules, interfaces, in-memory store และ cancellable mock adapters
- `src/Scene.tsx` — โมเดลจอคอมพิวเตอร์และผู้ช่วย สร้าง geometry ในโค้ด
- `src/SceneView.tsx` — lazy load, หยุด animation เมื่อนอกจอ/แท็บไม่ทำงาน และ reduced motion
- `src/SceneFallback.tsx` — ฉาก CSS สำรอง
- `src/config.ts` — URL แอป ดาวน์โหลด และ repository
- `index.html`, `public/favicon.svg`, `public/social-preview.png` — SEO และภาพแชร์

สร้างภาพแชร์ใหม่จากหน้าเว็บ: รัน `npm run build` แล้ว `npm run social` (ต้องติดตั้ง Chromium สำหรับ Playwright) จากนั้น build อีกครั้งเพื่อรวมภาพใหม่

`appUrl` เป็น `#/app` เปิดหน้าแอปจำลอง ส่วน `downloadUrl` ยังว่างและเปิด dialog แจ้งว่ากำลังพัฒนา ไม่มีไฟล์ดาวน์โหลดปลอมหรือแบบฟอร์มเก็บข้อมูล

แอปมีแชตในหน่วยความจำ โหมดคุย/ให้ดู/ช่วยทำ บริบทตัวอย่าง การอนุญาตทีละรายการ และมุมมองเต็ม/กะทัดรัดที่ใช้ session เดียวกัน แนบลิงก์หรือภาพ preview ในเครื่องได้โดยไม่ fetch/อัปโหลด ข้อความและภาพหายเมื่อรีเฟรช ดูรายละเอียดและข้อจำกัดใน `APP-FOUNDATION.md`
`tests/workspace.spec.ts` ตรวจแอป/routing/attachments/accessibility/responsive และ `tests/store.spec.ts` ตรวจ cancellation, ผลตอบกลับเก่า, approval และ error/retry

ฐาน adapter รองรับ typed streaming events และคำตอบที่หยุดกลางทางแล้ว ตัวอย่างช่วยทำรองรับคลิกปุ่มบันทึก พิมพ์ข้อความในเครื่องหมายคำพูด และจัดรายการงาน โดยตรวจข้อมูลก่อนขออนุญาต ไม่แปลงข้อความตอบเป็นคำสั่งควบคุมเครื่อง `tests/streaming.spec.ts` และ `tests/readiness.spec.ts` ตรวจ contract, partial replies, การออกจากแอป และ flow ผ่าน UI

ฟอนต์ Noto Sans Thai และ Inter รวมใน build ไม่เรียก Google Fonts ขณะใช้งาน ฉากไม่ใช้โมเดล/texture ภายนอก จำกัด DPR ที่ 1.5 และแสดงภาพนิ่งเมื่อเลือก reduced motion

## การเคลื่อนไหว

- `src/sceneMotion.ts` กำหนดมุมกล้อง 3 ช่วงตาม scroll progress; `SceneView.tsx` วัดตำแหน่งผ่าน passive scroll listener และส่งค่าใน ref โดยไม่อัปเดต React ทุกเฟรม
- `Scene.tsx` ควบคุมตำแหน่งและมุมทั้งหมดของชิ้นส่วนที่ขยับจาก frame loop จุดเดียว แยกวงแหวนออกจากใบหน้า ใช้ delta time และหยุดนับเวลาระหว่างที่ฉากหรือแท็บไม่แสดง
- จอเอียงเห็นความหนา แผงงานลอยต่างจังหวะ มีแสงขอบและเงาแบบ shader ขนาดเล็ก ไม่ใช้ shadow map หรือ postprocessing
- บนมือถือ DPR สูงสุด 1 ลดจำนวน polygon และระยะเคลื่อนกล้อง พร้อมปิด parallax
- `data-renderer` ของ `.scene-view` แยก `loading`, `webgl` (มี frame ที่เรนเดอร์แล้ว), `fallback` เพื่อช่วยตรวจสอบ; ถ้าโหลดโมดูลไม่ได้หรือ context หายจะแสดงฉาก CSS ที่ลอยเบา ๆ พร้อมป้ายภาพสำรอง
- `src/useMotion.ts` จัดการสลับแท็บแบบ fade out 90 ms / fade in 220 ms และยกเลิก transition เก่าเมื่อเลือกใหม่ พื้นที่ทั้ง 5 หมวดใช้ grid ซ้อนกันเพื่อรักษาความสูง ส่วนที่ไม่แสดงเป็น `inert` และ `aria-hidden`
- Dialog ใช้ native `showModal()` / `close()` ร่วมกับ CSS `@starting-style` และ discrete transitions จึงคืน focus ทันทีขณะภาพค่อย ๆ ปิด เบราว์เซอร์ที่ไม่รองรับ transition ชนิดนี้ยังเปิด–ปิด dialog ได้
- FAQ และเมนูใช้ CSS transitions ที่ย้อนทิศได้ทันที; reduced motion ปิดการลอย หมุน parallax กล้อง และ transition พร้อมคงเนื้อหาครบ

`tests/motion.spec.ts` เพิ่มการตรวจแท็บรัว/ความสูง/ตัวบอกแท็บ, dialog เปิดซ้ำระหว่างปิด, FAQ กดซ้ำ, เมนูและ focus, fallback เคลื่อนไหว/หยุดนอกจอ, WebGL ตาม scroll ทั้งสองทิศ และ context loss ผลใน Chromium ทดสอบไม่ใช่การรับประกัน FPS หรือ GPU ทุกเครื่อง

## GitHub Pages

Repository: https://github.com/tanapat1604-cmd/CIC-bot

1. **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. Push เข้า `main` หรือ **Actions → Build and deploy CIC Bot → Run workflow**
3. Workflow ติดตั้ง dependency, lint, build, ทดสอบ Chromium และเผยแพร่ `dist/` เมื่อทุกขั้นตอนผ่าน
4. ตรวจ job `deploy` และเปิด https://tanapat1604-cmd.github.io/CIC-bot/ เพื่อยืนยันเว็บจริง

Workflow อยู่ใน `.github/workflows/deploy.yml` ใช้ `contents: read` สำหรับ build และเพิ่มเฉพาะ `pages: write` / `id-token: write` สำหรับ deploy; PR ทดสอบอย่างเดียว ไม่เผยแพร่ หากยังไม่ได้เปิด Pages ต้องเลือก Source เป็น GitHub Actions ก่อน ไม่ต้องเพิ่ม token หรือ API key ลง repository

## ขอบเขตคอนเซปต์

บทสนทนาบนเว็บสาธารณะเป็นข้อความตัวอย่าง ไม่ส่งข้อมูลไปหา AI ส่วนแชต Ollama ที่เปิดเองในเครื่องส่งเฉพาะข้อความผ่าน local backend ไม่มีการแชร์หน้าจอ ควบคุมเครื่อง หรือติดตามพฤติกรรมผู้ใช้ ไม่มีการยืนยันวันเปิดตัว ราคา ระบบปฏิบัติการ หรือความสามารถที่ยังไม่พร้อม

## สไลด์ในเครื่อง รุ่นแรก

เปิด `#/slides` จากแชต เมนูสไลด์ในเครื่อง สร้าง PPTX แก้ไขได้จากโครงเรื่องที่ผู้ใช้ตรวจ พร้อม PDF และ PNG จาก PowerPoint Windows สถานะทำงาน/ยกเลิก/ผิดพลาด ดาวน์โหลด และ revision โดยไม่ทับของเดิม ต้องตั้งค่า PptxGenJS ที่มีในเครื่อง ดู [SLIDES.md](SLIDES.md) ไม่มีวางเนื้อหาไทยอัตโนมัติหรือภาพ/ตาราง/คลังงานถาวร เว็บสาธารณะเป็นdemo ไม่มีbackend

[แผนเขียนโค้ด/แชร์และควบคุมจอพร้อมเกณฑ์](NEXT-CAPABILITIES.md) · [ผลตรวจและข้อจำกัด](validation/2026-10-07-slides/RESULTS.md)

สไลด์เลือกแบบ A มืออาชีพ หรือ B จาวิสได้ หน้าใหม่เริ่มที่ B และฉบับแก้ไขเก็บต้นฉบับไว้ ดู [ผลตรวจ A/B](validation/2026-10-07-jarvis/RESULTS.md)
