# Read-only window preview — 2026-10-08

User requests two-way speech and screen sharing/control, Neal game evaluation before3D. This delivery adds only the first read-only browser preview stage, not OCR integration, autonomous reasoning or control.

## Implementation

Local #/screen linked from chat sidebar. Explicit click invokes browser getDisplayMedia picker, audio:false, low frame-rate/resolution preferences. Entire-monitor streams rejected when displaySurface says monitor; window/tab selected by user. Unknown displaySurface is not used as trusted native window identity. No implicit capture, microphone, upload, storage, OCR, model call, action executor or game automation.

One current video stream and one memory-only snapshot object URL. Original/output dimensions, sourceUUID/sequence/time retained in component; snapshot capped1280x720; sourceframes exceeding8192dimension/32Mpixels rejected. Explicit stop, source revocation, navigation and unload stop all tracks and revoke snapshot. Pending picker cannot be programmatically dismissed; results arriving after stop/leave are immediately stopped. Snapshot callback invalidated by stop/clear/resize/newerrequest. Age>=10seconds displayed stale, no dispatch to actions. No nativecoordinate/geometry mapping claimed.

Public demo disables capture. AI chat remains text-only; capability screenRead remainsfalse because no AI read tool connected. Browserpreview is distinct from reference ingestion. User must choose a source in their own browser; no developer chooser clicks/native capture bypass.

## Verification

Frontend/backend build and lint PASS. Related first suite40PASS/1actualengineSKIP; focused screen8/8PASS after adding late-frame/resize test. Final per-frame generation fix: screen8/8PASS; final frontend build and lint PASS. Source projection after all changes retains related40-pass result for unchanged areas; no actual model/engine claim. Tested explicit start/noaudio/nobackend, stop/clear, denied permission, reject monitor, cancel pending picker, leave during pending selection, source revoked, staleframe, late resize frame, publichost capture disabled. Tests use synthetic canvas.captureStream replacing getDisplayMedia: real media lifecycle with a simulated picker, not proof of real browser/OS permission.

Desktop1440x900/mobile390x844/short360x480 screenshots visually inspected. No horizontal overflow. Synthetic image shown; no user's desktop/privatewindow captured in verification. Actual native chooser, actual shared window, resize across OS monitors/DPI and device/browser coverage **not yet accepted**. Needs user-operated picker test before claiming real-machine usability.

Initial test TypeScriptcast and lint-thisalias errors were in test fixtures; repaired without relaxing assertions. Voice API headlessprobe crash remains in OCR report. Existing localWebGLtimeout unchanged/notrerun. Models/Stockfish/slideworker unchanged; opt-in actual model/engine/native slide generation not repeated here.

Commit/CI/public verification recorded in WORK-PROGRESS.md after completion.

## Manual check

Open http://127.0.0.1:5173/CIC-bot/#/screen in a browser supporting display capture. Select a harmless window/tab, inspect live preview, take oneframe, clear it, stopsharing; verify browserindicator disappears. Repeat and close sharing from browserindicator; UI should stop and remove snapshot. Cancel picker and test stop whilepickerpending. Do not share private credentials or other windows for this test. No screenshot/upload of this test requested or recorded by developer.

[Browser API requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).
