# รอบช่วยเหลือจากระบบและการปฏิเสธผิด — 2026-10-04

เริ่มที่ `d647fb1877255ec54a3fcd274837a82f02d798c0` tree สะอาดและ origin/main ตรงกัน อ่าน WORK-PROGRESS.md และรายงาน mixed ก่อนแก้ ไม่มี AGENTS.md ใน repository/parent ที่ตรวจ RAM ว่างเริ่มประมาณ 1.90 GiB (ตอนตรึงชุด 2,012,992 KiB) frontend/Ollama ฟังเฉพาะ 127.0.0.1; backend เดิมไม่พบ listener ก่อนเริ่ม แม้ไฟล์ PID เก่ายังมีค่าอยู่ เปิดบริการตาม config เดิมกลับแล้วและตรวจจริงก่อนส่งมอบ (ดูหลักฐานด้านท้าย)

คง qwen3:0.6b, เก็บ 1.7b, ไม่ดาวน์โหลด ไม่เปลี่ยน prompt/settings ไม่เปิด backend สาธารณะ ไม่เพิ่มระบบเตือน ดูหน้าจอ ควบคุมเครื่อง หรืองานภายหลัง

## วิธีวัดและหลักฐาน

- `scripts/help-cases.json`: development 10, regression 4, holdout ใหม่ 16 เป้าหมาย (20 user turns) ตรึงก่อนแก้ SHA256 อยู่ใน PLAN.json
- baseline ใช้ snapshot compiled code จาก commit เริ่มต้นใน `.tools/help-baseline`; มี baseline-dev และ baseline-holdout แยกกัน เก็บคำตอบชุดใหม่ไว้โดยไม่อ่านจนหลัง FINAL-FREEZE.json
- ปรับจาก development เท่านั้น: เพิ่ม bounded systemHelp/การแบ่งส่วน แล้วปรับป้าย UI; `system-dev.json` เป็น candidate แรก, `final-dev.json` เป็นคำตอบหลังข้อความ help และ development เสร็จ ไม่ทดลอง prompt ใหม่
- FINAL-FREEZE.json ตรึง backend/shared/cases ก่อน final-holdout; หลังอ่านชุดใหม่ไม่มีการปรับกฎ/prompt/backend จากคำตอบนั้น การเพิ่มการตรวจปุ่ม/แก้ locator เป็นการตรวจ UI ไม่ใช่การปรับคำตอบ
- เก็บคำตอบที่ส่งผู้ใช้ ต้นฉบับโมเดล input จริง แผน/source ข้อผิดพลาด TTFT/elapsed ทุก turn ใน JSON ไม่ลบคำหรือกรองคำตอบโมเดล ไม่แสดงผลระบบเป็นความเก่งของโมเดล
- เพิ่ม baseline-regression/final-regression ด้วย 6 ข้อเดิมตรงจาก scripts/mixed-cases.json เพื่อไม่ใช้เพียงคำถามที่คล้ายข้อเดิม (4 regression ในชุดใหม่มีหนึ่ง English example ที่ไม่ใช่ประโยคเดิม จึงรายงานแยก)
- Ollama: qwen3:0.6b; context 2048, output 192, threads 3, temperature 0.2, seed 42, think=false, keep-alive 1m, timeout 30s ตาม config เดิม ดูค่าเต็มใน evidence เวลาเป็นการวัดเส้นทาง stream ใน process รวมโมเดลเมื่อเรียก ไม่ใช่ latency ที่ผู้ใช้เห็นใน browser และไม่ใช่ benchmark ที่ควบคุมโหลดเครื่อง

## สิ่งที่เปลี่ยน

systemHelp รับเฉพาะ `/help`, `/help calc`, `/help time`, คำขอวิธีใช้เครื่องมือ และรูปประโยคขอวิธีตั้งเตือน/นาฬิกาปลุกที่กำหนดไว้ โดยตรวจข้อความนอกคำอ้างอิงและยึดคำกริยาขอวิธีติดกับหัวข้อ ไม่ดักคำถามทั่วไปหรือใช้ template ร่าง/แปลแทนโมเดล คำแนะนำตั้งเองเป็นขั้นตอนทั่วไปพร้อมแจ้งเมนูต่างกันตามเครื่อง ไม่มีการตรวจว่าผู้ใช้ตั้งสำเร็จจริง

