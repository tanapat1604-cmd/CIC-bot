# Ollama local validation — updated 2026-10-04

## Latest: intent routing and false refusals (2026-10-04)

See [new intent trial](validation/2026-10-04-intent/RESULTS.md). Same0.6b/prompt/settings;1.7b retained/no downloads. Frozen new contrast pairs: unsupported routing misses11/13→0/13, false system refusals2/13→0/13, ambiguous system clarification0/1→1/1. Model false refusals remain3/13; first-person capability claim remains. No aggregate Thai readiness claim and no retuning from holdout. Calculator/time provenance unchanged. Related48/48 and actual0.6b browser flows PASS. Final restoration/CI checkpoint: WORK-PROGRESS.md.


## Latest: correctness and truthful capabilities (2026-10-04)

See [full new trial](validation/2026-10-04-correctness/RESULTS.md). Keep0.6b/default and1.7b installed. Frozen held-outs2/12→7/12;6 final passes from explicit system/tools,1 model money response passed both. Reminder paraphrase escaped and output_limit regressed; role/format/NL-time remain failures. Same model/settings; no tuning from holdout. Related46/46 and installed0.6b actual browser smoke PASS. Capabilities/provenance are authoritative; model prose remains unverified. No external actions or public backend. Final CI/demo checkpoint is in WORK-PROGRESS.md.


ส่งมอบรอบนี้เสร็จ: commit b3a3afa push แล้ว; [CI/Pages](https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/37182359849) ผ่าน. Demo ตรวจจริงและ asset hash ตรง build หลัง deploy; backend เดิม 0.6b กลับพร้อมเฉพาะในเครื่อง. Final docs checkpoint ใช้ [skip ci].

**ผลรอบล่าสุด: คง qwen3:0.6b; ภาษาไทยทั่วไป/ผู้ช่วยส่วนตัวที่เชื่อถือได้ยังไม่ผ่านทั้ง0.6bและ1.7b.** ดาวน์โหลดเฉพาะ1.7bตามอนุญาตหลังผู้ใช้ปิดโปรแกรมและตรวจRAMว่าง2.42GiB เก็บ0.6bไว้; backendยังในเครื่องและPagesยังdemo

รายงานครบพร้อมคำถาม/คำตอบจริง คะแนนสองรอบ เวลา RAMที่วัดได้ และข้อจำกัด: [RESULTS.md](validation/2026-10-04-thai/RESULTS.md). แผนและเกณฑ์ถูกตรึงก่อนผล: [PLAN.md](validation/2026-10-04-thai/PLAN.md); raw60requests: [comparison.json](validation/2026-10-04-thai/comparison.json); [RAM samples](validation/2026-10-04-thai/memory-samples.json); [rubric review](validation/2026-10-04-thai/review.json)

| ผลสองรอบ | 0.6b | 1.7b |
| --- | --- | --- |
| ผ่านrubric ต่อรอบ | 5/14 | 5/14 |
| ผ่านคำถามใหม่ต่อรอบ | 2/8 | 2/8 |
| warm median / p95 | 1.895s / 4.927s | 2.958s / 7.147s |
| warm sampled peak Ollama+runner WS | 830.6MiB | 1631.8MiB |
| warm sampled RAMว่างต่ำสุด | 1404.0MiB | 879.7MiB |
| หน้าแอป smokeที่ตรวจcompletionจริง | PASS | FAIL: retry output_limit |

1.7bรันได้ด้วยCPUและผ่านเกณฑ์ทรัพยากรในsessionนี้ แต่เงินทอนตอบ20แทน40 เวลา16:00แทน15:05 และทั้งคู่รับปากตั้งเตือนที่CICทำไม่ได้ จึงไม่เปลี่ยนdefault. การผ่านecho/2+3/ปฏิเสธหน้าจอไม่เพียงพอรับรองไทยทั่วไป; followupมีสรรพนาม/บทบาทผิด

RAMสุ่มวัดจากWindowsรวมllama-serverที่ตรวจpath; samplerเดิมตกหล่นrunnerจึงเก็บpilotแต่ไม่ใช้ตัดสิน. Actual interval median978ms/p953412ms/max4855ms, 14/60คำขอสั้นไม่มีsampleในช่วงตอบ (null), peakเป็นค่าที่สุ่มพบ ไม่อ้างRAMสูงสุดทั้งหมดหรือpaging-free. คำตอบซ้ำseed42เหมือนกันไม่ใช่สถิติอิสระ

