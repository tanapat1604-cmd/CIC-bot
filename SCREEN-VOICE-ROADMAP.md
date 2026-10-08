# Explicit read-only whole-screen scope — 8 October 2026

The user clarified that single-source sharing worked normally and whole-screen selection was rejected. This was the earlier intentional monitor restriction, not a broken tab/window switch. The user then explicitly chose and authorized adding whole-screen read-only sharing. After implementation the user reported it works. Record this as human overall whole-screen confirmation, not individual results for every resize/revoke/leave/stop case.

Current #/screen defaults to one window/tab. Separate whole-screen radio and per-round acknowledgement explain that other apps/notifications on the selected monitor may be visible. The picker still requires the user's button and source choice; no hidden capture. Monitor selection is accepted only in acknowledged monitor mode; a browser-returned different surface is stopped. Scope cannot change during sharing/pending picker. Stop or unsuccessful picker resets acknowledgement; new round requires it again. One selected monitor only, no automatic other-monitor following. Window/tab mode still rejects monitor. Actual full-screen preview may include smaller text; manual snapshot is capped1280x720 and its original size is the delivered video stream, not a verified desktop/DPI coordinate map.

Source/frame IDs, monotonic age and explicit frame→OCR stay intact. Browser-reported surface is checked before/after snapshot; changed type stops and clears. No OCR/chat automatically, no audio, native click/type/control, vision model, downloads or private-data egress. Public-demo controls including scope selection remain disabled. The 0.6b default and retained1.7b/Stockfish/slidesA/B are unchanged. No claim that whole-screen coordinates can control an application.

Native whole-screen picker was selected by the user, not the developer. Local browser UI consent state was inspected and captured without starting capture. Automated monitor cases use labelled synthetic canvas/picker fixtures and are separate evidence. User individual remaining checklist paths and physical multi-monitor/DPI behaviour remain unverified. Voice runtime/mic/lab/game/coding executor still not installed/started. Follow exact offline voice artifact/license/size/resource choice before any download; no approval inferred from whole-screen permission.

The earlier same-day monitor-rejected and source-clarification status below is historical and superseded by this update. Final build/tests/CI/demo status follows in DELIVERY.md.

# Frame handoff correction — 8 October 2026

Current actual integration: reviewed native OCR; explicit fresh frame survives both production and development StrictMode, sharing stops on handoff. Native reader check on clearly synthetic frame passed. Human-selected sharing and stopCIC/stopbrowser confirmed; source/page switching reported incomplete and awaiting scope clarification. One browser-reported window/tab only, monitor rejected; do not interpret the report as authorization for the whole desktop. Frame/resize/leave/picker retry/permission-settings revocation remain unverified individually. Complete these gates before additional speech runtime choice/installation. No native input, microphone or model-vision capability added.

# CIC speech + screen roadmap — 2026-10-08

User target: two-way spoken commands/answers, screen sharing and control; use https://neal.fun/not-a-robot/ as one gameplay evaluation before investigating3D games. This is integration/evaluation, not evidence that qwen weights improved. No promise to complete every task/game. Preserve coding and slide/image/table plans in NEXT-CAPABILITIES.md.

## Current reality

CIC supports text chat (experimental), calculator/time, Stockfish chess, reviewed-outline slide A/B files. OCR explicit languages/regions now has local API/UI with raw/edit/review/coordinates and explicit typed reference to a new chat; misspelling remains. Real native5-image UI evidence is narrow and manually bounded. Read-only #/screen simulated lifecycle tests pass; user confirms actual sharing works but individual stop/revoke/resize/leave paths need specific human evidence. No click/type executor or bidirectional voice in CIC yet. qwen0.6b has no vision.

## 1. OCR pilot with user review — implemented, limited acceptance

Implemented selected image + manual language/ROI selection; source preview and raw/edited text separate. Generated job paths, strict decoded-image dimensions/byte/pixel limits, sessionownership, onecomputejob, deadline/cancel/stale suppression. Display reading order and transformations. No guessing missing text. Explicit user review before sending a typed reference envelope to chat; OCR reference cannot issue tool commands. Fail clearly on unsupported/uncertain layouts. Test real new-layout images as well as synthetic examples; previous test images become regression only.

## Ordered next gate: actual selected-window verification BEFORE voice