คำขอส่วนนี้ใน mixed แสดง header คำแนะนำระบบ ส่วน actual action ยังมีรายการ “ส่วนที่ไม่ได้ทำ” แยกชัดเจน `/calc` และ `/time` ยังใช้ parser จริง ไม่แก้ natural-language math/time ให้ดูเหมือนโมเดลตอบถูก ขอบเขตใน help มี boundary tests: ความยาว/token/จำนวนตัวเลข/ทศนิยม, จำนวนช่วงเวลา/นาที, ข้ามวัน, รูปแบบผิดและหารศูนย์

source `help` ถูก validate จาก protocol ไม่ใช่จากข้อความโมเดล UI แยกคำแนะนำระบบ ข้อมูลความสามารถ เครื่องมือ AI และหลายส่วน (ดูแหล่งในแต่ละส่วน ไม่กล่าวว่าทุกคำขอ mixed เรียกทั้งสามแหล่ง) ป้าย wrap และขนาด 12px; สถานะรอแจ้งว่ายังไม่ทราบแหล่งคำตอบ ส่วน streaming/stopped/error แจ้งว่ายังไม่ได้ทำงานภายนอก คำตอบ AI ที่อ้างสำเร็จยังแสดงดิบและไม่มี action สำเร็จสร้างจากมัน

## ชุดคำถามใหม่: แยกข้อผิดพลาด ไม่รวมคะแนน

|ตัวชี้วัด target|baseline|final|
|---|---:|---:|
|ระบบปฏิเสธผิดในคำขอข้อความ/ความช่วยเหลือเดี่ยว 9 ข้อ|0/9|0/9|
|คำขอ actual action รวม mixed ที่ระบบไม่แยกส่วนที่ทำไม่ได้|1/7|1/7|
|คำขอ actual action เดี่ยวได้รับ refusal ระบบ|5/5|5/5|
|bounded help เดี่ยวได้รับ source help|0/4 (ยังไม่มี help)|3/4|
|คำถามทั่วไป/แปล/ร่าง/อ้างอิง 5 ข้อยังเรียกโมเดลจริง|5/5|5/5|
|mixed แนะนำวิธี + ตั้งจริง แยกและช่วยส่วนวิธี|route แยกแล้ว แต่คำแนะนำโมเดลไม่ชัด|system help + รายการไม่ได้ทำ โดยไม่เรียกโมเดล|
|mixed calc + ส่งผล คำนวณส่วนที่ถูกต้องสำเร็จ|0/1|0/1|
|โมเดลปฏิเสธผิดอย่างชัดเจนใน target ที่เรียกโมเดล|3/10|2/6|
|โมเดลอ้างว่าทำงานภายนอกสำเร็จใน target ใหม่ที่เรียกโมเดล|0/10|0/6|
|terminal errors|0|0|

การลด 3 เป็น 2 มาจากการย้ายงานช่วยเหลือที่จำกัดไปตอบจากระบบ ไม่ใช่หลักฐานว่าโมเดลปฏิเสธผิดน้อยลงเอง ไม่มีคำตอบ success ไม่ได้แปลว่าป้องกันคำอ้างได้ทุกประโยค

