# ตรวจความพร้อม CiC ก่อนทดลอง

ใช้ `npm run doctor` ใน repo CIC ที่ติดตั้งแล้ว หรือให้ Codex เรียก `node scripts/cic-doctor.mjs` ด้วย Node ของ repo ผลเป็น JSON ไม่มีการบันทึกไฟล์เอง ไม่เปิดไมค์ ไม่สร้างเสียง ไม่โหลดโมเดลเข้า inference ไม่เปลี่ยน Windows settings ไม่ดาวน์โหลดหรือซ่อมไฟล์อัตโนมัติ

ตรวจ config ขนาดจำกัด เส้นทาง local ของ Python/worker/models ไฟล์โมเดลที่จำเป็นต้องอยู่ในรายการ hash และ SHA256 จริง ตรวจ RAM ว่างอย่างน้อย1,152MiB แล้วอ่านสถานะ frontend5173/backend8787/Ollama11434 ภายใน timeout ไม่รับ URL ภายนอกเป็น argument และไม่แสดงเส้นทาง config/cookies/token ในผล

`readyForManualTrial: true` หมายถึงไฟล์/RAM/บริการพร้อมเริ่มทดลองด้วยตัวเองเท่านั้น การพบไฟล์ Python ไม่ได้พิสูจน์ว่า import package ได้ `humanRecognition: not-assessed` และ `handsFreeAccepted: false` ไม่เปลี่ยนตามผล readiness ต้องใช้การทดลองไมค์และเสียงจริงแยก

ถ้า fail ให้ดู check ที่ไม่ผ่าน: voice-files → ตรวจการติดตั้ง/hash/config; memory → คืน RAM โดยให้ผู้ใช้จัดการโปรแกรม; frontend/backend/ollama → ตรวจบริการที่หาย ไม่ kill ทั้งเครื่องหรือเปลี่ยน default model เพื่อทำให้ไฟเขียว

`npm run doctor -- --offline` ตรวจไฟล์และ RAM โดยไม่เรียก HTTP จะคืน service checks เป็น skip และไม่สรุปพร้อมครบ ทดสอบเครื่องมือนี้ด้วย `npm run doctor:test` ซึ่งใช้ไฟล์ปลอมและไม่รัน Python/ไมค์จริง

หน้า Core แสดงตัวฟัง/เสียงตอบเป็น implemented prototype และ configured ตาม runtime ที่ติดตั้ง healthy ยังไม่ทราบจนวัดการทำงานจริง accepted/authorized ยังคง false ถ้า stop ไม่ยืนยันแสดง disabled ไม่กล่าวอ้างว่าการมีไฟล์คือผ่านเสียงผู้ใช้
