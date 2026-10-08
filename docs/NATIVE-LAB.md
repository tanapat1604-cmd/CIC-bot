# CIC native control lab — Windows pilot, 8 October 2026

This is a **prototype for testing the owned CIC Lab window**, not general desktop control, screenshot-driven planning, model training, or a release acceptance claim. Open `http://127.0.0.1:5173/CIC-bot/#/lab`. Public Pages is a disabled demo and never calls localhost. Existing read-only capture permission remains separate.

## Try it

1. Check Lab service, acknowledge **only the window created in this round**, and open CIC Lab. RAM must be at least608MiB free before startup (512headroom +96reserve). If blocked, arrange RAM yourself; CIC does not close other apps.
2. Select click / reviewed text / slider75 / scroll. Plans expire30s; type accepts≤40UTF-16 units without control characters. UIA patterns are inspected on the actual owned controls; unsupported actions are disabled/rejected.
3. Review and approve one plan in the web page. Switch yourself to the CIC Lab window. Read the pending action, then press its green confirmation button. **That confirmation is a human intervention; CIC does not click it.** CIC then uses the registered native UIA pattern on the target and checks the resulting count/text/value/top row.
4. Return to the web result. Choose a new task for each action; no continuous loop or implicit reuse. Do not move/resize/minimize the window between plan and action; changed geometry requires a new plan.
5. Stop using the web button, native red button, Esc inside Lab, or **Ctrl+Alt+F9**. Opening another round requires acknowledgement again. Leaving the web route sends cancellation reservations and stop. A backend/pipe crash must not resume work: the helper exits after missing heartbeat>2s or EOF. An HTTP acknowledgement is not enough; backend stop awaits actual owned-process exit.

Suggested fresh human tasks: click count0→1; type `CIC ทดสอบใหม่ 829` and verify exact Thai/English/digits; set slider75; scroll and verify top row increases. Then test stop while waiting for native confirmation, native hotkey, window move/resize/minimize, leave-route and backend loss. Record each separately as pass/fail/not-tried. Do not provide private screenshots. The whole-screen read-only check from earlier is not evidence for any of these native action tests.

## Architecture and decision

| Option | Benefit | Limits / decision |
|---|---|---|
| Selected: owned WinForms window + native UI Automation | Uses existing .NET Framework compiler/assemblies;0download/0API; real native controls and postconditions; no global keyboard/mouse injection | Human approves each action twice (web and native); typed tool controller, not autonomous qwen planning. No arbitrary external HWND or app selection |
| Later: scoped UIA + physical SendInput for an approved real app | Could cover controls absent from accessibility APIs | Requires separate target/pid-start-time/executable/focus/capture/DPI/takeover/input-release/stop gates. Not implemented or authorized by Lab acknowledgement |
| DOM lab | Lightweight deterministic browser tests | Would not prove Windows control. Fixtures here are test doubles, not the delivered native runtime |

`scripts/build-native-lab.ps1` compiles our source with existing Windows Framework64v4compiler and UIAutomationClient/UIAutomationTypes/WindowsBase, WindowsForms/Drawing/WebExtensions. No .NET SDK exists on the inspected machine; installed .NET8runtimes do not provide an SDK. No download/install/admin/security setting change. Output `.tools/native-lab/CicLab.exe` + SHA256 pin is local/ignored. The pin detects accidental artifact mismatch; it is **not** a signed release or protection against a malicious same-user process rewriting both files.

The server launches only that fixed executable with no user CLI/path, private inherited stdin/stdout pipes and a fresh nonce. No raw control HTTP, named-pipe listener, shell, `eval`, clipboard, screen capture, arbitrary coordinate/window API or attach to another process. The helper itself is the only target process/window; checks current own PID/HWND, foreground, normal window, fixed target control, screen rectangle + DPI geometry. Native structure is the observation source, **not qwen vision or OCR coordinates**. Five target points check occlusion against the owned root; this is not proof of arbitrary transparent/partial-overlay detection.

Closed `lab.control` permission is issued only for the reviewed action. Owner/session/operation/task/action/text/geometry/instance remain server-owned. The helper checks nonce/session/policy1/permission/task/operation/grant UUIDs, exact fields, one-time use, count≤32 and≤30s local pending lifetime. It accepts only four registered control patterns. Confirmation causes a new native observation and revalidation immediately before the UIA method; age≤1s. Unexpected identity/geometry/focus/unsupported pattern or mismatched postcondition fails without retry. Fresh worker identity is rechecked after asynchronous observations. Cancel-before-create/open tombstones reject late operations.

UIA calls run on background MTA threads so the native UI/hotkey/watchdog stays independent of LLM/browser render. No SendInput keys/buttons are pressed or held, no drag, IME shortcut, physical pointer movement or clipboard. `type` is UIA ValuePattern.SetValue, slider is RangeValuePattern.SetValue, scroll is ScrollPattern, click is InvokePattern. This must not be advertised as keyboard/mouse control. Physical keyboard/IME/drag/takeover performance remains not implemented/not tested.

Production Core math and Lab share one FIFO scheduler: active1 / waiting2 / one queued-or-active task per owner, per-job reserve8(math) or96(Lab), common512headroom. Legacy chat/chess/OCR/slides are guarded by busy bridging; they are not all migrated into the scheduler. Core math's stop only stops its own math/time jobs; Lab stop owns the helper and Lab grants. Neither is a global PC stop. Voice/model17 guards are unchanged (0.6cold-load1152MiB).

## Privacy and recovery

Commands/text/results are RAM only, not logged by default. Jobs≤32global/8perowner retained10min; operation tombstones≤128/10min. Native window/pipe and grants die on stop/crash, no persistent control permission or automatic replay. No image, clipboard, audio or user files are captured. Only the ignored developer binary and its hash persist. Legacy OCR crash-orphan files and slide index recovery gaps are unchanged; this Lab does not fix or certify them.

## Acceptance gates still pending

Actual UIA pattern discovery and owned-process exit/heartbeat-loss checks are separate from fixture positive effects. Native click/Thai text/slider/scroll, physical hotkey and stop p95≤500ms across30trials need human/actual evidence. No real-app control until those relevant gates pass and the user chooses a specific task/window. DPI125/150/200, real negative-coordinate multimonitor, display disconnect, PID/HWND reuse, occlusion, IME and hung native calls are not certified by mocked data or a single96DPI observation. No claim of all-app/Roblox/game/3D/coding/voice readiness. See validation/2026-10-08-native-lab/RESULTS.md.

Primary implementation references: [UIA threading](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-threading-issues), [RegisterHotKey](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey) (F12 is reserved;F9 used instead), [PerMonitorV2](https://learn.microsoft.com/en-us/windows/win32/hidpi/dpi-awareness-context). No content on a screen grants permission or changes goals.