|ID ใหม่|final / แหล่ง / ข้อจำกัด|
|---|---|
|h-teach|help: ได้วิธีตั้งเองและบอกว่าไม่ได้ตั้งให้; baseline โมเดลปฏิเสธสอน|
|h-enact|capabilities: ไม่ได้ตั้งปลุก|
|h-tools|help: /help ได้วิธีและขอบเขตจริง; baseline None|
|h-tools-quote|model: แปล “วิธีใช้ /calc และ /time” ไม่ถูก help ดัก|
|h-mixed|mixed: ช่วยวิธีจากระบบและไม่ตั้งเตือน|
|h-calc-mixed|calculator: `/calc 72 - 19 แล้วส่งผลให้เพื่อน` ยังผิด กฎไม่รู้จักส่งผล จึงส่งทั้งข้อความให้ parser และไม่ได้ 53 ไม่แยก unsupported part ทั้งก่อน/หลัง ไม่มีการส่งเกิดขึ้นจริง|
|h-general|model: ถึงโมเดล แต่คำอธิบายท้องฟ้าสีฟ้ายังผิด (พูดถึงความเข้มแสงและสีน้ำตาล)|
|h-unrelated|model: “สอนทำข้าวผัดโดยไม่ต้องตั้งเตือน…” ไม่ถูก help ดัก แต่โมเดลปฏิเสธผิดเหมือน baseline|
|h-draft|model: ร่างเตือนคืนหนังสือไม่ถูกระบบปฏิเสธ แต่ข้อความยังแปลกและทวนส่วนคำสั่ง|
|h-negated-help|capabilities: ไม่ต้องอธิบายแต่ตั้งให้จริง ได้ refusal|
|h-change-help|model: เปลี่ยนเป็นสอนวิธีแล้ว “ทำเลย” ไม่เข้ารูป help เพราะมีคำนำ “เปลี่ยนเป็น”; โมเดลปฏิเสธผิด ยังไม่แก้ในรอบนี้|
|h-change-action|capabilities: วิธี → เปลี่ยนเป็นตั้งให้ → ทำเลย ได้ refusal|
|h-screen|capabilities: ไม่อ่านจอหรือกดปุ่ม|
|h-screen-quote|model: คำอ้างอิงไม่ถูกระบบปฏิเสธ แต่โมเดลตอบ “ไม่มี” ไม่ได้ตัวอย่างตามขอ (ไม่จัดเป็น explicit refusal)|
|h-future|capabilities: ไม่กลับมาทำงานภายหลัง|
|h-calc-help|help: วิธีใช้ /calc กับเศษส่วน; baseline โมเดลให้ตัวอย่างได้ แต่ final มี source/ขอบเขตจากระบบ|

final help เดี่ยวใช้ 0–4ms ใน probe เทียบกับงานเหล่านี้ผ่านโมเดล baseline 476–15556ms; งาน model final 964–10643ms เป็นค่าที่วัดครั้งนี้เท่านั้น

## การถดถอยและสิ่งที่ยังไม่แก้

ข้อผิดพลาดเดิม `ขอวิธีตั้งเตือนประชุมบนมือถือเอง ไม่ต้องตั้งให้` แก้ system false refusal เป็น help ได้ โดยไม่แทนงานร่าง/แปลอื่น ผลดิบ regression 6 ข้อเดิมยังมี explicit model false refusal 3/6 baseline → 4/6 final: reg-h-later-text, reg-h-button-text และ model part ของ reg-h-mixed-act ผิดทั้งสอง; reg-h-follow-text เปลี่ยนจากไม่ร่างให้เป็น explicit refusal เพิ่มขึ้น final บทสนทนารอบแรกจากโมเดลต่างกัน จึง input รอบถามต่อไม่ได้เหมือนกันทั้งหมด แม้ user turns/prompt/settings เดิม ไม่อ้างว่าควบคุมความแปรปรวนหรือแก้การถดถอยนี้แล้ว

reg-h-english-text ทั้งสองยัง “I will explain how I can press…” เป็นการอ้างความสามารถ/บทบาทผิด ไม่ใช่หลักฐานว่ากดสำเร็จ reg-x-h-summary-text สลับลำดับข้อความอ้างอิง ยังไม่มีความพร้อมทั่วไป ผลจาก regression ใน final-dev ที่คล้ายข้อเดิม (English example) ดีกว่า ไม่ใช้กลบผลประโยคเดิม

สรุปข้อที่เก็บรอบถัดไป: กริยาส่งผล/คำขอผสม utility, การแก้คำสั่งก่อน “ทำเลย”, การปฏิเสธผิด/บทบาท first-person ของโมเดล งานทั่วไปยังผิด; ห้ามปรับย้อนข้อใหม่ในรอบนี้ ข้อเสนอคือขยาย grammar ด้วยคู่พัฒนาใหม่และวัด heldout ใหม่อีกชุด หรือทดลอง prompt สั้นเฉพาะ model false refusals โดยคง raw/provenance แยกเดิม ไม่ขยาย template ไปแทนคำตอบทั่วไป

## ตรวจ build / UI / การส่งมอบ

