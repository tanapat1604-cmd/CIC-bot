# CIC speech + screen roadmap — 2026-10-08

User target: two-way spoken commands/answers, screen sharing and control; use https://neal.fun/not-a-robot/ as one gameplay evaluation before investigating3D games. This is integration/evaluation, not evidence that qwen weights improved. No promise to complete every task/game. Preserve coding and slide/image/table plans in NEXT-CAPABILITIES.md.

## Current reality

CIC supports text chat (experimental), calculator/time, Stockfish chess, reviewed-outline slide A/B files. OCR explicit languages/regions is a developer experiment: new-2non-blur11/11gate but development2fail and misspelling remains. Read-only browser #/screen preview now implemented with simulated-picker media tests; native chooser/user-window validation pending. No OCR API/UI, click/type executor or bidirectional voice in CIC yet. qwen0.6b has no vision.

## 1. OCR pilot with user review

Implement selected image + manual language/ROI selection; source preview and raw/edited text separate. Generated job paths, strict decoded-image dimensions/byte/pixel limits, sessionownership, onecomputejob, deadline/cancel/stale suppression. Display reading order and transformations. No guessing missing text. Explicit user review before sending a typed reference envelope to chat; OCR reference cannot issue tool commands. Fail clearly on unsupported/uncertain layouts. Test real new-layout images as well as synthetic examples; previous test images become regression only.

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
