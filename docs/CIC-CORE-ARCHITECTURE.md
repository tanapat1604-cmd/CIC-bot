# CiC Core P1 — 8 ตุลาคม 2026

ADR: ใช้ modular monolith บน Node/TypeScript เดิม Agent เป็น handler/contract ไม่ใช่หนึ่ง LLM ต่อ agent ไม่มี framework หรือ dependency ใหม่

`#/core` รับเฉพาะ `/calc` และ `/time` ผ่าน parser → plan ที่แก้ไม่ได้ → ผู้ใช้ตรวจและกดอนุญาต → grant หนึ่งงาน/หนึ่ง action → คิว → execute → verifier → result จากเครื่องมือ มี provenance จากเซิร์ฟเวอร์ ไม่มี model prose/URL/path/shell เป็นคำสั่ง

Core รุ่นนี้คือ pilot ของ bounded local tools ไม่ใช่ native controller การเปิด Chrome/YouTube/เพลง/research/Roblox/เสียง/animated slides/coding ยังไม่มี Core executor Agent contracts สำหรับ VoiceAgent/ScreenObserver/DesktopAgent/BrowserAgent/ResearchAgent/GameAgent/SlidesAgent/CodingAgent ปิดไว้ทั้งหมด ส่วน OCR/Stockfish/สไลด์ A/B ยังคงเส้นทางเดิม

ไฟล์หลัก: shared/core.ts; backend/core/{core,registry,policy,scheduler,capabilities}.ts; src/core/CorePage.tsx; shared/voice.ts ให้ ASR/TTS contracts เท่านั้น

Envelopes ถูกสร้างฝั่ง Core: version/policyVersion/taskId/sessionId/operationId/agentId/toolId/args/grantId/target/observationId/geometryVersion/deadline/preconditions/postconditions สิทธิ์ bound กับ session/task/op/tool/target/args และใช้ได้ครั้งเดียว observation/geometry เป็น null สำหรับ calculator เท่านั้น ไม่อนุญาตใช้ null กับ native action ในอนาคต

State/event: idle → planned → waiting-permission → queued → running → verifying → succeeded หรือ failed/cancelling/cancelled/stop-unverified ใช้ monotonic elapsed/deadline ไม่ขึ้น succeeded จากแค่ส่งคำสั่ง ตรวจค่าผลเลข/เวลาผ่าน trusted parser/verifier และ discard ผลเมื่อ abort/deadline

คิวสองงาน/ทำทีละงาน หนึ่ง active/queued ต่อ owner กันเจ้าของเดียวเติมคิวทุกช่อง FIFO แบบจำกัด; resource 512MiB headroom+8MiB reserve และ recheck ตอน dequeue รอเมื่อแชต/Stockfish/สไลด์/OCR เดิมกำลังทำ เส้นทางเดิมตรวจ Core busy ด้วย เป็น compatibility bridge ไม่ใช่ย้าย legacy workers ทั้งหมดมาอยู่ใน grants/scheduler ใหม่แล้ว กรณี stop โมเดลเก่าและ orphan OCR หลัง crash ยังเป็น reliability gap

Stop revokes grants และ cancels ทุก Core job ของ session; cancel ก่อนสร้างจำ operation nonce; ยกเลิกคิวได้ทันที ช่องทำงานยังถือจน execute promise/cleanup settle ถ้าตัวจำลองไม่ร่วมมือเกิน100ms แสดง stop-unverified และคง lock ไม่ใช่รับรอง native hotkey/stop≤500ms

Recovery: Core jobs/grants/events เป็น RAM ชั่วคราว10นาที 32jobsรวม/8ต่อowner/128operation tombstones งานหมดเวลา30s หลัง restart ไม่ restore grants หรือ replay tasks ไม่มี child process ของ Core รุ่นนี้ จึงไม่มี native worker orphan cleanup ที่พิสูจน์จาก Core ยังไม่แก้ slide index recovery/OCR crash orphan/OS helper/watchdog

Compatibility: /health และ CIC_CAPABILITIES version1 เดิมรวม screenRead:false คงไว้; `/core/capabilities` เป็น schema1 แยกและตรวจ client/server แยก implemented/configured/authorized/healthy/accepted/manual-disabled ไม่มีการ promote manual OCR เป็น autonomous vision `accepted:false` แปลว่ายังไม่ผ่านทุก human/native gate; OCR configured ไม่ใช่การรับรองคำไทยทุกภาพ

Rollback: หยุดใช้ #/core แล้วใช้แชต/หมากรุก/OCR/สไลด์เดิมได้ ลบ feature ผ่าน reviewed revert ของ source checkpoint หากต้องการ ไม่มี reset/clean/ลบไฟล์ผู้ใช้ บริการหยุด/เริ่มตาม README เดิม สิทธิ์ runtime ใหม่ไม่ถือจากสิทธิ์ให้ Codex แก้ repo
