# CIC Bot — สถานะการพัฒนา

อัปเดต 2026-09-29 — เป็น **preview** ยังไม่พร้อมใช้งานจริงทั้งหมด

| ขั้น | สถานะ |
| --- | --- |
| 1. หน้าโปรโมต | ผ่านการตรวจ routing/anchors, dialog ดาวน์โหลด, responsive, WebGL จริง/scroll/context-loss fallback และ reduced motion; แยก context-loss test ออกจาก scroll เพื่อให้ software renderer ตรวจจบโดยคง assertions เดิม |
| 2. ฐาน Workspace และ mock | เสร็จตามขอบเขต preview รอบนี้: 3 โหมด, compact ชิดขวา, typed streaming/cancellation, คำสั่งจำลองตรงสถานการณ์, approval รายการต่อรายการ, attachments ในเครื่อง; build/lint ผ่าน และ tests ทั้ง 41 กรณีผ่านจากชุดรวมกับการตรวจซ้ำเฉพาะจุด ชุด CI ผ่านครบและเผยแพร่แล้ว |
| 3A. โค้ดเชื่อมต่อและ tests | โค้ดพร้อม: local backend + provider interface/test provider, POST NDJSON, strict validation, bounded text history, cancellation/retry, แยก demo/backend sessions และ local access/resource limits; ชุดใหม่ 11/11 กับ Workspace regression 30/30 ผ่าน รอ CI/deployment frontend |
| 3B. AI จริงตอบสำเร็จ | ยังไม่สำเร็จ — ยังไม่ได้เลือก provider/model, ตั้ง server secret หรืออนุญาตการทดสอบมีค่าใช้จ่าย ไม่เคยเรียก AI จริงในรอบนี้ |
| 3C. Backend สาธารณะ | ยังไม่เผยแพร่ — รอ hosting และวิธียืนยันผู้เรียก/โควตาถาวร/งบประมาณที่เลือกและตรวจแล้ว เว็บ Pages ยังคง demo และไม่เปิด backend |
| 4. บริบทภาพหน้าจอจริง | ยังไม่เริ่ม |
| 5. Desktop และการควบคุมเครื่อง | ยังไม่เริ่ม รวมหน้าต่างลอย/always-on-top |

ข้อจำกัด: backend ปัจจุบันเป็น local test provider ไม่ใช่ AI ไม่มี login/database/ภาพหน้าจอหรือควบคุมคอมจริง แชตและสิ่งแนบอยู่ในหน่วยความจำและหายเมื่อรีเฟรช ไม่อัปโหลดภาพหรือเปิดอ่าน URL สำหรับ backend รับเฉพาะข้อความและประวัติของแชตนั้น

การเผยแพร่ขั้น 2 ก่อนหน้า: โค้ด `5affbd1` ผ่าน [GitHub Actions](https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/36501043224) และเปิดตรวจ [หน้าแอปจริง](https://tanapat1604-cmd.github.io/CIC-bot/#/app) แล้ว รอบ 3A ยังรอ commit/deployment ของ frontend ใหม่ ส่วน backend ไม่เปิดสาธารณะ

การทดสอบเบราว์เซอร์ใช้ Chromium และ viewport จำลอง ไม่ใช่มือถือจริง คีย์บอร์ดมือถือจริง หรือ screen reader; ยังไม่ได้ตรวจ Safari/Firefox

ผล local รวมจากการรันแยกชุด: 51/52 กรณีผ่าน เหลือ WebGL scroll screenshot เดิมหมดเวลาบน software renderer (ไม่มีการแก้ scene รอบนี้) การตรวจจริงครอบคลุม 1440×900, 1280×720, 390×844, 360×480; backend ใช้ test provider ฟรี ไม่มีหลักฐานว่า AI จริงตอบแล้ว

ขั้นตอนถัดไปที่ต้องตัดสินใจ: เลือก provider/model พร้อมที่รัน backend และวิธีควบคุมการเข้าถึง จากนั้นตั้ง secret ฝั่ง server (ไม่ส่ง key ในแชต) และอนุญาตการทดสอบค่าใช้จ่ายก่อนทำ 3B ดู [วิธีรัน local](backend/README.md) และ [APP-FOUNDATION.md](APP-FOUNDATION.md)

ความคืบหน้าและจุดกลับมาต่อ: [WORK-PROGRESS.md](WORK-PROGRESS.md)