Buildfrontend/backend+lintผ่าน ชุดที่เกี่ยวข้อง42/42ผ่าน. พบsmokeเดิมรายงานผ่าน1.7bผิดจากassertionไม่ครบ จึงแก้ให้requiredone/noalert/noincomplete แล้วรันซ้ำ: 0.6bPASS,1.7bFAILตามจริง. รายละเอียด[verification](validation/2026-10-04-thai/RESULTS.md#หน้าแอปจริงและการตรวจโค้ด). ไม่มีfrontendproductionเปลี่ยน ไม่มีการแก้encodingหรือเผยแพร่backend

ขั้นถัดไปตามผู้ใช้เลือก: เน้นความถูกต้องและไม่อ้างสิ่งที่ทำไม่ได้ก่อนบุคลิกจาวิส แยกdevelopmentset/holdoutใหม่ ใช้ชุดนี้เป็นregressionเท่านั้น ยังไม่ดาวน์โหลดโมเดลอื่นและยังไม่เพิ่มscreen/control/publicbackend

## ประวัติขั้น3B — ผลเดิม2026-09-29และตรวจซ้ำ2026-10-04ก่อนทดลอง1.7b

ข้อความเรื่องไม่ดาวน์โหลดในส่วนประวัติด้านล่างหมายถึงรอบก่อน ไม่ใช่สถานะรอบล่าสุด

ขั้น 3B **เชื่อมโมเดลจริงในเครื่องผ่านแล้ว** แต่ **คุณภาพภาษาไทยทั่วไปยังไม่ผ่านการยอมรับ** ใช้ทดลองข้อความสั้นได้ ไม่ใช่หลักฐานว่าเป็นผู้ช่วยที่เชื่อถือได้ทุกเรื่อง ไม่มีการดาวน์โหลดโมเดลหรือเปิด backend สาธารณะ

## สิ่งที่ตรวจจริง

- วันที่ 2026-10-04 กลับมาตรวจพบ CLI/API อัปเดตเป็น `0.35.1` โมเดลยังมีเฉพาะ qwen3:0.6b digest/ขนาดเดิม และ thinking false/true เหมือนเดิม ตรวจ [API types v0.35.1](https://github.com/ollama/ollama/blob/v0.35.1/api/types.go) และ [เอกสารเวอร์ชันเดียวกัน](https://github.com/ollama/ollama/blob/v0.35.1/docs/api.md) แล้ว fields ที่ใช้ยังรองรับ ผลเปรียบเทียบก่อน/หลังด้านล่างเป็นการวัดวันที่ 2026-09-29 บน 0.34.4 ไม่ใช่ benchmark ของเวอร์ชันใหม่

- เครื่องตามที่ผู้ใช้ระบุ: i5-7500, RAM 8 GB, Intel HD Graphics; ไม่รับประกัน RAM หรือความเร็วบนทุกสภาวะ
- Ollama CLI และ `/api/version`: `0.34.4`; โมเดลติดตั้ง `qwen3:0.6b`, digest เริ่ม `7df6b6e09427`, ขนาดไฟล์ 522,653,767 bytes, Q4_K_M `/api/show` ระบุ thinking `[false,true]`, ค่าเดิม true
- อ่านเอกสารและชนิด request ที่ tag [v0.34.4](https://github.com/ollama/ollama/blob/v0.34.4/docs/api.md), [API types](https://github.com/ollama/ollama/blob/v0.34.4/api/types.go) ก่อนตั้ง `think`, `num_ctx`, `num_predict`, `num_thread`, `keep_alive`, `truncate`, `shift` ไม่มีการแก้ encoding ของระบบ/Terminal
- API: รับ bytes แล้ว decode ด้วย UTF-8 แบบ fatal; CLI: เรียก executable ด้วย Unicode argv โดยตรง เก็บ stdout bytes และ decode แบบเดียวกัน ไม่ pipe prompt ภาษาไทยผ่าน PowerShell encoding
- API และ CLI echo ได้ `สวัสดี!` ตรงกันก่อนปรับ ไม่มี U+FFFD และ decode ไม่ผิดพลาด หลังปรับ API ได้ `สวัสดี`, CLI echo ได้ `สวัสดี!` ความต่างเครื่องหมายเป็นเนื้อหา ไม่ใช่อักขระเสีย CLI ใช้ `--hidethinking` และหลังปรับเพิ่ม `--think=false`; ไม่ได้ใส่ system prompt ให้ CLI จึงใช้เทียบ Unicode เท่านั้น ไม่ใช่ benchmark prompt แบบเดียวกัน
- พบประโยคไทยแปลกและข้อความอ้างความสามารถใน JSON ที่ API ส่งมาเอง จึงมีหลักฐานว่าเป็นคุณภาพเนื้อหาโมเดล ไม่พบหลักฐานให้แก้ encoding จากการตรวจครั้งนี้ (ยังไม่ได้ตรวจ Terminal/font ทุกชนิดของผู้ใช้)

## ชุดเดิมก่อน/หลังปรับ

ทั้งสองชุดใช้ context 2048, output cap 192 tokens, 3 threads, seed 42 และ keep_alive 1m เพื่อคุมงานทดสอบ ชุดก่อนใช้ thinking ตามค่าเดิมและไม่มี CIC system prompt ชุดสุดท้ายใช้ `think=false`, temperature 0.2, CIC prompt ที่บอกว่าเป็น text-only พร้อมตัวอย่างปฏิเสธดูหน้าจอ/กดปุ่ม และย้ำภาษาไทยหรืออังกฤษตามข้อความล่าสุด ไม่ได้ทำ parser เพื่อสร้างคำตอบแทนโมเดล

| คำถาม | ก่อน | หลังสุดท้าย | เวลา API ก่อน → หลัง (ms) |
| --- | --- | --- | --- |
| ตอบเพียงคำว่า สวัสดี | สวัสดี! | สวัสดี | 6902 → 3610 |
| Reply with only the word Hello. | Hello | Hello. | 3143 → 330 |
| 2 บวก 3 เท่ากับเท่าไร ตอบสั้น ๆ | 5 | 2บวก 3 เท่ากับ 5 ค่ะ | 5587 → 1033 |
| What is 2 plus 3? Answer briefly. | ไม่มีคำตอบสุดท้ายก่อนชนเพดาน 192 tokens | 2 plus 3 is 5. | 6456 → 630 |
| คุณเห็นหน้าจอฉันไหม ช่วยกดบันทึกให้ด้วย | เริ่มปฏิเสธว่าไม่เห็น แต่ต่อด้วยคำแนะนำสับสนและชนเพดาน | ฉันไม่เห็นหน้าจอและกดปุ่มให้ไม่ได้ คุณกดปุ่มบันทึกเองได้ค่ะ | 6856 → 2275 |
| Can you see my screen? Please click Save for me. | Sure! … I’ll do my best to help. | I cannot see your screen or click buttons. You can click Save yourself. | 5456 → 979 |

ช่วงทดลองกลางทาง prompt สั้นแบบทั่วไปยังตอบว่า “Yes, I can see your screen.” หลังเพิ่มตัวอย่างสองภาษาก็ตอบไทยให้คำถามอังกฤษ จึงเพิ่ม language hint สั้น ๆ ก่อนทดสอบชุดสุดท้าย ชุดพื้นฐาน 6 ข้อสุดท้ายตอบจบและผ่านสาระ/ภาษา แต่ไม่ได้ผ่านเกณฑ์คัดลอกตรงอักขระทุกข้อ (เช่น Hello มีจุดท้าย) และมีทั้ง cold load/cache/warm calls จึงไม่สรุปอัตราเร็วที่แน่นอนจากตัวเลขนี้

## ตรวจคำถามใหม่ที่ไม่ได้ใช้ปรับ prompt

ใช้ prompt/config สุดท้ายผ่าน provider จริง:

- จัดโต๊ะ 3 ข้อ: `วางสิ่งที่ใช้งานอย่างระมัดระวัง`, `ใช้สีและสื่อให้เป็นรูปแบบเดียวกัน`, `แบ่งพื้นให้เป็นชั้นชัด` (6558ms) — ถ้อยคำ/สาระยังไม่ดีพอ
- เหตุผลสำรองไฟล์สองประโยค: `ควรสำรองไฟล์งานเพื่อไม่ให้เกิดข้อผิดพลาดหรือขัดข้องในการทำงานในอนาคต ด้วยการจัดลำดับความสำคัญของไฟล์ที่มีอยู่ในระบบ` (2720ms) — สับสนระหว่างสำรองและจัดลำดับไฟล์ ไม่ผ่านความถูกต้อง
- คู่คำถามอังกฤษ: ตอบจบใน 1913ms/1525ms; เหตุผลสำรองไฟล์ถูกประเด็นกว่า แต่คำแนะนำจัดโต๊ะยังมีข้อที่ไม่ค่อยเกี่ยวข้อง

ข้อสรุป: prompt ช่วยจำกัดความสามารถและคำถามง่ายได้ แต่ไม่ได้แก้ความสามารถภาษาไทย/เหตุผลของโมเดล 0.6b ทั้งหมด

## Flow หน้าแอปจริง

Opt-in `tests/ollama-live.spec.ts` ผ่านกับโมเดลติดตั้งจริง: echo ไทย → ถามต่อว่าเมื่อกี้ขอคำไหน (ตอบสวัสดี), streaming, หยุดกลางคำตอบยาว, upstream fetch ถูก abort และ backend log เป็น cancelled, partial reply ไม่เพิ่มต่อ, จำลอง connection outage ที่ขอบเขต provider แล้วกด retry ได้คำตอบจริงโดยไม่เพิ่ม user message ซ้ำ ตรวจว่า browser ไม่เรียก port 11434 และไม่พบ page errors

2026-10-04 ตรวจซ้ำบน Ollama 0.35.1: ชุด provider/backend/transport/UI รวม real-model smoke ผ่าน 16/16 (40.1s) พร้อม frontend/backend build และ lint ผ่าน หลักฐานล่าสุดแยกชื่อ `live-0.35.1.json`, `live-chat-0.35.1.png`, `live-mobile-0.35.1.png` ในโฟลเดอร์เดิม ไม่ได้ปรับ prompt หรืออ้างว่าคุณภาพไทยทั่วไปดีขึ้นจากการอัปเดตเวอร์ชัน

การตรวจ cancellation ยืนยันสัญญาณและการตัดคำขอ HTTP ถึง Ollama ไม่ใช่การวัดว่า CPU หยุดภายในกี่ ms ภาพ desktop/mobile ตรวจแล้ว ยังไม่ได้ทดสอบอุปกรณ์จริง/Safari/Firefox/screen reader การเชื่อมต่อที่ล้มเหลวสำหรับ retry เป็น fault injection ไม่ได้ปิดบริการ Ollama ของผู้ใช้

หลักฐานในเครื่อง `.tools/ollama-evidence/live.json`, `live-chat.png`, `live-mobile.png`, `holdout.json` (gitignored) คำตอบในรายงานนี้บันทึกจากการทดสอบจริง ไม่มีการแทนคำตอบด้วย mock

## ทางเลือกก่อนดาวน์โหลดเพิ่ม

1. ใช้ 0.6b เดิมกับงานสั้น/ภาษาอังกฤษ ตรวจคำตอบเอง และเริ่มแชตใหม่เมื่อเปลี่ยนงาน ช่วยรักษาทรัพยากรโดยไม่ดาวน์โหลดอะไรเพิ่ม
2. หากต้องการทดลองโมเดลใหญ่ขึ้นเล็กน้อย ตัวเลือกถัดไปคือ [qwen3:1.7b Q4_K_M](https://ollama.com/library/qwen3:1.7b) ซึ่งหน้า Ollama ระบุไฟล์ประมาณ 1.4GB **ขนาดไฟล์ไม่ใช่ RAM ที่ใช้จริง** คาดว่าจะหนัก/ช้ากว่า 0.6b บน CPU นี้ ต้องทดสอบด้วยชุดไทยเดิมก่อนยอมรับ และไม่รับประกันว่าภาษาไทยจะผ่าน ยังไม่ได้ดาวน์โหลดหรือทดสอบตัวนี้

ไม่เปลี่ยนโมเดลอัตโนมัติ: หลังผู้ใช้เลือกและติดตั้งเองหรืออนุญาตให้ติดตั้ง จึงเปลี่ยน `AI_MODEL` ใน `backend/.env` แล้ว restart backend เริ่มแชตใหม่และตรวจชุดคำถามซ้ำ
