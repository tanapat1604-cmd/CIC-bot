# แชร์หน้าต่างแบบอ่านอย่างเดียว — รุ่นทดลอง

เปิด #/screen หรือเมนูแชร์หน้าต่างจากแชตในเครื่อง กดเลือกหน้าต่างหรือแท็บผ่านตัวเลือกของเบราว์เซอร์ ไม่เลือกทั้งจอ ดูตัวอย่างแล้วกดถ่ายภาพหนึ่งเฟรมได้ ปุ่มหยุดแชร์ล้างภาพและหยุดแทร็ก

ภาพหนึ่งเฟรมเก็บในหน่วยความจำของหน้านี้ ไม่อัปโหลด ไม่ส่งเข้าแชต ไม่บันทึกไฟล์อัตโนมัติ ไม่มีเสียงจากหน้าต่าง เลือกส่งเฟรมสดไปหน้า OCR เองได้ แต่ AI ภาษาไม่รับภาพ และไม่มีการคลิกหรือพิมพ์ พิกัดภาพไม่ใช่พิกัดควบคุมเครื่อง

ภาพอายุ10วินาทีขึ้นไปแสดงว่าเก่า; เปลี่ยนขนาดวิดีโอจะล้างภาพเดิม ออกจากหน้า/รีเฟรช/หยุดจากเบราว์เซอร์หยุดการแชร์ ต้องขอสิทธิ์ใหม่ทุกครั้ง ถ้ายังมีตัวเลือกหน้าต่างเปิดอยู่ คุณต้องปิดตัวเลือกเอง ผลที่มาหลังหยุดจะถูกหยุดทันที

เว็บสาธารณะเป็น demo และปิดปุ่มแชร์ เบราว์เซอร์บางตัวไม่รองรับ getDisplayMedia การทดสอบอัตโนมัติใช้ภาพจำลองผ่านแทร็กวิดีโอจริง ยังต้องให้ผู้ใช้ตรวจตัวเลือกและหน้าต่างจริงก่อนรับรองเครื่องนี้

[ผลตรวจ](validation/2026-10-08-screen-preview/RESULTS.md) · [แผนเสียง/อ่านจอ/ควบคุม/เกม](SCREEN-VOICE-ROADMAP.md)


Update8October: frameId/sourceId/sequence + performance.now timestamp begins when drawing, not after PNG encoding; ≥10s encode discarded, ≥10s handoff blocked. Missing browser surface now rejected alongside monitor. Explicitอ่านเฟรมนี้ด้วยOCR transfersoneBlob and routeleave stopsalltracks; OCR is stillimage analysis only, no clicks/windowhandle. Userreportedactualsharingworking; stop/revoke/resize/leave/retry still require individualhumanresults. See latest OCR integration report.
