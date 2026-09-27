# CIC Bot

หน้าโปรโมตคอนเซปต์ CIC Bot ภาษาไทย ใช้ React, TypeScript, Vite และ Three.js ผ่าน React Three Fiber เว็บไซต์นี้ **ไม่ใช่แอป AI ที่พร้อมใช้งาน** ไม่มีระบบบัญชี หลังบ้าน หรือการแชร์/ควบคุมหน้าจอจริง

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
- `src/styles.css` — สี ฟอนต์ ระยะห่าง และ responsive; สีหลักอยู่ใน `:root`
- `src/Scene.tsx` — โมเดลจอคอมพิวเตอร์และผู้ช่วย สร้าง geometry ในโค้ด
- `src/SceneView.tsx` — lazy load, หยุด animation เมื่อนอกจอ/แท็บไม่ทำงาน และ reduced motion
- `src/SceneFallback.tsx` — ฉาก CSS สำรอง
- `src/config.ts` — URL แอป ดาวน์โหลด และ repository
- `index.html`, `public/favicon.svg`, `public/social-preview.png` — SEO และภาพแชร์

สร้างภาพแชร์ใหม่จากหน้าเว็บ: รัน `npm run build` แล้ว `npm run social` (ต้องติดตั้ง Chromium สำหรับ Playwright) จากนั้น build อีกครั้งเพื่อรวมภาพใหม่

`appUrl` และ `downloadUrl` เริ่มต้นเป็นสตริงว่าง ทุกปุ่มจึงเปิด dialog แจ้งว่ากำลังพัฒนา เมื่อมีผลิตภัณฑ์จริงจึงใส่ URL และปรับข้อความสถานะ ไม่มีไฟล์ดาวน์โหลดปลอมหรือแบบฟอร์มเก็บข้อมูล

ฟอนต์ Noto Sans Thai และ Inter รวมใน build ไม่เรียก Google Fonts ขณะใช้งาน ฉากไม่ใช้โมเดล/texture ภายนอก จำกัด DPR ที่ 1.5 และแสดงภาพนิ่งเมื่อเลือก reduced motion

## GitHub Pages

Repository: https://github.com/tanapat1604-cmd/CIC-bot

1. **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. Push เข้า `main` หรือ **Actions → Build and deploy CIC Bot → Run workflow**
3. Workflow ติดตั้ง dependency, lint, build, ทดสอบ Chromium และเผยแพร่ `dist/` เมื่อทุกขั้นตอนผ่าน
4. ตรวจ job `deploy` และเปิด https://tanapat1604-cmd.github.io/CIC-bot/ เพื่อยืนยันเว็บจริง

Workflow อยู่ใน `.github/workflows/deploy.yml` ใช้ `contents: read` สำหรับ build และเพิ่มเฉพาะ `pages: write` / `id-token: write` สำหรับ deploy; PR ทดสอบอย่างเดียว ไม่เผยแพร่ หากยังไม่ได้เปิด Pages ต้องเลือก Source เป็น GitHub Actions ก่อน ไม่ต้องเพิ่ม token หรือ API key ลง repository

## ขอบเขตคอนเซปต์

บทสนทนาเป็นข้อความตัวอย่าง ไม่ส่งข้อมูลไปหา AI ไม่เริ่มแชร์หน้าจอ และไม่ติดตามพฤติกรรมผู้ใช้ ไม่มีการยืนยันวันเปิดตัว ราคา ระบบปฏิบัติการ หรือความสามารถที่ยังไม่พร้อม คุณเป็นผู้เลือกสิ่งที่แชร์และอนุญาตการลงมือทำตามแนวทางผลิตภัณฑ์ที่วางแผนไว้
