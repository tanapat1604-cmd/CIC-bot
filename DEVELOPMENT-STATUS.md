# CIC Bot — สถานะการพัฒนา

อัปเดต 2026-09-29 — เป็น **preview** ยังไม่พร้อมใช้งานจริงทั้งหมด

| ขั้น | สถานะ |
| --- | --- |
| 1. หน้าโปรโมต | ผ่านการตรวจ routing/anchors, dialog ดาวน์โหลด, responsive, WebGL จริง/scroll/context-loss fallback และ reduced motion; แยก context-loss test ออกจาก scroll เพื่อให้ software renderer ตรวจจบโดยคง assertions เดิม |
| 2. ฐาน Workspace และ mock | ปรับแล้ว: 3 โหมด, compact ชิดขวา, typed streaming/cancellation, คำสั่งจำลองตรงสถานการณ์, approval รายการต่อรายการ, attachments ในเครื่อง; build/lint ผ่าน และ tests ทั้ง 41 กรณีผ่านจากชุดรวมกับการตรวจซ้ำเฉพาะจุด รอตรวจ deployment/live ของรอบนี้ |
| 3. AI chat ผ่าน backend | ยังไม่เริ่มในรอบนี้ — งานแรกของรอบหน้า |
| 4. บริบทภาพหน้าจอจริง | ยังไม่เริ่ม |
| 5. Desktop และการควบคุมเครื่อง | ยังไม่เริ่ม รวมหน้าต่างลอย/always-on-top |

ข้อจำกัด: ใช้คำตอบและภาพบริบทจำลอง ไม่มี backend/login/database/AI/API จริง ไม่แชร์จอหรือควบคุมคอม แชตและสิ่งแนบอยู่ในหน่วยความจำและหายเมื่อรีเฟรช ไม่อัปโหลดภาพหรือ fetch URL

การทดสอบเบราว์เซอร์ใช้ Chromium และ viewport จำลอง ไม่ใช่มือถือจริง คีย์บอร์ดมือถือจริง หรือ screen reader; ยังไม่ได้ตรวจ Safari/Firefox

รอบถัดไป: เชื่อมแชตข้อความกับ AI ผ่าน backend โดยรักษา identity และการหยุด stream ให้ได้ก่อน เก็บ secret ที่ server และแยกที่รัน backend จาก GitHub Pages จากนั้นจึงเพิ่มภาพหน้าจอและการลงมือทำ ดู [APP-FOUNDATION.md](APP-FOUNDATION.md)

ความคืบหน้าและจุดกลับมาต่อ: [WORK-PROGRESS.md](WORK-PROGRESS.md)
