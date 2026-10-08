# สิทธิ์ P1

ช่องทาง loopback Host/Origin/peer/HttpOnly session เดิมยังบังคับก่อน Core endpoint POST ต้องมี exact trusted origin, application/json ไม่มี encoding และ body≤4096bytes GET job ต้องเป็น owner ไม่ return cookie/owner/token ใน JSON

สิทธิ์ที่ **ออก grant ได้ตอนนี้**: tools.calculate เฉพาะ calculator/time-calculator หนึ่ง action ที่ผู้ใช้ตรวจแล้ว UI เริ่มไม่ได้จากผลโมเดล ข้อความ OCR หรือ reference ที่ยังไม่ตรวจ Plan request รับเพียง version/operationId/instruction; unknown fields/reference/forged result/grant/path/owner ถูกปฏิเสธ

สิทธิ์ที่จองชื่อและ **ยังไม่เปิด**: screen.read, mic.listen, audio.speak, desktop.control, browser.read/control, web.fetch, workspace.read/write, process.run, external-provider.egress ต้องมี adapter/policy/target/resource/verifier/native-stop และ gate ของตนก่อนให้ grant ไม่ออก grant จาก system prompt หรือ checkbox แชร์อ่านอย่างเดียวเดิม

Core grant สร้างบนserver ผูกกับ owner/task/operation/tool/target/expression/policyVersion/monotonic expiry หนึ่งครั้ง≤30s Revoke/cancel/expired/wrong owner/wrong target/replay ถูกปฏิเสธก่อน effect ไม่มี generic grant endpoint ให้ client เลือก desktop/process tools

Core stop ไม่ใช่ global PC stop ใช้กับ Core jobs เท่านั้น Legacy chat/OCR/slides มี stop ของตนเดิม ไม่ประกาศว่า abort HTTP หยุด Ollama computeจริง ไม่มี native helper/input/hotkey ใน P1 และไม่ยกระดับสิทธิ์ ไม่แก้ Defender/UAC/pagefile/anti-cheat

Privacy: ไม่มี log คำสั่ง/ผล Core โดยปริยาย job args/results อยู่ในRAMตามbounded retention ผู้ใช้เลือกดูเอง หลักฐาน dev เป็นภาพ/คำสั่งสังเคราะห์ ไม่มีภาพส่วนตัว/audio/cookies/secretsในpublic report Raw JSON/freezes/resources อยู่ C workspace/privateignored ไม่มี persistent personal memory

Future gates: browser fetch ต้อง scheme/domain/redirect/DNS/IP checksทุกhop (SSRF fixtureยังNOT-RUNเพราะไม่มี fetch adapter); CodingAgent ต้อง canonical workspace+reparse escape+secrets filtering+OS sandbox (ยังNOT-RUN); native helperใช้ user ACL named pipe และ paired identity ไม่เปิด raw control HTTP endpoint ทุก negative gate ที่ยังไม่มี adapterไม่ถือว่าผ่าน

## Native Lab supplement — 8 October 2026
Closed lab.control permits only the newly owned CIC Lab window, reviewed single action plus native human confirmation. General desktop.control remains disabled; read-only sharing never grants Lab control. Private inherited pipes/nonce and helper-side observation/deadline/geometry/grant checks; one-time≤30s. Web stop waits owned child exit. See NATIVE-LAB.md; no SendInput/clipboard/other-app/shell permission.
