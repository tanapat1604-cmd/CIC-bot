# CIC local chess — ผลตรวจ 2026-10-07

สถานะ: implementation และการตรวจในเครื่องผ่านแล้ว; commit/CI/เว็บสาธารณะกำลังตรวจต่อ (ดู WORK-PROGRESS.md สำหรับ checkpoint ล่าสุด)

## สิ่งที่ใช้ได้จริง
หน้า #/chess เชื่อมจากหน้าแชต เล่นกับ Stockfish19 เลือกขาว/ดำและ3ระดับ เริ่มใหม่/หยุด/เดินต่อ วิเคราะห์ตาและคะแนนพร้อม provenance นำเข้า/ส่งออก FEN/PGN ตรวจข้อมูลผิด เลื่อนเบี้ย4ชนิด ตรวจรุก/ฆาต/เสมอ/เข้าป้อม/en passant คำอธิบายจากกติกาและข้อมูล engine เท่านั้น ไม่ใช้โมเดลภาษา

## เกณฑ์และวิธี
PLAN.md เขียนก่อน implementation; ตรึง evaluation-freeze.json ก่อนเปิดผลใหม่ ไม่ปรับ search/settings จากผลทดสอบ ชุดพัฒนาเป็น standard rules + starting board/Fool's mate/ตัวอย่างรุกฆาตแยก ชุดใหม่2ตำแหน่งรุกฆาตไม่ซ้ำชุดพัฒนา (ไม่อ้างว่าไม่เคยอยู่ในข้อมูล engine) แข่ง2เกมสลับสีตาม config ที่กำหนดล่วงหน้า สิ้นสุดที่160plyถ้ายังไม่จบจะบันทึก unfinished ไม่ให้คะแนนเสมอเอง

## กติกาและระบบ
- Start perft1–3:20/400/8902; Kiwipete48/2039/97862 ผ่าน ตรวจด้วย chess.js1.4.0 เทียบค่ามาตรฐาน ไม่ใช่การพิสูจน์ทุกตำแหน่งที่เป็นไปได้
- ผ่าน: เข้าป้อมทั้งสองด้านและห้ามผ่านช่องถูกรุก; en passantและกรณีเบี้ยติด pin; promotion Q/R/B/N; check/checkmate/stalemate/insufficient material/threefold/fifty-move; FEN/PGN invalidและroundtrip/history/repetition; headerผลเกม; เริ่มจากตาดำและfullmove35
- APIตรวจ schema, cookie/Origin, concurrent lock, cancellationถึงengineและtimeout ปิดprocessก่อนปล่อยงาน; bestmove/PVต้องถูกกฎ; frontendตรวจsource/score/identity/FENก่อนใช้ ไม่รับ path หรือ UCI command จากผู้ใช้
- หน้าแอปจริงผ่านทั้งสองสี วิเคราะห์/หยุด/ลองใหม่/ออกจากหน้า engineยกเลิกจริง และ fixtureที่จงใจส่งผลช้าหลังหยุด/เริ่มเกมใหม่/ออกหน้าไม่ทำให้กระดานผิดเกม ไม่เรียกOllamaจากเบราว์เซอร์
- ตรวจภาพจริง1440×900,390×844,360×480 ภาษาไทยอ่านได้ ไม่มี horizontal overflow; short/mobileเลื่อนหน้าได้ ไม่ล็อกความสูงกระดาน ภาพอยู่ .tools/chess-evidence/actual-*.png และ restored.png
- build/frontend, backend build, lint ผ่าน (คงคำเตือน Three chunkเดิม ไม่มีคำเตือน lint)
- รอบสุดท้าย default **87 PASS /4opt-in SKIP** (91 cases,2.0m); targeted chess+foundationรวมengineจริง **17/17 PASS** (24.4s); แชตจริง Ollamaที่ติดตั้งเดิม **2/2 PASS** (25.2s) ส่ง/หยุด/retry/สลับแชตไม่ซ้ำ คง prompt/model/settingsเดิม ไม่ใช่การรับรองคุณภาพไทยใหม่

## ผล engine แยกจากระบบและโมเดล
Stockfish19 official Windows universal unmodified; Threads1 Hash16MiB fresh processทุกตา ไม่ใช้opening book/tablebaseเพิ่ม ไม่คิดระหว่างรอผู้เล่น

| ชุดใหม่ | ตาที่ได้ | ตรวจรุกฆาตด้วยกติกา | เวลารวมคำขอ |
|---|---|---|---|
| 6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1 | Re8# | ผ่าน | 518 ms |
| 7k/5Q2/6K1/8/8/8/8/8 w - - 0 1 | Qg7# | ผ่าน | 595 ms |

เวลาวิเคราะห์ตั้ง1000msแต่engineอาจจบก่อนเมื่อค้นพบmate; ความลึก245plyที่ปรากฏเป็นค่าUCIจริงในตำแหน่งจบเร็ว ไม่ใช่การอ้างว่าวิเคราะห์เกมทั่วไปลึกเท่านี้

| ฝ่ายระดับเต็ม | คู่แข่ง | ผล | จำนวนply | เวลารวม |
|---|---|---|---|---|
| ขาว Skill20/800ms | Stockfish19 Skill0/150ms | strong-win | 47 | 46.057 s |
| ดำ Skill20/800ms | Stockfish19 Skill0/150ms | strong-win | 46 | 44.284 s |

2ชนะด้วยรุกฆาต/0เสมอ/0แพ้/0unfinished เทียบคู่แข่งระดับอ่อนที่ระบุข้างต้นเท่านั้น จำนวนเกมและโจทย์น้อย ไม่มีElo/สถิติความเชื่อมั่น/รับประกันชนะทุกคู่แข่ง ยังไม่ได้วัดแท็กติกหลายระดับ endgame/tablebase หรือแข่งมนุษย์ที่มีrating

