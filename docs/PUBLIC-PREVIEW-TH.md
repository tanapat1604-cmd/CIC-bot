# ทดลอง CiC บน Windows

สถานะล่าสุด/ข้อจำกัดและ100คลิป: [CIC-CURRENT](CIC-CURRENT.md) อ่านก่อนขั้นตอนเก่าด้านล่าง รุ่นนี้ยังไม่รับรองเสียงหรือทุกแอป

รุ่นนี้เป็นซอร์สสำหรับทดลองในเครื่อง ยังไม่มีตัวติดตั้งพร้อมใช้ และยังไม่รับรองว่าเสียงไทยแม่นหรือเร็วเหมือน ChatGPT การค้นใน Chrome รองรับค้น Google และอ่านชื่อผลลัพธ์ ยังไม่ใช่การควบคุมทุกเว็บไซต์/ทุกโปรแกรม

## เริ่มจากการพิมพ์

ติดตั้ง Node.js 22 LTS และ Git จากแหล่งทางการ จากนั้น:

~~~powershell
git clone --branch cic-voice100-checkpoint-2026-10-16 https://github.com/tanapat1604-cmd/CIC-bot.git
cd CIC-bot
npm ci
Copy-Item backend/.env.example backend/.env
npm run backend:dev
~~~

อีก terminal รัน npm run dev แล้วเปิด http://127.0.0.1:5173/CIC-bot/#/cic ค่า AI_PROVIDER=test เป็นตัวทดลอง ไม่ใช่ AI จริง ถ้าจะใช้ AI ในเครื่อง ให้ติดตั้ง Ollama และโมเดลก่อน ตั้ง AI_PROVIDER=ollama และ AI_MODEL ให้ตรงกับโมเดลที่มี แล้วเริ่ม backend ใหม่ การค้น Chrome ใช้ local Ollama ไม่มี cloud fallback

การพิมพ์คำนวณ/บวกเวลา/ขอรายการช่วยเหลือใช้งานได้โดยไม่ต้องติดตั้งเสียง การเปิดแอปต้องอนุญาตครั้งเดียวระหว่างใช้งาน หยุดจะหยุดไมค์/เสียงตอบ/งานปัจจุบันและเก็บสิทธิ์เดิม จบการใช้แอป/ออกจากหน้า/ไม่ใช้งาน10นาทีจะถอนสิทธิ์

## ตัวควบคุม Windows

~~~powershell
powershell -NoProfile -File scripts/build-native-notepad.ps1
powershell -NoProfile -File scripts/build-native-chrome-reader.ps1
~~~

ใช้ compiler .NET Framework ที่มีใน Windows 64-bit ไม่ใช้สิทธิ์ administrator หากไม่มี compiler ให้หยุดและตรวจระบบ ไม่ต้องปิด Defender หรือ UAC เปิด Chrome ปกติด้วย fixed arguments; ไม่อ่าน cookie/profile หรือเชื่อม debugger หยุดจะไม่ปิด Chrome ส่วนตัว

## เสียงเป็นทางเลือก

ซอร์สไม่รวมโมเดล เสียงคน ไฟล์บันทึกหรือ Python ของผู้พัฒนา ติดตั้ง Python/venv ของตนเอง และ dependency ที่ตรึงใน backend/voice/requirements.lock.txt:

~~~powershell
python -m venv .tools/voice-runtime
.tools/voice-runtime/Scripts/python.exe -m pip install -r backend/voice/requirements.lock.txt
~~~

