# CIC เปิดเพลง YouTube แบบทดลอง

เปิด `#/youtube` จากปุ่ม “เปิดเพลง” ในแชต เชื่อม CIC ในเครื่อง อนุญาตขอบเขต ใส่คำสั่ง แล้วกด “ให้ CIC คิดแผน” ตรวจศิลปินและเงื่อนไขจากโมเดล ก่อนอนุญาตค้น/เล่นหนึ่งครั้งภายใน 30 วินาที

นี่เป็น BrowserAgent เฉพาะ YouTube แยกจากแชตข้อความทั่วไป: qwen3:0.6b แยก artist/latest ด้วย structured output; เครื่องมืออ่าน DOM ค้นช่องที่มี Official Artist Channel ตรวจ Videos/Latest และเลือกเพลงเต็มที่มี Official ในชื่อ ข้าม teaser/behind-the-scenes/live. ไม่ hardcode ศิลปิน ช่อง เพลง หรือ video ID. “ล่าสุด” หมายถึงรายการเพลงเต็มแรกในรายการวิดีโอที่เห็นและเรียง Latest ของช่องที่เลือก ไม่รับรองเพลงที่เผยแพร่บนทุกแพลตฟอร์มหรือทุกช่องร่วมงาน

Chrome ที่ CIC เปิดเป็นหน้าต่างใหม่บนเครื่อง ใช้โปรไฟล์ชั่วคราว ไม่ใช่แท็บใน Codex และไม่ผูก Chrome ส่วนตัว หลังสำเร็จดูภาพหน้าต่างจริงใน CIC หรือเปิดลิงก์ผลลัพธ์ในแท็บได้ ปุ่มหยุดปิดเฉพาะ Chrome ของงานนี้ อายุงาน/หน้าต่างไม่เกิน 10 นาทีจากเริ่มวางแผน การออกจากหน้า CIC ระหว่างทำส่งยกเลิก; หลังสำเร็จเก็บ Chrome ให้ดูจนหยุดหรือหมดอายุ

## หลักฐานสำเร็จ

คำตอบโมเดลที่ผ่าน schema เป็นแผน ไม่ใช่หลักฐานเปิดเพลง การเปิดสำเร็จต้องตรง URL video ID และชื่อคลิปที่เลือก มี video readyState >=3, paused=false, ended=false, muted=false, volume>0 ไม่มี ad-showing และ currentTime เดินมากกว่า 0.5 วินาทีระหว่างสอง observation. ไม่บังคับ video.play ผ่าน JS ไม่กดข้ามโฆษณาที่ซ่อน ไม่อ้างว่าได้ยินเสียงลำโพงจริง

## ทรัพยากร

ค่าเดิม qwen3:0.6b, context2048/output192/threads3/thinkfalse; planner ใหม่ใช้ temperature0/seed42/keep_alive0 และ schema แยกงาน ใช้คำอธิบายงานใหม่เฉพาะ planner ไม่แก้ prompt/evaluation แชตเดิมหรือ weights. ไม่มีการดาวน์โหลดหรือฝึกโมเดล เก็บ 1.7b เดิม แต่ยังไม่เปิดให้ music planner ใช้ เพราะยังไม่ทดสอบ budget

โหลดโมเดลเมื่อ RAM ว่าง >=1152 MiB และ `/api/ps` ว่าง ตรวจ `/api/show` ว่าเป็น local completion แล้วเรียก `/api/chat` ใน localhost. ปล่อยโมเดลด้วย keep_alive0 และตรวจ ps ว่างก่อนแผนรออนุญาต เปิด Chrome เมื่อ RAM ว่าง >=1536 MiB =512headroom+1024reserve. แชร์ FIFO กับ Core/Lab/Notepad (heavy1/queue2) และกันชนกับ chat/chess/OCR/slides. เกณฑ์ admission ไม่ใช่ hard RAM limit หรือผล peak ทั้งระบบ

## สิทธิ์และข้อจำกัด

- local backend ต้องตรง loopback Host/Origin, cookie HttpOnly/SameSite และ owner ของงาน; mutation รับ JSON exact fields, operation ID กัน replay, task อนุญาตครั้งเดียว
- ไม่มี arbitrary shell/path/URL จากโมเดล ในหน้าต่างควบคุมไม่มี login/account/profile ส่วนตัว/credentials/clipboard/file upload/download/subscription/message
- คำค้นเป็นชื่อศิลปินสาธารณะที่ตรวจแผนแล้ว บทความ/หน้าเว็บเป็นข้อมูล ไม่ใช่คำสั่งหรือสิทธิ์
- Browser top-level navigation จำกัด HTTPS www.youtube.com results/watch/ช่อง/videos; resources จำกัด YouTube/Google media/CDN/ads domains, ปิด service workers/WebSocket/popups/downloads. เป็น hostname allowlist ไม่ใช่ DNS-rebinding-proof network sandbox; ยังต้องตรวจแยกก่อนขยายเป็น general research
- launchServer control endpoint ผูก127.0.0.1และเก็บเฉพาะ backend ไม่ส่ง frontend/log; Chrome sandbox เปิด ไม่ปิด phishing protection, HTTPS upgrades/storage partitioning/self-XSS warnings ด้วย default flags ของ Playwright ที่กรองออก (dependency pin1.63.0)
- CAPTCHA/login/age/region barrier ทำให้งานหยุด ไม่มี bypass
- ยกเลิกโมเดลไม่อ้างว่า HTTP abort หยุด inference: รอคำขอและตรวจ residency. หากตรวจ cleanup ไม่ได้ล็อกงานเป็น stop-unverified. หาก HTTP/model terminal หรือการปล่อย residency ตรวจไม่ได้ ไม่ถือ ps-empty เพียงอย่างเดียวเป็นหลักฐานว่าหยุด; การตรวจ cleanup รวมไม่เกินประมาณ5วินาที และการหยุดซ้อนใช้ promise เดียวกัน. การใช้ Ollama พร้อมกับ client อื่นยังเป็น race ที่ไม่รองรับ; ps-empty เป็น precondition ไม่ใช่ระบบ lease ทั้งเครื่อง
- Browser stop รอการออกของ child process ที่ CIC เปิด ไม่ kill Chrome ทั้งเครื่อง ไม่มี global Ctrl+Alt+F9 สำหรับ BrowserAgent; hotkey นั้นยังเป็นของ Lab/Notepad helper เท่านั้น