Follow the current user brief order: complete #/screen real picker/preview/frame/resize/stopCIC/stopbrowser/revoke/leave/cancel checks first. User confirmed sharing works; remaining paths are not automatically passed. Simulated tests are separate. Frame age is performance.now from draw time; slow≥10s encoding and stale handoff rejected. Explicit frame-to-OCR stops capture on route leave. No native coordinate/control acceptance. Then stage2voice below.

## 2. Two-way voice, approval pending for additional runtime

Offline ASR candidate Whisper base multilingual (~142MiB model per project docs; memory estimate not a machine guarantee). Verify pinnedWindowsCPUrelease/hash/license/executable, measure RAM+time sequentially with Ollama. No silent fallback to online browser ASR. Thai TTS must be separately selected and actually listened to; installed registryEnglishvoices not proof of Thai. Do not download voices or alter system language settings without choice.

Start push-to-talk: user starts mic, recording indicator, stop button, duration/bytes cap, discard. Transcript appears for correction before submission. Denied permission, silence, noise, timeout, cancel, leave and retries must preserve draft and release tracks. No always-listening/wakeword yet. Test Thai/English/mixed numbers, names, corrected instructions, unknown/noise/silence; syntheticTTS samples alone do not prove human-speaker accuracy. Actual mic/speaker interaction requires user participation.

Spoken response: user-controlled toggle, sentence buffering during stream, no repeated sentences after retry, stop speech immediately on stop/newtask/navigation. Do not read secrets or entire OCR automatically. When user starts speaking, pause output and listening must not feed CIC's own voice back as a new command. Spoken “stop” needs a tested path; visible stop remains available independently. Label model/tool/system sources. Measure time to transcript, first answer text and first audio separately; do not promise real-time from model load times.

## 3. Share a selected browser window, read only

User-triggered getDisplayMedia picker; indicator, preview, ROI and stop sharing. At first capture on demand, no continuoushiddenrecording. FrameID/timestamp/source/dimensions/transform attached; invalidate on newsource/resize/stop/revoke/leave. No retainedprivateimages/logs by default. User-selected review/copy only, no OCR-to-action dispatch. OCR does not recognize all pictures/icons; a visioncomponent may be necessary for pictured game puzzles and needs separate resource/choice evaluation. Browsercapture alone does not provide trustworthy OS windowhandle/clickcoordinates.

## 4. Local control lab first

Isolated fixture with clicking, typing, dragging, scrolling and simple puzzle states. Bounded action queue/window identity/currentframe/focus/precondition/postcondition. Stop button cancels real pending actions; measured stop latency, no late actions. Refuse on staleframe/changedgeometry/uncertainty/unexpectedstate. Permission applies to named task/window, not arbitrary desktop. External effects (send/purchase/delete/publish/settings) require task-specific approval.

## 5. Neal game benchmark

Only after lab/stop tests pass, browser game scope explicitly authorized by user. Inspect actual page each run, classify challenges requiring text, visualobjects, drag/timing and reasoning; report unsupported cases. Ordinary gameplay only: no hidden answer extraction, source-code solution, localStorage level skipping or pretending developer-controlled scripted coordinates are CIC vision. Separate DOM-assisted and screenshot-driven results; do not mix scores. Any genuine access/security verification encountered requires human takeover rather than automation.

Record initialstate, observations, plannedaction, actualaction, resultingstate, elapsedtime, failures and manualinterventions. Repeated runs and new puzzle variants; advance only from observed success. Passing this game is not generalintelligence or native3Dreadiness. No attempt to play or gamepass claimed in this checkpoint.

## 6. 3D game pilot later

Choose one specific offline/single-player game and task. Separate requirements: graphicalperception, camera/motion, framebudget, keyboard/mouse timing, collision/taskstate and resourcecontention. Inspect game restrictions and capture/input support. No ranked/online anti-cheat bypass or unsupported driver manipulation. Plan a bounded repeatable scenario and stop/recovery before installation/control.

## Decision points

Pending card: authorize offline ASR trial, compare online services/budget first, or pausevoice and continueOCR. After OCR pilot evaluate selected-window sharing; after read-only sharing+lab choose exact browser scope. No silence treated as approval for downloads/externaldata. Notification through chat/cards; no popup capability claimed.
