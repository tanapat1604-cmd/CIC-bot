# OCR explicit languages/regions — verified 2026-10-08

Continued clean ac26215. This is tool preprocessing/evaluation, not qwen training. Existing Tesseract fast tha/eng only; no downloads, paid calls or image/audio uploads. Corpus was created/frozen on 2026-10-07; resumed verification on 2026-10-08.

## Method

24 synthetic images: 12 development and 12 new-2; manifest/image hashes frozen before any read. Compared baseline tha+eng PSM3 full image against predetermined candidate: user-selected language, user-selected crop regions, 2x Lanczos/grayscale, PSM6, OMP1. Columns read in explicitly selected region order, mixed separate-language lines use separate manually supplied regions. This is **not automatic language/layout detection**. Expected text used only for scoring, never OCR/preprocessing. Pipeline unchanged after observing development or new results; this round did not optimize a policy on development.

48 image/pipeline results; per-region reads recorded in results.json. Historical 32-image trial preserved separately and not re-scored as new. No new production source or OCR UI/endpoint.

## Results

Gate categories: Thai/mixed <=5% whitespace-stripped NFC CER, English <=2%, important numeric tokens exact, enough output lines; columns/numbers/blank exact. Blur reported separately as stress/unsupported, not counted as passing quality coverage.

| Split | Baseline | Candidate |
|---|---:|---:|
| Development non-blur | 8/11 | 9/11 |
| New-2 non-blur | 8/11 | 11/11 |

New inline mixed CER4.84% ->0; Thai12px50%->2.50%; English small2.44%->0; columns44% wrong order ->0 with manual region order. New numbers/date/time exact. New blur exact for both in this particular image; earlier blur omissions remain evidence, no general blur acceptance.

New small Thai still says ตรวจรายการค่อนบันทึก instead of ตรวจรายการก่อนบันทึก. New instruction text has decomposed sara-am คําสั่ง rather than คำสั่ง; raw NFC scoring retains CER2.86%. Exact-line lookup reports missing-text for these spelling differences; that diagnostic does not establish a whole missing line. Candidate development small Thai6.67% and instruction5.17% fail. No general accuracy or unattended-control acceptance.

Candidate new median wall250.7ms/image (manual multi-region costs included), observed158.3–525.7ms; sampled Tesseract working-set peak19.9–36.9MiB. Python/browser/image-preprocessing memory not included in reader RAM; sample interval25ms, true instantaneous peak may be missed. Startup/cache effects uncontrolled. Original24images/hash verified unchanged. Mapped boxes all inside960x420 source; bounds check is not glyph-IoU or click-target proof.

Inspected new small/mixed/columns/blur images and every failed candidate raw comparison. Local report with expected/actual for every case: C:/Users/This PC/.codex/.chatgpt-projects/g-p-6ab9187262b881919cc7a1cf9af4966b/output/2026-10-07-ocr-next/report.html. Manual-review OCR pilot may be considered next; automatic screen actions must not treat this score as safety approval. Need broader real-layout regression, image decoding/limits/lifecycle/provenance tests before app integration.

## Voice investigation

User selected speech input + spoken output both directions. Registry inventory: Windows OneCore voices David/Mark/Zira language409 (en-US); recognizer409;9 (English). No Thai token found in these inspected registries. Native WinRT AllVoices returned Internal Speech Error; headless Chromium Speech API capability probe crashed target. These diagnostics do not prove every installed browser lacks Thai. No microphone opened, recognizer started, audio played, pack installed or external recognition used. Online Web Speech must not be assumed local: processLocally defaults false; explicit local availability/language validation required.

A question card requests authorization for an offline Whisper base multilingual trial (~142MiB model plus separately verified Windows runtime); still pending at this checkpoint. TTS Thai not selected/installed; benchmark transcription latency/RAM/Thai errors before integration. Do not claim bidirectional speech ready.

## Services/source status

After date change frontend/backend were absent; started only missing CIC services with hidden windows. Local health ready qwen0.6b; Stockfish19ready idle; slidesA/Bconfigured. Ollama already listening and was not restarted. No model/engine/prompt/frontend/backend code changes; no new deployment or new build/regression run claimed. Documentation/probes verified, git diff check required before checkpoint.

## Sources

- [Tesseract preprocessing/PSM](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)
- [Web Speech local processing](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally)
- [Windows recognizer language inventory](https://learn.microsoft.com/en-us/windows/apps/develop/input/specify-the-speech-recognizer-language)
- [whisper.cpp model/platform guidance](https://github.com/ggml-org/whisper.cpp)

See SCREEN-VOICE-ROADMAP.md for new user target, two-way voice, bounded screen stages and Neal game benchmark.
