# หมากรุกใน CIC

เปิด frontend และ backend ตาม README แล้วไป http://127.0.0.1:5173/CIC-bot/#/chess หรือกด **หมากรุก** ในหน้าแชต → **เชื่อมต่อ Stockfish** → เลือกฝ่ายและระดับ → แตะตัวหมากแล้วแตะช่องปลายทาง เลือกฝ่ายจะเริ่มเกมใหม่ ไม่ต้องเชื่อมแชต Ollama ก่อน

- **เล่นจริง:** ขาว/ดำ, 3 ระดับ, เริ่มใหม่, หยุดคิด/ให้บอทเดินต่อ, ตรวจรุก/รุกฆาต/เสมอ/เข้าป้อม/en passant/เลื่อนเบี้ย 4 แบบ
- **วิเคราะห์จริง:** Stockfish 19 คิดไม่เกินเป้าหมาย 1,000 ms แล้วแสดงตาแนะนำ คะแนนจากมุมมองขาว (บวกขาวได้เปรียบ), ความลึกและแนวเดินที่ตรวจถูกกฎ หาก engine ส่งขอบเขตคะแนน จะแสดงอย่างน้อย/ไม่เกิน ไม่อ้างว่าเป็นคะแนนแน่นอน ไม่แสดงคะแนนของ principal variation ถ้า engine ระดับอ่อนเลือกอีกตา
- **อธิบาย:** ใช้ข้อเท็จจริงจากกติกาและ engine (กินตัวใด รุก เลื่อนเบี้ย เข้าป้อม แนวเดิน) ไม่เรียก LLM ไม่อ้างเหตุผลเชิงกลยุทธ์ที่ engine ไม่ได้ให้ คะแนนหน่วยเบี้ยไม่ใช่จำนวนเบี้ยที่จะกินได้จริงหรือโอกาสชนะที่รับประกัน
- **ไฟล์:** วาง FEN/PGN มาตรฐานในช่องนำเข้า เลือกรูปแบบแล้วกดนำเข้า เมื่อสำเร็จเกมหยุดรอให้ตรวจตำแหน่ง ส่งออกเป็นไฟล์ .fen/.pgn ที่ดาวน์โหลดจากเบราว์เซอร์ FEN ไม่เก็บประวัติการซ้ำก่อนหน้า ใช้ PGN เพื่อเก็บเกม
- **ข้อจำกัด:** เกมอยู่ในหน้านี้ชั่วคราว ออก/รีเฟรชแล้วหาย ส่งออกก่อนออก ไม่มีนาฬิกา/undo/Chess960/ออนไลน์ CIC จบเสมออัตโนมัติเมื่อซ้ำสามครั้งหรือครบกฎ50ตา เป็นกติกาเล่นทั่วไป ไม่ใช่ขั้นตอนยื่นขอเสมอของการแข่งขัน ตรวจรูปแบบและกติกาตำแหน่ง แต่ไม่พิสูจน์ย้อนประวัติว่าทุก FEN เคยเกิดได้จากตำแหน่งเริ่มต้น

## Engine และทรัพยากร
Stockfish19 official universal Windows x86-64 อยู่ที่ .tools/stockfish19/package/stockfish/stockfish-windows-x86-64-universal.exe (ignored ไม่ถูก push) ตรวจ SHA256 archive ก่อนใช้ ตาม engine-download.json ถ้าติดตั้งเครื่องใหม่ ดาวน์โหลดเองจาก https://github.com/official-stockfish/Stockfish/releases/tag/sf_19 และเก็บ archive/source/license ครบ หรือตั้ง STOCKFISH_PATH ใน backend/.env เป็น absolute path ของ executable Stockfish19 ที่เชื่อถือได้ บน Linux ใช้ official binary ที่เหมาะกับเครื่องและตั้ง path; ยังไม่ได้ทดสอบ Linux engine จริง

