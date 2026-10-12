# CIC ควบคุม Notepad ใหม่ — Windows 10 pilot

เปิด `http://127.0.0.1:5173/CIC-bot/#/notepad` → ตรวจบริการ → อนุญาตเฉพาะหน้าต่างใหม่ → เปิด Notepad ใหม่ → พิมพ์คำสั่ง `พิมพ์ ข้อความ` → ตรวจแผน → อนุญาตให้ CIC พิมพ์หนึ่งครั้ง แอปอ่านกลับจาก editor จริงก่อน succeeded ไม่ใช้คำตอบโมเดลเป็นหลักฐาน งานนี้ไม่ใช้ปุ่มสีเขียวของ Lab; สิทธิ์แยกเฉพาะ Notepad ใหม่ตามแผนที่ตรวจ

ตัวควบคุมเปิด fixed System32/notepad.exe ไม่มี arguments และผูกเฉพาะ PID+start time+executable+HWND+editor Edit ของ process ที่สร้างใหม่ ตรวจ UIA Edit/Document, editor ว่างและหน้าต่าง Notepad ที่เป็นเอกลักษณ์ หาก Windows11 processส่งต่อ/หน้าต่างใหม่กำกวม/ไม่ใช่ classic editor จะปฏิเสธ ไม่ค้นและผูกเอกสารเดิมแทน

อ่านข้อความด้วย bounded WM_GETTEXT บน fixed editor และส่ง Unicode down/up เป็นคู่ด้วย SendInput เฉพาะเมื่อ foreground/focus/geometry/visibility/occlusion checks ผ่าน ตรวจข้อความเดิมตรงกับแผนก่อน input, ตรวจซ้ำก่อนทุกคู่, ไม่แก้ physical modifiers ที่ผู้ใช้กด และอ่านกลับเทียบข้อความเดิม+แผนหลังทำ กรณี partial input ให้ failed และตรวจเอกสารเอง ไม่มี retry/rollback อัตโนมัติ ความเสี่ยง focus เปลี่ยนระหว่าง check กับ OS input ยังต้องทดสอบ adversarial จริง ไม่มีคำรับรองว่าจะไม่มี race ทุกกรณี

คำสั่งสูงสุด200 UTF-16 BMP unitsต่อครั้ง ไทย/อังกฤษ/ตัวเลข/newline; ไม่รับ control charsอื่น/surrogates/emoji ข้อความรวมใน editor ไม่เกิน800 raw Windows UTF-16 units (newline Windowsใช้CRLF2units) clientไม่ส่ง arbitrary HWND/path/keys/grant/owner และข้อความ `/calc ...` ที่พิมพ์ใน editor เป็น literal text ไม่ routeไปเครื่องมืออื่น

grant `notepad.append` closed/private inherited pipe + fresh nonce, server-owned task/operation/grant UUID/observation/expectedText/geometry/deadline≤30s, one use≤32effects ต่อhelper; exact request fields ทั้ง server/helper ไม่ใช้สิทธิ์แชร์จอเป็นสิทธิ์พิมพ์ ไม่เป็น unrestricted desktop.control

หนึ่ง heavy FIFO slotร่วม Core/Lab, queue2, reserve128MiB+512headroom → startup640MiB minimum ตัวเลขเป็น admission budget ไม่ใช่ RAM guarantee ดู resource measurements/ข้อจำกัดใน validation งาน chat/OCR/chess/slides มี busy bridgeเดิม โมเดล/ไฟล์weights/configเดิมไม่เปลี่ยน

หยุดจาก web, ปุ่มแดงบน “CIC · Notepad controller” หรือ Ctrl+Alt+F9; backendรอ owned helper exitก่อน acknowledge ไม่ kill Notepad/browser/โปรแกรมอื่น ไม่ปิดหรือทิ้งข้อความในเอกสารที่พิมพ์ Notepadจะอยู่ให้ตรวจ ไม่มี injected modifier hold เพราะมีเฉพาะ down/up pair; queued OS events/input race ต้องประเมินแยกก่อนรับรอง stop500ms/30trials เมื่อ helper/pipe/backendตาย ไม่มีการ regrant/replay; heartbeatขาด>2sปิดhelper สิทธิ์session10min

คำสั่ง/resultsอยู่RAM ไม่ logข้อความโดยปริยาย job32global/8ownerและoperations128เก็บ10min ภาพ/ข้อความหลักฐาน developer เป็น synthetic test contentเท่านั้น ไม่มีการเก็บหน้าจอส่วนตัว/audio/clipboard/cookies/secretsลงpublicrepo ตัวexeและSHA256 pinอยู่ignored `.tools/native-notepad`; pinตรวจ artifact mismatch ไม่ใช่ signedreleaseหรือป้องกัน malicious same-user rewrite

สร้างด้วย `scripts/build-native-notepad.ps1` ผ่าน existing Framework64 compiler+UIAutomation/WinForms assembliesในเครื่อง ไม่มี SDK/download/admin/security setting change Runtimeชั้นNotepadเป็นprototype ไม่รับรองall-app/screenshot vision/voice/Roblox/coding/3Dslides ผู้ใช้เลือกแอปและสิทธิ์อื่นแยกเมื่อเพิ่มadapter

แยกหลักฐาน: unit/HTTP/UI fixture ≠ native tool ≠ real appE2E ไม่มีผลใหม่ของ17modelcases และไม่มีtraining ดูรายงาน `validation/2026-10-08-notepad/RESULTS.md`

อ้างอิง: [Microsoft UIA multiline text vs ValuePattern](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/implementing-the-ui-automation-value-control-pattern), [UIA threading](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-threading-issues), [SendInput UIPI](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)
