# Gates — P0/P1 ณ 8 ตุลาคม 2026

ตัวเลขจาก brief เป็นเป้าหมาย ไม่ใช่ผลผ่าน ผลrunจริงและfailureอยู่ validation/2026-10-08-core-p1/RESULTS.md รายงาน STATIC/MOCK-FIXTURE/NATIVE-TOOL/REAL-MODEL/REAL-APP-E2E/USER-REPORTED/CI/NOT-RUN แยก denominator

| Gate | หลักฐาน/สถานะปัจจุบัน |
|---|---|
| P0 cleanHEAD/runtime/read docs/freeze | ตรวจbaseline b32ed83 และsnapshotจริง; fresh3tool regressionsผ่านก่อนsourceedit; freshfullsuiteก่อนแก้NOT-RUNตามRAM |
| P1 strictschema/permission/ownership/replay/target/expiry/revoke | เขียน tests แล้ว; ห้ามเรียกทั้งหมดPASSก่อนรัน; lightweight5group probeผ่าน fixture/runtimeC แยกจาก fulltests |
| Queue/memory/deadline/fairness/cancel/late-result/stop-unverified | บางกรณีผ่านlightprobe; fulltestsอยู่core.spec.ts ต้องบันทึกผลrunจริง ไม่ถือnative500ms/30trialsผ่าน |
| Legacy computebridge | codeเพิ่มcorebusyกับlegacybusy; ต้อง regressionOCR/slides/chess/chat และraceก่อนaccepted |
| Capability schema/client/UI/publicdemo | แยก v1 additiveจากhealthเดิม; ต้องbuildและUIจริง3sizes; testfixtureRAMไม่ใช่ผลวัดproduction |
| Realmodel17 | NOT-RUNเมื่อไม่ถึง1152MiB; ห้ามเพิ่มคะแนนจากtools |
| Read-only capture | user-reportedแชร์ได้และแหล่งเดี่ยวstopสองแบบเดิม; remainingresize/revoke/leave/หลายจอ/DPI ยังไม่ครบ |
| P2 voice | contracts/candidatecomparisonเท่านั้น ยังไม่ติดตั้ง/รับเสียงคน/ฟังTTS หรือผ่าน27/30ASR/18/20TTS/latency |
| P3 native lab/control | ไม่มีhelper/executor/hotkey; allnative18/20/500ms/DPI/focus/crash NOT-RUN |
| P4 research/browser | ไม่มีCoreadapters/fetchpipeline/SSRF acceptance; noactualChrome/YouTube/music/researchclaim |
| P5 games/Roblox | ยังไม่ทดสอบหรือควบคุม เปิดเฉพาะหลังscope/rules/nativegateอนุญาต |
| P6 animatedslides/coding | เดิมA/Bข้อความยังรักษา; animatedHTML/FPS/nativeanimation/codingdiff+sandbox NOT-RUN |
| P7 release | overallNOT-ACCEPTED; feature flags/contractsไม่ใช่ครบวงจรจาวิส |

P1pilotจะผ่านเฉพาะboundedtools scopeเมื่อbuild/lint/regressions/actualCICUI/negativepermission/stop-caseผ่าน ไม่มีCoreadapterใดสั่งOS/coreexternal effectsได้ การผ่านpilotไม่ยกcriticalnative/voice/research/coding gatesให้ผ่านอัตโนมัติ
