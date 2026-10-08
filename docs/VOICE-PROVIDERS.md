# เสียงไทย — comparison ก่อนเลือกติดตั้ง (8 ตุลาคม 2026)

ยังไม่ได้ดาวน์โหลด model/runtime เปิดไมค์ เล่นเสียง หรือสร้าง ASR/TTS executor ให้ CIC shared/voice.ts เป็น contracts เท่านั้น ไม่ใช่ proof of speech capability เครื่องเดิมพบเสียง registryอังกฤษจากรายงานก่อน ยังต้องตรวจ Thai browser/devicevoicesจริงก่อนถือว่ามี TTSภาษาไทย

## ASR: multilingual CPU candidates

แนะนำทดลอง tiny ก่อนเพราะRAM8GBมีfreeต่ำและต้องเก็บheadroom แต่ไม่รับรองภาษาไทยก่อน30held-outเสียงคนจริง Baseเป็นทางเลือกเมื่อ tinyไม่ผ่านและมีbudgetจริง ไม่เลือก `.en` ไม่โหลดพร้อมqwen/PowerPoint/TTS

| ทางเลือก | ไฟล์น้ำหนัก exactbytes | CPUruntime exactbytes | รวมdownload | ทรัพยากร/ข้อจำกัด |
|---|---:|---:|---:|---|
| Tiny multilingual | 77,691,713 | 8,928,640 | 86,620,353 bytes | upstreammemoryประมาณ273MB เฉพาะmodel ไม่รวมทั้งpipeline; ไทย/noise/mixedต้องวัด |
| Base multilingual | 147,951,465 | 8,928,640 | 156,880,105 bytes | upstreamประมาณ388MB เฉพาะmodel ไม่รับรองคุณภาพ/เวลาเครื่องนี้ |
| พักเสียง ใช้ข้อความ+toolsก่อน | 0 | 0 | 0 | ไม่มีAPIหรือเสียงออกนอกเครื่อง; ไม่ตอบโจทย์เสียงสองทางจนเลือกใหม่ |

Engine candidate: official whisper.cpp build `b5454`, `whisper-bin-x64.zip` URL https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip; SHA2566ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb. Latesttagv1.9.5ไม่มีreleaseassetsตอนตรวจ จึงตรึงexistingCPUasset b5454 ไม่สรุปว่าartifactเป็นv1.9.5 ต้องตรวจexe/DLL/CPUISA/runtimeหลังดาวน์โหลดที่อนุญาต ไม่ใช้CUDA/OpenCLbinaryกับIntelHD630เพราะชื่อGPUอย่างเดียว

Weights pinned revision `5359861c739e955e79d9a303bcbc70fb988958b1`:
- tiny https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.bin SHA256be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21
- base https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin SHA25660ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe

Upstreamcode/modelเป็นMITตามเอกสาร ต้องเก็บlicense/noticeและตรวจthird-partyDLLในarchive แผนติดตั้งเฉพาะfolderignored.tools/voice/<pinned-version> ไม่แก้PATHระบบ/บริการผู้ใช้ Uninstall/rollbackถอดconfigแล้วหยุดownedworkersก่อนจัดการเฉพาะfolderที่ตรวจabsoluteboundary; ไม่ลบไฟล์/โมเดลเดิม ไม่downloaddependencyเพิ่มหากเกินartifactที่อนุญาต

Sources/metadata: [upstreammemory/CPU](https://github.com/ggml-org/whisper.cpp), [pinnedCPUrelease](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454), [modelmetadata](https://huggingface.co/api/models/ggerganov/whisper.cpp?blobs=true). Metadata/rawSHAอยู่localignoredไม่ใช่modelbinary Engine/modelยังไม่มีRAM/latency/Thaiaccuracyวัดในเครื่องนี้

## TTS: separate choice/license gate

| Candidate | bytesที่ตรวจได้ | Rights/dependencies | สถานะ |
|---|---:|---|---|
| InstalledThai localvoice | ยังไม่พบที่ตรวจregistryเดิม | ต้องตรวจbrowser/OSlanguage/deviceจริง ไม่ถือspeechSynthesisAPIเป็นเสียงไทย | NOT-RUN humanThai |
| Piper th_TH-tsync2-medium | weights63,221,984+config5,255 =63,227,239bytes; ไม่รวมruntime | modelcarddatasetCCBY-NC-SA3.0 non-commercial/Piper≥1.8; OHFengineGPL3.0, ไม่ใช้ป้ายMITรวมกลบmodelcard | candidateส่วนตัว; ไม่พร้อมcommercialredistribution; exactWindowsruntime/depsbundleยังต้องตรึง |
| PyThaiTTS ONNX | ยังไม่ตรึงmodel/runtimeให้ตรงWindowsbundle | library/provider/modelrightsและONNXdepsต้องตรวจแยก | สำรอง ยังไม่ให้installapprovalจากขนาดที่ไม่รู้ |

Piperpinnedrevisionc10ece1aade47bb51c153c893d14e5bf8e5b7117 weightsSHA256136669378ee72dd27012604994099ca3c833e625c7cfdff05ccdf468a1a2115f. Modelcard [Thai rights](https://huggingface.co/rhasspy/piper-voices/blob/main/th/th_TH/tsync2/medium/MODEL_CARD), [OHFengine](https://github.com/OHF-Voice/piper1-gpl), [PyThaiTTS](https://github.com/PyThaiNLP/PyThaiTTS). TTSdownloadtotal/RAM/audio-qualityยังUNKNOWNจนengine/depsตรงPython/CPUและฟังจริง20ประโยค ไม่ใช้config5KBรับรองเสียง

OnlineAzureThaiเป็นopt-inแยก ต้องแจ้งเสียง/ข้อความที่ส่งปลายทาง ราคา/retention/networkก่อนเลือก ไม่มีpaidAPIหรือcloudfallbackเปิดไว้ในรอบนี้ ไม่เสนอว่าWebSpeechdefaultทำงานlocal

## P2 ที่ต้องทำหลังเลือก

Push-to-talk clip≤15s/bytes≤2M indicator/stop/discard/edittranscriptbefore-send, half-duplexหยุดTTSก่อนเปิดmic ไม่alwayslistening/asynchronousactions. ลำดับvoicejobsผ่านCoregrant/resources/stop ไม่ bypassจากUI ไม่autoexecuteคำเสี่ยง/negation/ambiguousslots Streamsentenceepoch/sequenceกันอ่านซ้ำหลังretry/leave/newtask Stopเป้าหมาย≤500msต้องวัดจริง30trials

Freeze30humanThai/mixed/number/name/negation/noise/silencecases แยกdev/regression/unseen/≥3speakersเมื่อจัดได้; quiet27/30intent+slots, silence/noise nofalseexecution, ASR≤5sclip p95หลังหยุดพูด≤8sเป้าหมาย ไม่ผ่านเรียกdelayed TTS20sentences≥18understood+criticalnumberscorrect p95firstaudiowarm≤3sเป้าหมาย ต้องฟังบนdeviceจริงยังไม่ผ่านจากไฟล์waveform เอาreference/audioที่CICเล่นเองเป็นข้อมูลไม่ใช่grant