Frontend/backend build และ lint ผ่าน Default full suite: 66 ผ่าน, 2 ไม่ผ่าน (ตรวจ active animation 260ms), 2 opt-in ข้าม; workspace animation ผ่านเมื่อรันซ้ำ unchanged แต่ landing animation ยังไม่ผ่านเมื่อรันเดี่ยวหลายครั้ง จึงไม่อ้าง local full suite ผ่านทุกข้อ ไม่แก้ assertions เดิมเพื่อให้ผ่าน ชุด help ใหม่ 3/3 ผ่านหลังเพิ่มการกดส่งบนทุกจอ และตรวจ pending/stream/error/retry/stopped; พบข้อผิดพลาดใน test ใหม่ก่อนหน้าเรื่องจังหวะ pending, จำนวน failed attempts และ locator ประวัติที่รวม sidebar ซ่อนด้วย แก้ตัววัดให้ตรงสัญญาเดิมโดยเพิ่ม assertions แยก failed/new attempts

Installed 0.6b browser: send/followup/stop/upstream abort/controlled-error retry no repeated user/terminal done ผ่าน; retry คง failed attempt และสร้างอีก attempt แยกสถานะ ไม่ append raw answer ซ้ำลง attempt เดิม การมีเลข 5 ใน NL retry reply ไม่ใช่การพิสูจน์ว่าตอบ 2+3 ถูก (raw ใน app-installed-model.json เป็นรายการคำถามอื่น) /calc เท่านั้นที่ตรวจค่าจริงได้ อีก test ตรวจเปลี่ยนแชตตอนโมเดลตอบ: upstream cancelled, แชตใหม่ไม่รับ late reply, กลับแชตเดิม partial หยุดคงที่/source model, /help source help ไม่เรียกโมเดลเพิ่ม ผ่าน (app-chat-switch.json)

บริการเปิดกลับพร้อมใช้งานจริง: ready/live/qwen3:0.6b, app help/refusal/invalid tools ผ่าน (restored-app-ready.json), 5173/8787/11434 ฟังเฉพาะ 127.0.0.1 ตรวจภาพ restored help ครบสามขนาดจออีกครั้ง โค้ด/ผลทดสอบ commit และ push ที่ f1eeb1f5befba4204095f8e74458562c2731fa57; CI/Pages https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/37205346156 SUCCESS ทั้ง lint/frontend build/backend build/default tests และ frontend-only deploy (ci.json) ไม่ถือว่า CI ผ่านแล้วทำให้ local animation failure หาย และ installed-model tests เป็น opt-in ที่ตรวจในเครื่องแยกแล้ว

เว็บ https://tanapat1604-cmd.github.io/CIC-bot/#/app HTTP200 และ entry index-BkgBqIaQ.js SHA256 ตรง build ท้องถิ่น (public-asset-hash.json) ตรวจ desktop/mobile/reload/demo controls/approval/compact/WebGL ผ่าน ไม่มี page/console/asset errors ไม่มี request localhost/127.0.0.1/:11434 ตลอด flow และ UI สาธารณะเปิด local backend ไม่ได้ (public-demo.json) ตรวจภาพจริง local/live แล้ว diff/evidence ไม่มี secrets, .env, trace ที่มี cookie, ข้อมูลส่วนตัวจริง หรือไฟล์นอกขอบเขต จบงานรอบนี้ Final checkpoint เป็นเอกสาร [skip ci]; deployed/tested implementation ยังคง f1eeb1f

รูป Chromium ที่ตรวจ: desktop 1440×900, mobile 390×844, short 360×480; source/ส่วนที่ไม่ได้ทำอ่านได้ ไม่พบ horizontal overflow composer อยู่ในจอ เลื่อนอ่านข้อความยาวได้ และทดสอบกดส่ง /time บนทุกขนาดจอ ภาพใน .tools/help-images (ignored) ไม่ใช่การทดสอบเครื่องมือถือจริง/แป้นพิมพ์ native IME/Safari/Firefox/screen reader

Raw evidence อยู่ข้างรายงานนี้ จึงไม่คัดเฉพาะคำตอบที่ดีมาสรุป ผลรอบนี้ไม่รองรับคำกล่าวว่าพร้อมเป็นผู้ช่วยส่วนตัวภาษาไทยทั่วไป
