# CIC เสียงไทยรุ่นทดลอง

สถานะ 12 ต.ค. 2569: หน้าหลักเป็นหน้าคุยแล้ว ตั้งค่า/diagnosticแยก. จบคำพูดอัตโนมัติและฟังต่อหลังเสียงตอบเฉพาะเมื่อผู้ใช้เริ่มคุย; Stop/สิทธิ์หมดอายุ/ความผิดพลาดหยุดการฟังต่อ. Chrome/YouTubeใช้Chromeปกติของผู้ใช้แบบขอเปิด ไม่อ้างwindow/playbackจากlauncher. Software checksผ่าน แต่ผู้ใช้ทดลองวันนี้ยังพบคำผิด/ฟังไม่ชัด จึงยังไม่ผ่านรับรองระบบเสียงทั้งชุด. ดู `validation/2026-10-12-conversation/RESULTS.md` และใช้ `NEW-CHAT-PROMPT-TH.md` ล่าสุดก่อนงานส่งต่อเก่า.


สถานะล่าสุด 11 ต.ค. 2569: มีรอบไมค์จริงสั่งเปิด Notepad และ Chrome ทดลองผ่าน CiC พร้อมตรวจผลจริงแล้วบางรอบ แต่ ASR ยังมีคำผิดและยังไม่ผ่านตรวจรับทั้งระบบหรือ hands-free. คำสั่ง Chrome ใช้ Chrome ปกติของผู้ใช้แบบเปิดอย่างเดียว โดยรายงานเพียงรับคำขอ launcher ไม่อ้างตรวจหน้าต่างหรือการเล่น. ดูรายงาน `validation/2026-10-11-voice/RESULTS.md` และหลักฐานรอบจริงก่อนอ้างความสามารถ.

เลือกไมค์ตรงชื่อจาก “ดูรายชื่อไมโครโฟน” แล้วเริ่มฟังด้วยตัวเอง แถบแสดงเสียงปัจจุบันพร้อมระดับสูงสุดรอบนั้นเพื่อไม่สรุปว่าพูดเบาจากช่วงหยุดพูด ตัวรับเสียงประเมิน RMS เป็นช่วง20msที่เกณฑ์เดิม0.007 ต้องพบสัญญาณรวม250msก่อนส่ง ตัดเฉพาะความเงียบหัวท้ายพร้อมpadding200msและคงช่องว่างระหว่างคำ ไม่เพิ่มgain สรุประยะบันทึก/activity/ส่งถอดเสียงแสดงในหน้าและไม่เก็บถาวร หากสัญญาณไม่พอจะไม่ส่งASR การมีสัญญาณอาจเป็นเสียงอื่นและไม่รับรองคำพูด ต้องตรวจข้อความต่อ.

เปิด #/voice จากลิงก์เสียงไทยในหน้าเพลง เชื่อมเครื่องมือเสียง แล้วกดทดสอบเสียงไทย. ผู้ใช้ตอบรับว่าเสียงตัวอย่างใช้ทดลองได้ก่อน. ถ้าจะพูด ให้ผู้ใช้เลือกอนุญาตไมค์แล้วกดเริ่มฟังเอง พูดคำสั่ง จบคำพูดหรือรอครบ15วินาที. ระบบปิดไมค์ก่อนส่ง PCM16k monoไปbackendในเครื่อง; รับข้อความแล้วตรวจ/แก้และเลือกยืนยันข้อความก่อนส่งไปหน้าเพลง. หน้านั้นยังต้องอนุญาตขอบเขตและตรวจแผน; ไม่มีสิทธิ์เปิดโปรแกรมจากASRโดยอัตโนมัติ.

ใช้ Piper1.8.0 Thai tsync2/CPU3threads และ faster-whisper1.2.1 base/CPUint8/3threads ในvenvแยก. ไม่มีcloud fallback. workerหนึ่งคำขอต่อprocess ปล่อยจริงก่อนคืนscheduler FIFOheavy1. RAM admission1152MiB =512headroom+640reserve; peak workerที่วัดจากsyntheticcomponent TTS562.91MiB/ASR314.5MiB ไม่ใช่peakระบบทั้งpipeline. หากตรวจstopไม่ได้คงfaultเพื่อกันงานอื่น. ข้อมูลเสียง/ข้อความอยู่ในRAM bounded ไม่ลงไฟล์ผู้ใช้ตามปกติ, audioresult/nonceมีexpiry; pathของmodel/Pythonมาจากconfigที่ติดตั้ง ไม่รับจากAPI/โมเดล.

Backend authenticatedcookie+loopbackHost+Origin+exactfields+one-useoperation. ASRรับPCM<=15วินาที/480000bytes, TTSรับเฉพาะphraseIDsที่กำหนด; outputbounded/checkWAVschema. SHA256ของmodel/workerถูกตรวจทุกjob. Python workerตั้งHFoffline และปฏิเสธPython socket connect/DNSด้วยaudit hook; ไม่อ้างว่าเป็นOSnetwork sandbox. ไม่มีWindowsvoicepackหรือmicsettingsถูกเปลี่ยน. Runtimeใช้PythonฐานจากCodex cacheและvenvในworkspace จึงยังไม่ใช่แพ็กเกจแจกจ่ายอิสระ.

ไมค์ไม่เปิดด้วยการโหลดหน้า; stop/navigation/permissionที่มาช้าต้องหยุดtracksและกันlatejob. ระหว่างเริ่มฟังจะpauseเสียงCIC. ยังคงต้องทดสอบเสียงสะท้อนจากลำโพง/YouTubeจริงก่อนเพิ่มwakeword/voicegrant. รุ่นนี้เป็นvoice-assisted ไม่ใช่hands-free.

เสียงThai tsync2ระบุข้อมูลCC BY-NC-SA3.0; ใช้เฉพาะprototypeส่วนตัวครั้งนี้ ไม่bundleโมเดลเสียงไปpublicdeploy/เผยแพร่เชิงพาณิชย์. ดู[model card](https://huggingface.co/rhasspy/piper-voices/blob/main/th/th_TH/tsync2/medium/MODEL_CARD), [PiperPyPI](https://pypi.org/project/piper-tts/1.8.0/), [faster-whisper](https://github.com/SYSTRAN/faster-whisper). Packagepins/modelrevision/hashอยู่backend/voice/requirements.lock.txtและmodel-manifest.json. qwen3:0.6b/1.7bไม่เปลี่ยนและไม่มีการfine-tune.


## Public preview 2026-10-12

Current conversation uses one scoped grant; Stop pauses work while retaining consent; explicit end/navigation/inactivity expires it. Typed utilities/app requests work without configured speech, and missing speech never starts microphone or synthesis. Configuration helper derives local paths and hashes; no developer runtime/models/audio bundled. See PUBLIC-PREVIEW-TH.md. Real user ASR remains6–10seconds and uncertain. A4-thread experiment was17% faster on a reused public development subset but below frozen20% criterion; retained3threads. Two short public หยุด clips were refused by250ms signal gate; lowering it and supplying explicitly derived silence gave หยุ่น for one and หยุด for another, not a pass. Signal/VAD thresholds unchanged. Capture now preserves enough already recorded silence for minimum500ms payload; does not fabricate padding or modify raw transcript.