เปิด process เมื่อขอคิดเท่านั้น ครั้งละหนึ่งงาน Threads1/Hash16MiB (ไม่ใช่ RAM รวม) ปิดหลังทุกคำขอ ใช้ Skill0/8/20 กับ150/350/800ms ตามระดับ ไม่ใช่ค่า Elo; วิเคราะห์ใช้Skill20/1000ms มี startup overhead และ timeout10วินาที ส่ง stop/quit และ kill หากไม่ออกใน250ms ไม่มี tablebase/book ดาวน์โหลดเพิ่ม

ปฏิเสธการเริ่มงานถ้า RAM ว่างต่ำกว่า256MiB ขีดนี้เป็นเงื่อนไขป้องกัน ไม่ใช่การรับประกัน RAM จริง ดูการวัดในรายงานรอบนี้ หากหน่วยความจำไม่พอ แสดงข้อผิดพลาดให้ผู้ใช้พักโมเดล/งานที่ไม่ใช้ ไม่มีการปิดโปรแกรมอื่นอัตโนมัติ ระหว่างตรวจ Ollama ไม่มีโมเดล resident อยู่ จึงไม่ต้องสั่งพักหรือปิดบริการ

เมื่อเชื่อมต่อหรือคิดไม่สำเร็จ ไม่มีคำตอบจำลองสลับมาแทน กดตรวจการเชื่อมต่อใหม่เมื่อ session หมดอายุ10นาที หยุดคิดแล้วจะไม่ retry อัตโนมัติ

## Backend และสิทธิ์
GET /chess/status ตรวจสถานะไฟล์/config/freeRAM โดยไม่โหลด engine (ไม่ใช่การรับรองว่า executable รันผ่านแล้ว)
POST /session เดิม → POST /chess/analyze รับเฉพาะ gameId/requestId/pgn/level/analysis ตรวจ schema และตาเดินก่อนเรียก engine ไม่รับ path/คำสั่ง UCI จาก frontend มี loopback/Host/Origin/HttpOnly cookie เดิม, PGN≤32,000ตัวอักษร, body≤160KB,90คำขอ/นาทีรวม, engine1งาน, timeoutและการยกเลิกเมื่อ HTTP ปิด ผลต้องตรง game/request/FEN ก่อนใช้ หน้าเว็บสาธารณะไม่ส่งคำขอ localhost และไม่โหลด engine

chess.js1.4.0 BSD-2-Clause มี notice ใน public/THIRD-PARTY-NOTICES.txt และส่งไปกับ Pages ส่วน Stockfish GPLv3 ไม่ถูกรวมใน frontend/repository เก็บ Copying.txt/AUTHORS/source จาก archive ไว้ในเครื่อง การแจกจ่าย engine ภายหลังต้องตรวจและปฏิบัติตาม GPL รวม corresponding source ของ binary นั้น ไม่อ้างว่าการแยก process ยกเว้นข้อกำหนดโดยอัตโนมัติ

## ตรวจซ้ำ
หยุดเฉพาะ backend CIC ที่เปิดเองก่อน browser tests ซึ่งใช้8787 ตั้ง PATH เป็น Node22 และ PLAYWRIGHT_BROWSERS_PATH ตามเครื่อง แล้ว npm run build, npm run backend:build, npm run lint, npm test

ตั้ง CIC_CHESS_LIVE=1 แล้วรัน npx playwright test tests/chess.spec.ts tests/chess-ui.spec.ts เพื่อทดสอบ official engine และหน้าแอปจริง (CI ไม่ดาวน์โหลด engine; ข้ามเฉพาะ opt-in cases) scripts/chess-evaluate.mjs ใช้ engineจริงแข่งสองสีและบันทึก PGN/ผลดิบ การรันใหม่เขียนทับผลไฟล์เดิม จึงควรสำรอง/แยกวันที่ก่อนประเมินรอบใหม่

[เกณฑ์ผ่าน](validation/2026-10-07-chess/PLAN.md) · [ผลและสิ่งที่ยังไม่ตรวจ](validation/2026-10-07-chess/RESULTS.md)
