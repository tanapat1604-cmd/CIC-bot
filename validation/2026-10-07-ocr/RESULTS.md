# ผล OCR ในเครื่อง — 7 ตุลาคม 2569

## ผลตัดสินและขอบเขต

เริ่มจาก clean ec4844a (origin/main ตรงกัน) และตรวจโค้ดสไลด์ 8f75bcb/รายงานล่าสุดจริง บริการ 127.0.0.1:5173/8787/11434 พร้อม แชตใช้ qwen3:0.6b, 1.7b ยังติดตั้ง, Stockfish 19 idle, สไลด์ professional/jarvis configured. RAM เครื่อง 8,076 MiB ว่างเริ่ม 626 MiB ก่อนทดลอง native; ก่อนติดตั้ง/ทดลอง Tesseract ว่าง ~1,552 MiB ไม่ปิดโปรแกรมอื่น

**ยังไม่เปิด OCR ใน CIC:** ภาษาไทยชัดของ Tesseract fast ใช้ได้ในภาพตัวอย่าง แต่ภาษาผสม/ตัวเล็ก/เบลอ/ลำดับคอลัมน์ยังผิดและไม่ผ่านเกณฑ์ที่ตรึงไว้ จึงส่งผลทดลองและแผนตามเงื่อนไขผู้ใช้ ไม่สร้าง UI บนผลที่ยังไม่ผ่าน ไม่มี screen capture API, click, keyboard injection หรือ general control เพิ่มในแอป

- **CIC ทำได้จริงเดิม:** แชต text, calculator/time, หมากรุกด้วย Stockfish, สไลด์ A/B จาก outline ที่ผู้ใช้ตรวจ
- **ต้นแบบผู้พัฒนา:** อ่านภาพ fixture ที่เลือกไว้ด้วย Windows.Media.Ocr และ Tesseract CLI, แสดงผลดิบ/กรอบในรายงาน HTML, ตรวจ geometry. ไม่ใช่ภาพที่ CIC อ่านเอง ไม่ใช้ผลนี้รับรอง qwen
- **ยังเป็นแผน:** ผู้ใช้เลือกไฟล์ใน CIC, preview/OCR/cancel/edit/copy/explicit send-to-chat และ window sharing แบบอ่านอย่างเดียว

## เครื่องมือที่ตรวจจริงและการติดตั้งที่ได้รับอนุญาต

ก่อนเริ่มพบ Windows.Media.Ocr เฉพาะ en-US; AvailableRecognizerLanguages และ IsLanguageSupported(th-TH)=false, MaxImageDimension=10000. ไม่พบ Tesseract ใน PATH/Program Files/.tools, หรือ pytesseract/tesserocr/EasyOCR/PaddleOCR/Torch/ONNX Runtime ใน Python runtime ที่ใช้ ไม่อ้างว่า scan ทั้งดิสก์หรือทุก Python environment. ใช้ Windows component ตามสิทธิ์เครื่องนี้ ไม่แจก binary/language pack ของ Windows

Ollama /api/show ของ qwen3:0.6b รายงาน completion/tools/thinking ไม่มี vision. ภาพไม่ผ่านโมเดลภาษา OCR ทุกผลติด source engine และ language ชัด ไม่มี prompt/model/weight/training changes

ผู้ใช้เลือก A ผ่านการ์ด อนุญาต Tesseract 5.5.3 + tessdata_fast ไทย/อังกฤษแล้ว จึงติดตั้งแยก `.tools/ocr-tesseract-5.5.3` (ignored), ไม่ทับของเดิมหรือแก้ PATH ของ CIC. Installer 26,573,224 bytes + tha 1,072,600 + eng 4,113,088 = 31,758,912 bytes (~30.29 MiB); พื้นที่ติดตั้งจริง 117,449,559 bytes (~112 MiB). osd ที่มากับ installer ไม่ใช้ในงานนี้ ไม่ดาวน์โหลด LLM, best, paid API หรือส่งภาพออก