ต้องเตรียม ASR ในรูป CTranslate2 เช่น [faster-whisper-base](https://huggingface.co/Systran/faster-whisper-base) ให้ครบ model.bin/config.json/tokenizer.json/vocabulary.txt และเสียง Piper Thai .onnx พร้อม .onnx.json ในเครื่อง ดู [เอกสาร faster-whisper](https://github.com/SYSTRAN/faster-whisper) ก่อนเลือก/แปลงโมเดล ไม่ดาวน์โหลดโมเดลให้เอง ไม่ใช้บริการเสียง cloud

[MODEL_CARD เสียง Thai tsync2](https://huggingface.co/rhasspy/piper-voices/blob/main/th/th_TH/tsync2/medium/MODEL_CARD) ระบุชุดข้อมูล CC BY-NC-SA 3.0 รุ่นนี้ไม่แจก weights หรือ runtime ที่บันเดิลเสียงนี้ ไม่ประกาศสิทธิ์ใช้เชิงพาณิชย์ ให้ตรวจเงื่อนไขของส่วนประกอบที่ตนเลือก

~~~powershell
node scripts/configure-voice.mjs --python "C:/absolute/venv/Scripts/python.exe" --asr "C:/absolute/ct2-model" --tts "C:/absolute/th_TH-tsync2-medium.onnx" --model faster-whisper-base-cpu-int8 --dry-run
~~~

เปลี่ยน absolute paths ให้ตรงเครื่อง แล้วเอา --dry-run ออกเพื่อเขียน .tools/voice-config.json คำสั่งจะตรวจไฟล์และสร้าง SHA256 ไม่เปิดไมค์/รันโมเดล/รับรองความแม่น ไม่ทับ config ที่มีอยู่ เว้นแต่ระบุ --replace หากใช้ small เลือก faster-whisper-small-cpu-int8; รุ่นกลั่นที่แปลงเป็น CT2 แล้วเลือก distill-whisper-th-small-cpu-int8 และใช้ vocabulary.json แทน vocabulary.txt

เริ่ม backend ใหม่หลังตั้งค่า แล้ว npm run doctor ตรวจบริการ/ไฟล์/หน่วยความจำ การผ่าน doctor หมายถึงพร้อมทดลอง ไม่ใช่การรับรองเสียง ต้องกดเริ่มคุยเองจึงจะเปิดไมค์

## สถานะที่ทราบ

- ในเครื่อง i5-7500 ของผู้พัฒนา ASR รอบคนจริงยังใช้ประมาณ6–10วินาทีและมีคำผิด ไม่อ้าง benchmark ของเครื่องอื่นว่าใช้ได้เท่ากัน
- เสียง/ข้อมูลรอบคุยอยู่ RAM ตามอายุที่กำหนด ไม่บันทึกเสียงผู้ใช้ถาวรอัตโนมัติ
- ใบตอบรับว่า “ส่งคำขอเปิด” ไม่ได้ยืนยันว่าหน้าต่างยังอยู่หรือวิดีโอเล่นจริง
- ยังไม่มี general desktop agent, CodingAgent หรือ Multi-Agent
- Public GitHub Pages เป็น demo ไม่เชื่อม backend ในเครื่องจากเว็บสาธารณะ


### ชุดตรวจที่ต้องมีข้อมูลส่วนตัวในเครื่อง

ค่าเริ่มต้นของPlaywrightไม่รวมacoustic/model-profile experiments และChrome1000/9000/tool-matrix benchmarksที่ต้องอ่านvalidationส่วนตัว ชุดเหล่านี้ยังมีซอร์สและconfigเฉพาะ แต่ไม่ถูกนับว่าผ่านในpublic CI ใช้รายงานจริงในdocs/checkpointsสำหรับสถานะเสียง ไม่สร้างไฟล์เสียงหรือผลลัพธ์ปลอมให้cloneผ่าน ส่วนNode testsรันผ่านdoctor:testและvoice:configure:testแยกจากPlaywright


ตรวจcontract/owner/Stop/ความจำโดยไม่ใช้โมเดลหรือไมค์: `npm run test:public-unit` ผลจากสำเนาซอร์สที่ไม่มีข้อมูลส่วนตัวรอบ16ตุลาคม123ผ่าน; ไม่ใช่คะแนนเสียงหรือการตรวจทุกแอป ชุดเริ่มต้นรวบรวมได้428tests แต่รอบนี้ไม่ได้รันทั้งหมด
