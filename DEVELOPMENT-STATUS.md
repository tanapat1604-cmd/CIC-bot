# CIC Bot — สถานะการพัฒนา

อัปเดต 2026-10-04 — เป็น **preview** แชต AI ในเครื่องเชื่อมแล้ว แต่คุณภาพภาษาไทยยังมีข้อจำกัด

| ขั้น | สถานะ |
| --- | --- |
| 1. หน้าโปรโมต | ผ่านการตรวจ routing/anchors, dialog ดาวน์โหลด, responsive, WebGL จริง/scroll/context-loss fallback และ reduced motion; แยก context-loss test ออกจาก scroll เพื่อให้ software renderer ตรวจจบโดยคง assertions เดิม |
| 2. ฐาน Workspace และ mock | เสร็จตามขอบเขต preview รอบนี้: 3 โหมด, compact ชิดขวา, typed streaming/cancellation, คำสั่งจำลองตรงสถานการณ์, approval รายการต่อรายการ, attachments ในเครื่อง; build/lint ผ่าน และ tests ทั้ง 41 กรณีผ่านจากชุดรวมกับการตรวจซ้ำเฉพาะจุด ชุด CI ผ่านครบและเผยแพร่แล้ว |
| 3A. โค้ดเชื่อมต่อและ tests | เสร็จและ push แล้ว: local backend + provider interface/test provider, POST NDJSON, strict validation, bounded text history, cancellation/retry, แยก demo/backend sessions และ local access/resource limits; build ทั้งสองส่วน/lint ผ่าน ชุดใหม่ 11/11 กับ Workspace regression 30/30 ผ่าน และ CI ชุดเต็ม 52 กรณีผ่าน |
| 3B. AI จริงในเครื่อง | เชื่อม Ollama 0.34.4/qwen3:0.6b และทดสอบผ่านแอปจริงแล้ว: ตอบ/ถามต่อ/stream/หยุดถึง upstream/error/retry ไม่ซ้ำ; UTF-8 API/CLI ถูกต้อง แต่คำถามไทยใหม่นอกชุดปรับ prompt ยังมีสาระผิด จึงเสร็จด้านเชื่อมต่อและยังไม่ยอมรับคุณภาพไทยทั่วไป |
| 3C. Backend สาธารณะ | ยังไม่เผยแพร่ — รอ hosting และวิธียืนยันผู้เรียก/โควตาถาวร/งบประมาณที่เลือกและตรวจแล้ว เว็บ Pages ยังคง demo และไม่เปิด backend |
| 4. บริบทภาพหน้าจอจริง | ยังไม่เริ่ม |
| 5. Desktop และการควบคุมเครื่อง | ยังไม่เริ่ม รวมหน้าต่างลอย/always-on-top |

ข้อจำกัด: backend เลือก local Ollama หรือ deterministic test provider ผ่าน config ไม่มี login/database/ภาพหน้าจอหรือควบคุมคอมจริง แชตและสิ่งแนบอยู่ในหน่วยความจำและหายเมื่อรีเฟรช ไม่อัปโหลดภาพหรือเปิดอ่าน URL สำหรับ backend รับเฉพาะข้อความและประวัติของแชตนั้น Browser ไม่เรียก Ollama โดยตรง ไม่มี mock fallback เมื่อบริการผิดพลาด

เผยแพร่ frontend ของโค้ด `4650942` ผ่าน [GitHub Actions](https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/36524241591) และเปิดตรวจ [หน้าแอปจริง](https://tanapat1604-cmd.github.io/CIC-bot/#/app) แล้ว: HTTP 200, asset ตรงกับ build ที่ใช้ LF เช่น Git, demo/คำสั่งจำลอง/compact/mobile/refresh/WebGL ผ่าน ไม่พบ console/page/HTTP asset errors ใน flow ที่ตรวจ ปุ่มการเชื่อมต่อบนเว็บสาธารณะไม่มีการเปิด backend/live และไม่เรียก localhost ส่วน backend ยังทำงานเฉพาะ local เท่านั้น

การทดสอบเบราว์เซอร์ใช้ Chromium และ viewport จำลอง ไม่ใช่มือถือจริง คีย์บอร์ดมือถือจริง หรือ screen reader; ยังไม่ได้ตรวจ Safari/Firefox

ผล local รอบ 3B: provider/backend/transport/UI แบบ deterministic 15/15, Workspace/store/streaming/readiness 27/27 และ real Ollama browser smoke 1/1 ผ่าน ตรวจภาพจริง desktop/mobile แล้ว; real-model test เป็น opt-in จึงไม่เรียกโมเดลใน CI ผลและข้อจำกัดภาษาไทยอยู่ใน [OLLAMA-VALIDATION.md](OLLAMA-VALIDATION.md) รอบนี้ยังไม่ได้รัน landing/motion ซ้ำในเครื่อง (รอบ 3A เคยติด software-renderer timeout หนึ่งกรณีแต่ CI ผ่านครบ)

ค่าเริ่มต้น 2048 context/192 output tokens/3 threads/ปิด thinking/keep-alive 1 นาที ไม่รับประกัน RAM ใช้โมเดลเดิมกับงานสั้นหรืออังกฤษต่อได้ หากต้องการคุณภาพไทยดีขึ้น ต้องเลือกและอนุญาตทดลองโมเดลอื่นก่อนดาวน์โหลด (ยังไม่ได้ดาวน์โหลดเพิ่ม) ไม่เริ่ม 3C หรือเผยแพร่ backend ดู [วิธีรัน local](backend/README.md) และ [APP-FOUNDATION.md](APP-FOUNDATION.md)

ความคืบหน้าและจุดกลับมาต่อ: [WORK-PROGRESS.md](WORK-PROGRESS.md)