## รายงานทดสอบ

แยก fixture tests, REAL-MODEL planner, REAL-BROWSER component และ REAL-APP end-to-end. เก็บรอบไม่ผ่านและข้อจำกัดไว้ด้วย ไม่เพิ่มคะแนนชุดโมเดล17ข้อเดิมจากผลเครื่องมือ และไม่ถือเพลงทดสอบหนึ่งเพลงเป็นการรับรองทุกศิลปิน/ทุกหน้า YouTube


## วัดทรัพยากร 2026-10-09

หลัง playback ผ่านใน CIC ตัวหลัก: Chrome ของ backend เท่านั้น10process, sumWS1084.61MiB (อาจนับ shared pages ซ้ำ), sumPrivate729.75MiB (committed ไม่ใช่ physical), RAMระบบว่าง720.57MiB. หนึ่ง snapshotหลังเล่น ไม่ใช่ peak/latency guarantee. เพิ่มreserveChromeจาก384เป็น1024/admission1536เพื่อเผื่อการใช้จริง และถือ browser ที่เก็บไว้ให้ดูว่ายังใช้ทรัพยากรอยู่: งานหนักของ CIC ต้องรอให้หยุด browser นี้ก่อน ไม่ประกาศพร้อมรับงานโมเดลเพียงเพราะ playback ผ่านแล้ว.


## หน้าต่างปิดและผลที่ผ่านมา

ผลสำเร็จเป็นประวัติของการตรวจตอนเล่น แยกจากbrowserOpenที่อ่านจากตัวควบคุมปัจจุบัน. ถ้าหน้าต่างปิด ปุ่มภาพจะปิดและแจ้งสถานะตรง; ไม่มีการเปิดเพลงซ้ำเอง. เริ่มคำสั่งใหม่ด้วย operation ใหม่ได้หลังตัวเก่าออกจริง. กดหยุดระหว่างคำขอแผนที่ยังล่าช้าจะ reserve cancel ของ operation ก่อนรอ Stop จึงไม่ประกาศหยุดแล้วและปล่อยให้แผนเดิมกลับมาเริ่มทีหลัง.


## Chrome บนเดสก์ท็อปและเล่นต่อในโปรไฟล์ปกติ

หน้าต่างที่ CIC ควบคุมขอขยายเต็มจอ และปุ่มแสดงหน้าต่างตรวจ Browser windowState=maximized ก่อนรายงาน. ผลนี้ยังต้องตรวจหน้าจริง ไม่ใช่หลักฐานว่าใช้โปรไฟล์ส่วนตัว. หลังเพลงผ่านการตรวจ กดอนุญาตเปิดคลิปนี้ใน Chrome ปกติของฉัน แล้วส่งเพลงไป Chrome ปกติ. URL มาจากผลของงาน ไม่รับจากโมเดลหรือไคลเอนต์; เปิด executable Chrome ที่ติดตั้งด้วย --new-window ไม่ใช้ shell หรือ debugger. ปิด Chrome ของ CIC ก่อน แล้วตรวจ RAM อีกครั้ง1536MiB. Chrome ปกติใช้โปรไฟล์ตามการตั้งค่าของ Chromeเอง; CIC ไม่อ่านคุกกี้/บัญชี ไม่ควบคุมหน้าต่างนั้นต่อ และไม่อ้างว่าเล่นแล้วเพียงเพราะ spawn สำเร็จ. Stop ยกเลิกคำขอที่ล่าช้าแต่ไม่ปิด Chrome ปกติที่ส่งไปแล้ว.

Chromeตั้งแต่136ไม่รองรับ remote debugging กับ default user-data-dir ตามเอกสาร https://developer.chrome.com/blog/remote-debugging-port จึงไม่เพิ่มการ debugger/ดึงโปรไฟล์ส่วนตัวเพื่อให้บอทดูเหมือนเก่งขึ้น. การควบคุมแอปจริงทั่วไปและเสียงยังต้องทำขั้นตอนอนุญาต/รับรองแยก.

## เตรียมฝึกและวัดโมเดล

ดู training/music-intent-v1/README-TH.md และ scripts/evaluate-music-intent.mjs สำหรับ48ตัวอย่างฝึกกับ16developmentholdout. ยังไม่มีการปรับweights; ข้อมูลเตรียมฝึกไม่ถูกนำไปเปลี่ยนproductionpromptหรือfrozen17.
