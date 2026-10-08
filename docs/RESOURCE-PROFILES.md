# ทรัพยากร P0/P1

P0 Windows10Pro/i5-7500 4 logical/IntelHD630/RAM8076MiB; free เป็น snapshot400.7–405.6MiB ก่อนแก้ ไม่มีOllama resident model Health readyไม่ได้แปลว่าโหลดโมเดลอยู่ ไม่อนุมาน GPU acceleration จากชื่อ GPU ตัวเลข OS virtualTotal23112.5/virtualFree7977.2MiB เป็น counter ณเวลาตรวจ ไม่ใช่ peakของjob

Default qwen3:0.6b คงอยู่ เก็บ1.7b context2048/output192/threads3/thinkfalse ไม่ฝึกหรือปรับ weights/prompt ชุด17กรณีเดิมคง cold-load guard1152MiB ถ้าไม่รัน actual/score=null ผล Stockfish/calculator/OCR/slide exportไม่เพิ่ม model score

Core tools: queue2/globalactive1/onequeued-active perowner/deadline30s ตรวจ os.freemem ก่อนdequeue ต้อง≥512+8=520MiB ไม่มีลดguardเมื่อขาดหน่วยความจำ Queue timeoutไม่ทำงานถูกปฏิเสธอย่างตรงไปตรงมา Estimate8MiBของtoolsเป็น conservative pilot reservation ไม่ใช่ measured peakหรือรับประกันไม่paging

Build/browser checks ใช้ guard640MiB/Node heap384MiB และรันทีละงาน Light syntax/fixture probe แยกguard256/heap192; ไม่ใช่ fulltype/build/lint/browser acceptanceหรือการลด cold-model guard ผลRSSprobeมีเฉพาะprocessนั้น ไม่รวมbrowser/Core/Ollama/OS ไม่มีการปิดแอปอื่นหรือปรับpagefile

Native OCR/Stockfish guards256เดิมยังอยู่ภายใต้ legacy paths ไม่อ้างว่าทั้งระบบ migrateเข้าCore resourcegrantแล้ว อนาคตให้budgetตาม measuredpeak+OSheadroom512 รวมตัวdecoder/resampler/player/browser/PowerPoint Cold/warmและnoncoincident peaksแยก

Ollama official FAQ ระบุ parallel/contextเพิ่มการใช้RAM จึงเสนอ maxloaded1/parallel1 เมื่อมีสิทธิ์และช่วงrestartที่เหมาะสม **ยังไม่ได้เปลี่ยนบริการ/registry/config/Ollama instance** แหล่ง https://docs.ollama.com/faq ตรวจ8ตุลาคม2026

ต้องเพิ่มทั้ง-session samples working set/private bytes/commit/free อย่างมีinterval+dropped samples, actualCPUcapability/backend stop verification, native helper process tree/Job Objects และ crash recovery ก่อนหนักขึ้น ยังไม่ใช้ sampleเดียวรับรองpeak

Separate backend-only NodeNext buildguard384/heap256 passed at609MiB. Wholefrontend/browserguard640 stillunchanged. Unit-only Playwright config omitsbrowser/webServer to fit measuredresources (guard384/heap192); fullCoreunit7PASS at616MiB. RealUIjobguard520queued/timeout proves no bypass, not positiveacceptance.