ผลดิบพร้อมคะแนน/bounds/depth/เวลาของทุกตา: evaluation.json; เกม: match-strong-w.pgn และ match-strong-b.pgn คะแนนcpแปลงเป็นมุมมองขาวพร้อมกลับทิศlower/upper bound เมื่อฝ่ายดำเดิน หากระดับอ่อนเลือกbestmoveคนละตากับPV จะไม่แสดงคะแนนของPVนั้นกับตาที่เลือก

## ทรัพยากร
เครื่องi5-7500/4threads RAMเห็น7.89GiB IntelHD630; freeตอนเริ่ม868MiB และเปลี่ยนตามงานขณะนั้น Sampling15ครั้งระหว่างแข่ง: OS-reported peak working setสูงสุดที่จับได้ **320.0MiB** ของStockfishprocess ไม่ใช่RAMทั้งหมดของCIC/Windows และไม่ใช่รับประกันpeakทุกสถานการณ์ ข้อกำหนดHash16MiBไม่ใช่เพดานRAMรวม
Ollama /api/ps ว่างตอนเก็บresource จึงไม่จำเป็นต้องสั่งunload ไม่ปิดOllamaหรือโปรแกรมอื่น engineไม่มีprocessค้างหลังตรวจ ไม่มีFPS/CPUlatencyรับประกัน

## ความล้มเหลวที่เก็บไว้และการแก้
1. npmครั้งแรกติดใบรับรอง TLS: ใช้Node --use-system-ca แล้วติดตั้งสำเร็จ ไม่ปิดTLSverification
2. รอบdefaultแรก85PASS/1FAIL/4SKIP: assertionเดิมยังคาดว่าหมากรุกไม่รองรับ เปลี่ยนให้ตรวจสถานะหมากรุกใหม่พร้อมข้อความต้องมีStockfish/backend และยังตรวจสไลด์ไม่รองรับ; ไม่ลบหรือลดassertions ฟังก์ชันแชตเดิมผ่านรอบสุดท้าย
3. PGNรายงานชุดแรก setHeaderหลายคู่ในคำสั่งเดียวซึ่งAPIรับทีละคู่ ทำให้White/Black/Resultไม่ครบ เก็บไฟล์ before-header-fix.pgn ไว้ แก้เฉพาะmetadataจากตาเดินดิบแล้วตรวจreplay/finalFEN/checkmate/roundtrip ไม่รันengineใหม่หรือเปลี่ยนผลแข่ง เพิ่มexportผลเกมและเลขตาสำหรับFENในUI พร้อมtestsเฉพาะ แล้วrerunทั้งหมด
4. evaluation-freezeเป็นโค้ดก่อนแก้PGN; final-freezeเป็นโค้ดส่งมอบ **backend/chessEngine.ts SHA256ตรงกัน** ไม่มีปรับengineหรืออธิบายจากผลชุดใหม่แล้วใช้คะแนนเก่าอ้างว่าดีขึ้น Export testsหลังแก้เป็นregressionแยกจากคะแนนengineเดิม

5. Post-commit review found imported resignation/agreed-draw PGN Result was replaced with * on export. Confirmed actual 1-0→* before fix; now preserves original result until a new move is played, then resets to*. Added all3 result regression checks and downloaded/re-read both files through actual UI (1-0 before continuation, * plus Nf3 afterward). Builds/lintPASS; chess10PASS/2opt-inSKIP plus strengthened export browser1/1PASS. Engine/search unchanged; first CI37573667526passed, final fix CI/public verification pending.

## สิ่งที่ยังไม่รองรับ/ยังไม่ตรวจ
ไม่มีนาฬิกา/Chess960/undo/persistent games/online matchmaking; กติกาCICจบthreefoldและ50movesอัตโนมัติ ไม่ใช่tournament claim workflow FENไม่มีประวัติการซ้ำก่อนหน้า และไม่พิสูจน์retrograde reachabilityทุกตำแหน่ง chess.js insufficient-materialไม่ใช่solverของdead-positionซับซ้อนทุกชนิด
อธิบายเป็นข้อเท็จจริงสั้น ๆ ไม่ใช่coachกลยุทธ์ภาษาธรรมชาติเต็มรูปแบบ; ภาษาไทยทั่วไปของqwenยังทดลอง ไม่ได้ฝึกโมเดลหรือปรับpromptในรอบนี้ สไลด์/วิดีโอยังไม่เริ่ม
UIตรวจChromium+viewportจำลอง ไม่ใช่อุปกรณ์มือถือจริง/Safari/Firefox/screen reader; WindowsStockfishจริงเท่านั้น ยังไม่ตรวจLinuxbinaryจริงหรือlong-durationgamesหลายชั่วโมง

## License / privacy
chess.js1.4.0 BSD-2-Clause noticeรวมในpublic/THIRD-PARTY-NOTICES.txt; Stockfish19 GPLv3 archiveSHA256ตรวจตรงofficialdigest (engine-download.json) เก็บsource/license/AUTHORSไว้กับarchiveใน.toolsซึ่งignored ไม่มีbinaryหรือbackendในPages/repo ถ้าจะแจกengineต้องทบทวนcorrespondingsource/GPLตามรุ่นจริง ไม่ดาวน์โหลดAImodel/เรียกบริการเสียเงิน/ส่งเกมให้บริการAIภายนอก

[วิธีเปิดใช้และข้อจำกัด](../../CHESS.md) · [จุดต่อ](../../WORK-PROGRESS.md)