Installer SHA256 bee9e3434bd94fd65387d9be28cd467a41f61b1275383b55b0f59a1331270ae4 ตรง digest ของ official release. **Authenticode ไม่ผ่าน:** certificate Universität Mannheim หมดอายุ; error retained. ยอมรับเฉพาะ pinned release hash และ exact known signer/expiry cause; ไม่เปลี่ยน machine policy/verification settings. Metadata ใน installer-verification.json. ภาษา verify Git blob และ SHA256: tha 294227cc2d1292b0acb28d61d4115c88252b96d466ca90b417cf4cf0c67bf07c, eng 7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2

Tesseract engine และ official traineddata ใช้ Apache-2.0; ตรวจ LICENSE ใน doc ของตัวติดตั้งและแหล่งทางการ DLL dependencies มีสิทธิ์ของตนเอง (เช่น Leptonica BSD), ไม่สรุปว่าทั้ง installer เป็น Apache ทั้งหมด ไม่ redistribute binaries ใน Git/ZIP นี้ ต้องเก็บ third-party notices หากแจก runtime ภายหลัง

แหล่งตรวจ (metadata/documentation เท่านั้น ไม่มีภาพผู้ใช้ใน request): [API Windows](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine), [official release](https://github.com/tesseract-ocr/tesseract/releases/tag/5.5.3), [data/speed tradeoffs](https://tesseract-ocr.github.io/tessdoc/Data-Files.html), [fast Thai](https://github.com/tesseract-ocr/tessdata_fast/blob/main/tha.traineddata), [fast English](https://github.com/tesseract-ocr/tessdata_fast/blob/main/eng.traineddata), [engine license](https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE), [data license](https://github.com/tesseract-ocr/tessdata_fast/blob/main/LICENSE), [Windows build maintainer](https://github.com/UB-Mannheim/tesseract/wiki)

## ชุดภาพ วิธีวัด และการตรึง

16 development + 16 new ก่อน OCR ใด ๆ (manifest SHA256 c944a7bd676fd01f255d5b5b2cf7c0e59e900929115cd2f47904c558eb115978). เก็บ expected text, DOM text ranges, image SHA256, sizes, crop และ scales. ภาพใหม่ใช้ข้อความต่างจาก development. ภาษาไทย render ผ่าน Chromium/Leelawadee UI ที่ shaping จริง เพราะ Pillow runtime ไม่มี raqm. ภาพหน้าจอเป็นหน้า fixture browser ไม่มีข้อมูลส่วนตัว ไม่จับ desktop/แอปผู้ใช้

32 ภาพต่อ engine = 64 reads, ไม่นับ smoke development อังกฤษ/ไทยเป็นคะแนนใหม่. Native fixed en-US. Tesseract fixed tha+eng, OEM1, PSM3, OMP_THREAD_LIMIT=1; candidate config/source hash ตรึงก่อนเรียก Tesseract ครั้งแรก. Windows ใช้ new set เป็น baseline ก่อน Tesseract จึงเป็นชุดเปรียบเทียบที่เปิดแล้วกับ engine เดิม ไม่ใช่ secret holdout ระดับ benchmark. ไม่มีปรับจากผล new ของ Tesseractและไม่มี retune หลัง new; รอบปรับถัดไปต้องสร้าง new-2 ใหม่และรายงานคะแนนเดิมเป็น frozen baseline เท่านั้น

ทั้งสองชุดครอบคลุม English/Thai/mixed/numbers+date/time, multiline, light/dark, 12px small, 50% reduced, Gaussian blur radius2, blank, two columns และ crop. 900x440 clear, 450x220 reduced, 740x210 crop. ไม่รองรับ handwriting, perspective, camera photos, rotated/exif/animated images หรือหลายฟอนต์ในหลักฐานนี้

CER = Levenshtein หลัง NFC และลบ whitespace เท่านั้น (ไม่ลบ punctuation/case/digits). แสดง substitutions/deletions/insertions และ Thai-script CER แยก ไม่มีคะแนนรวมกลบภาษาไทย. CER คอลัมน์รวม reading-order errors ด้วย; ไม่ตีความเป็นตัวอักษรสะกดผิดทั้งหมด. raw preserves all line text/word rectangles/native data. missingExactLines เป็นบรรทัดไม่ตรงข้อความทั้งหมด ไม่ใช่พิสูจน์ว่าบรรทัดหายทุกกรณี

เกณฑ์ก่อนทดลองใน FREEZE.json: clear Thai/mixed แต่ละ new image <=5% normalized CER และไม่มีบรรทัดไทยตกหล่น; English/numbers <=2%; blank zero words; column order correct; frames contain visible text. **ไม่ผ่าน** new mixed11.76%, small Thai full6.25%/Thai-script2.33% (มีปัญหา colon และตัวแทรก), English small2.08%, columns wrong. ไม่ลดเกณฑ์ย้อนหลังเพื่อประกาศว่าผ่าน

Windows ไม่มี confidence field จึงไม่แสดงคะแนนความมั่นใจ Tesseract TSV มี word score จริง เก็บใน raw เป็น nativeWordScore แต่รายงานไม่ใช้เป็นโอกาสที่ข้อความถูกหรือเกณฑ์ผ่าน ค่า CER/geometry เป็นค่าทดสอบเทียบต้นฉบับ ไม่ใช่ confidence

## ผลรายชนิดภาพ

CER เป็น %; S/D/I เป็นจำนวน substitutions/deletions/insertions. เวลา wall รวม process startup/decode/OCR/output/poll50ms, ไม่ใช่ latency ใน CIC. Native มี recognitionMs และ decodeAndRecognitionMs แยกใน JSON. RAM sampled เป็น process working set รวม host ไม่ใช่ RAM ทั้งเครื่องหรือค่ารับประกัน peak; sampled private และ system free before/min/after อยู่ใน results

| ภาพ | Windows CER | fast CER | fast Thai CER | S/D/I | wall ms | process MiB | order |
|---|---:|---:|---:|---:|---:|---:|---|
| development-en-light | 0.0 | 0.0 | — | 0/0/0 | 266.9 | 34.6 | correct |
| development-th-light | 100.0 | 0.0 | 0.0 | 0/0/0 | 321.3 | 34.8 | correct |
| development-mixed | 52.46 | 6.56 | 12.5 | 2/2/0 | 430.5 | 36.6 | cannot-assess-missing-text |
| development-numbers | 7.5 | 0.0 | — | 0/0/0 | 261.4 | 34.6 | correct |
| development-en-multiline | 0.0 | 0.0 | — | 0/0/0 | 314.9 | 34.5 | correct |
| development-th-multiline | 100.0 | 0.0 | 0.0 | 0/0/0 | 363.7 | 35.9 | correct |
| development-en-dark | 0.0 | 0.0 | — | 0/0/0 | 364.1 | 35.4 | correct |
| development-th-dark | 100.0 | 0.0 | 0.0 | 0/0/0 | 313.7 | 34.2 | correct |
| development-en-small | 0.0 | 2.13 | — | 1/0/0 | 267.2 | 34.2 | cannot-assess-missing-text |
| development-th-small | 100.0 | 1.96 | 1.96 | 1/0/0 | 327.0 | 32.2 | cannot-assess-missing-text |
| development-reduced | 52.04 | 3.06 | 0.0 | 1/2/0 | 262.4 | 31.4 | cannot-assess-missing-text |
| development-blur | 76.53 | 52.04 | 100.0 | 0/51/0 | 261.2 | 34.7 | cannot-assess-missing-text |
| development-blank | — | — | — | 0/0/0 | 209.6 | 27.8 | no-text |
| development-columns | 0.0 | 39.13 | — | 12/3/3 | 312.5 | 34.7 | wrong |
| development-crop | 0.0 | 0.0 | — | 0/0/0 | 311.4 | 33.4 | correct |
| development-screenshot | 37.1 | 0.0 | 0.0 | 0/0/0 | 312.7 | 36.4 | correct |
| new-en-light | 0.0 | 0.0 | — | 0/0/0 | 261.2 | 34.8 | correct |
| new-th-light | 89.58 | 0.0 | 0.0 | 0/0/0 | 314.5 | 35.6 | correct |
| new-mixed | 50.0 | 11.76 | 11.76 | 5/2/1 | 365.7 | 37.2 | cannot-assess-missing-text |
| new-numbers | 7.14 | 0.0 | — | 0/0/0 | 371.3 | 36.5 | correct |
| new-en-multiline | 0.0 | 0.0 | — | 0/0/0 | 316.7 | 36.3 | correct |
| new-th-multiline | 93.06 | 0.0 | 0.0 | 0/0/0 | 366.3 | 34.5 | correct |
| new-en-dark | 0.0 | 0.0 | — | 0/0/0 | 366.9 | 35.2 | correct |
| new-th-dark | 89.58 | 0.0 | 0.0 | 0/0/0 | 312.2 | 35.5 | correct |
| new-en-small | 0.0 | 2.08 | — | 1/0/0 | 316.2 | 35.3 | cannot-assess-missing-text |
| new-th-small | 91.67 | 6.25 | 2.33 | 0/1/2 | 311.7 | 33.6 | cannot-assess-missing-text |
| new-reduced | 44.79 | 3.12 | 4.65 | 2/0/1 | 311.7 | 32.1 | cannot-assess-missing-text |
| new-blur | 62.5 | 23.96 | 53.49 | 0/23/0 | 312.1 | 36.9 | cannot-assess-missing-text |
| new-blank | — | — | — | 0/0/0 | 263.6 | 32.2 | no-text |
| new-columns | 0.0 | 38.1 | — | 14/1/1 | 311.9 | 34.8 | wrong |
| new-crop | 0.0 | 0.0 | — | 0/0/0 | 261.6 | 31.9 | correct |
| new-screenshot | 33.33 | 0.0 | 0.0 | 0/0/0 | 312.3 | 36.3 | correct |

Tesseract wall 209.6–430.5 ms, sampled working set 27.8–37.2 MiB; system free minimum during its reads 1,351.7 MiB. Windows wall732.4–927.0 ms, working set96.3–99.2 MiB. Small synthetic images only; real high-resolution pictures may cost more. Performance no model/browser concurrency guarantees

### ใช้ได้ในขอบเขตทดลอง

ไทยชัด light/dark/multiline ของ fast: normalized CER0 ทั้ง development/new; อังกฤษชัด/multiline/dark, numbers/date/time ของ fast CER0; blank ทั้งสอง engines ไม่มี false words ในสองภาพ; crop English CER0. Browser fixture ผสมของ fast CER0 ทั้งสองภาพ แต่อีก layout ของ mixed ไม่ผ่าน จึงไม่เหมารวมว่าผสมรองรับแล้ว

### ยังผิด

- Native Thai development light/dark/multiline/small CER100 และ new Thai-script เป็น100 ในภาพเหล่านี้ แม้บางภาพได้เวลา09:45 อังกฤษเครื่องมือเดิมดี แต่ new numbers ทำรายการ40% หาย, development25% หาย
- fast new mixed ต้นฉบับ `ตรวจงาน CIC Bot รุ่น 2` → `ตรวจงาน (1|6 Bot tu 2`; Thai-script deletions4/34. ไม่มีเติมคำจากโมเดลให้ดูเหมือนถูก
- new small Thai แทรกเครื่องหมาย/ตัวอักษรและ09:45→0945; full CER6.25. new reduced full3.12/Thai4.65 มีอักษรแทรกและสระผิด. new blurred บรรทัด `กรุณาตรวจข้อความก่อนส่ง` หาย, Thai deletions23/43 (53.49%), full23.96. Development blur Thai หายทั้งหมด
- fast columns รักษา words หลักแต่เรียง LEFT1→RIGHT1→LEFT2→RIGHT2; expected column-major LEFT1→LEFT2→RIGHT1→RIGHT2, new full CER38.10. Native columns correct ในสองภาพนี้ ไม่ใช่การรับรองหลายคอลัมน์ทั่วไป
- English12px final period→comma ในทั้ง dev/new. คืนข้อความดิบให้ตรวจ ไม่เดาจากคำตอบต้นฉบับหรือถือ blank ว่าไม่มีข้อความแน่นอน

## กรอบและพิกัด

ตรวจ contact sheets8 ภาพรวมครบ32ภาพทั้งสอง engineด้วยตา กรอบที่พบอยู่ตรง glyphs ส่วนใหญ่; Thai segmentation แยกย่อยและบางกรอบซ้อน ไม่รับรองว่าบรรทัดที่ไม่มีกรอบไม่มีข้อความ. ไม่พบ boxes ออกนอกภาพ ทุก center ของ fast อยู่ใน DOM reference line region; เป็น sanity check เท่านั้น ไม่ใช่ IoU/glyph detection perfect score

Map OCR image→original: xOriginal=xOcr/scaleX+cropLeft, yOriginal=yOcr/scaleY+cropTop; width/height divide scale. Crop(40,40,740,210), reduce0.5. Integer/crop transform roundtrip error0 ใน geometry.json. มี diagnostic ink coverage ภายใน DOM line ROI+one-pixel box margin; เป็น geometric coverage ไม่ใช่ confidence/recognition accuracy. Blurเปลี่ยน pixelsและ text omissions ลดcoverage

หน้า SVG QA แยกจาก CIC: actual crop/reduced overlay desktop1440x900, mobile390x844, short360x480 ไม่ล้นแนวนอน, screen-coordinate/rect check drift<=0.000031 CSS pixels, page errors0, ตรวจภาพจริงทั้งสาม. หลักฐานนี้ตรวจการแสดงกรอบบนภาพ ไม่ตรวจ OS coordinates, moved window, multi-monitor/native DPI, EXIF หรือ click targeting

## ยังไม่ได้ตรวจ / ไม่อ้างว่ามีใน CIC

OCR UI ยังไม่ทำ จึงยังไม่ได้ตรวจ user-upload MIME/magic bytes/size/pixel quotas, corrupt/oversize decode pipeline, request abort/cancel/timeout/fault injection, image change/route departure/stale suppression, editor/copy/send-to-chat, session ownership/retention/logging ของผู้ใช้. CLI small fixtures succeeded only ไม่ใช้ exit0 แทน UI หรือ security acceptance. ไม่มี public OCR route และไม่มีการแชร์จอ/control readiness คะแนน

ภาพทั้งหมดในรอบนี้ synthetic/test browser, ภาพ/ข้อความเก็บเป็นหลักฐานผู้พัฒนาในเครื่องจนผู้ใช้ลบ ไม่ auto-clean. Native probeเปิดไฟล์ read-only และ disposebitmap/stream; Tesseract processจบทุกภาพและเขียนผลทดลองลง folder ไม่ใช่ product temporary-storage policy. ไม่เก็บภาพ/ข้อความผู้ใช้จริง. ZIPไม่รวม engine/models/installer; Gitเฉพาะ synthetic text/metadata/documents ไม่มีภาพหรือ binariesส่งออก

## ทางเลือกถัดไปที่เป็นรูปธรรม

1. **แนะนำ: ปรับ fast เดิมโดยไม่ดาวน์โหลดเพิ่ม** แยกผู้ใช้เลือก Thai/English/mixed, ลอง upscale ใน development ที่กำหนด, ระบุ single-column/ROI และให้ตรวจข้อความก่อน copy/send. ต้องตรึง config ใหม่ ทดสอบ new-2 ใหม่รวม mixed/small/blur/columns/instruction injection ก่อนตัดสิน UI ไม่รับรองว่าปรับนี้แก้ได้ และยังไม่เริ่มปรับในรอบนี้
2. **ขออนุญาต best เฉพาะภาษาในรอบถัดไป** tha7,614,571 + eng15,400,601 bytes (~21.95 MiBเพิ่ม engineเดิม), slower CPU/อาจใช้ RAMมากกว่า ต้องวัดจริงและทดสอบใหม่ ความเป็นส่วนตัว localเหมือนเดิม ไม่มีดาวน์โหลด best ที่ไม่ได้เลือก รายละเอียด [data comparison](https://tesseract-ocr.github.io/tessdoc/Data-Files.html)
3. **ใช้ผลทดลองต่อและพัก UI** ไม่ดาวน์โหลด, อังกฤษใช้ Windowsเฉพาะข้อจำกัดที่แสดงและผู้ใช้ตรวจ; ไทย/ผสมยังไม่เปิดในCIC ไม่เรียกว่า Thai accepted

## การถดถอยและบริการ

Frontend build/backend build/lint PASS checkpointเดิม ไม่มี application source/model/prompt/runtime manifest modifications. Viteแจ้งexistinglargeScenechunk warning. Related82 cases:80PASS/2actual-engineopt-inSKIP; separate opted-in Stockfish suite12PASSรวม2actual-engine, actualqwen0.6 UI2PASS (chat/history/stop/retry/switch). ไม่ได้ rerun full landing/WebGL/motion/animation suites; existinghistoricallocalWebGLtimeoutไม่ถือว่าแก้แล้ว. Tests used mock providers in related suite; actual callsแยกดังข้างต้น

Backend temporarily stoppedเฉพาะ verified CIC process เพื่อ tests; frontend/Ollamaคงทำงาน และเปิด backendกลับ PID10644. Final slides/native checks, diff/commit/push/CI/service status appended after verification

การแจ้งสถานะ: currentchat/questioncard/report images เท่านั้น ไม่มี notification popup ใหม่. OCRคือ tool integration/evaluation ไม่ใช่ training/general intelligence; Stockfishไม่วัดqwen. ยังไม่พร้อมแชร์หน้าต่างจริงหรือควบคุมเครื่อง

### Final local verification

Actual existing CIC UI created A2 pages 10.087s and B2 pages5.925s. Both native PowerPoint opened/rendered, editable PPTX source text exact, all content-type targets present, PDF2pages each. Visually inspected all4native PNG and all4independentPDF pages plus desktop/mobile390/short360UI: PASS. These are regression artifacts from the existing slide feature, not OCR-generated slides. No page errors. Final services all loopback: frontendPID9540/5173, backendPID10644/8787, OllamaPID11580/11434; healthready/liveqwen0.6b,1.7bretained, Stockfishready/idle, slidesA/Bconfigured, noPowerPointprocess left. FreeRAM1,468MiB at finalsample. Appsource unchanged; OCRruntime not attached tobackend. Commit/push/CI result follows inWORK-PROGRESS.md.

Local artifacts: `C:/Users/This PC/Documents/ChatGPT/cic bot/ocr-round-2026-10-07/evidence/report.html` (self-contained images); `CIC-OCR-experiment-reviewed.zip` inroundroot includes allsyntheticimages/rawTSV/JSON/frozenmanifest/evaluation/source/scripts/screenshots. Developertrialonly, noengine/models/installer oruserdata in ZIP. Gitonly synthetictext/metadata/documents/nativeprobe, noimages/binaries. Manifest andTesseractfreeze unchanged afterscore/visualreview. Initial prepare Python text decoding error fixed beforefreeze/anyOCR; consoleoutputencodingerror afterevaluation corrected onlydisplay, norescoring. Installerexpiryfailure retained, nohiddenpasses.

### Model raw limitation retained

The two actual model UI tests passed transport/history isolation/stop/retry assertions only. The controlled 2+3 retry raw reply listed unrelated additions instead of giving 5; its contains(5) assertion matched a digit inside that list, so it is a weak correctness assertion. This is NOT an arithmetic/model-following pass. Raw replies preserved in ollama-live.json. No model fix/prompt tune in OCR scope; bounded calculator tests remain independently exact.

Final reviewed delivery supersedes the initial draft ZIP; corrected exact mixed raw quotation (vertical bar, not digit1) and retained the actual-model weak assertion finding. No OCR results, candidate parameters, manifest or image hashes changed.
