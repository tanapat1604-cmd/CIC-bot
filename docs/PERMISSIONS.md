# สิทธิ์ P1

ช่องทาง loopback Host/Origin/peer/HttpOnly session เดิมยังบังคับก่อน Core endpoint POST ต้องมี exact trusted origin, application/json ไม่มี encoding และ body≤4096bytes GET job ต้องเป็น owner ไม่ return cookie/owner/token ใน JSON

สิทธิ์ที่ **ออก grant ได้ตอนนี้**: tools.calculate เฉพาะ calculator/time-calculator หนึ่ง action ที่ผู้ใช้ตรวจแล้ว UI เริ่มไม่ได้จากผลโมเดล ข้อความ OCR หรือ reference ที่ยังไม่ตรวจ Plan request รับเพียง version/operationId/instruction; unknown fields/reference/forged result/grant/path/owner ถูกปฏิเสธ

สิทธิ์ที่จองชื่อและ **ยังไม่เปิด**: screen.read, mic.listen, audio.speak, desktop.control, browser.read/control, web.fetch, workspace.read/write, process.run, external-provider.egress ต้องมี adapter/policy/target/resource/verifier/native-stop และ gate ของตนก่อนให้ grant ไม่ออก grant จาก system prompt หรือ checkbox แชร์อ่านอย่างเดียวเดิม

Core grant สร้างบนserver ผูกกับ owner/task/operation/tool/target/expression/policyVersion/monotonic expiry หนึ่งครั้ง≤30s Revoke/cancel/expired/wrong owner/wrong target/replay ถูกปฏิเสธก่อน effect ไม่มี generic grant endpoint ให้ client เลือก desktop/process tools

Core stop ไม่ใช่ global PC stop ใช้กับ Core jobs เท่านั้น Legacy chat/OCR/slides มี stop ของตนเดิม ไม่ประกาศว่า abort HTTP หยุด Ollama computeจริง ไม่มี native helper/input/hotkey ใน P1 และไม่ยกระดับสิทธิ์ ไม่แก้ Defender/UAC/pagefile/anti-cheat

Privacy: ไม่มี log คำสั่ง/ผล Core โดยปริยาย job args/results อยู่ในRAMตามbounded retention ผู้ใช้เลือกดูเอง หลักฐาน dev เป็นภาพ/คำสั่งสังเคราะห์ ไม่มีภาพส่วนตัว/audio/cookies/secretsในpublic report Raw JSON/freezes/resources อยู่ C workspace/privateignored ไม่มี persistent personal memory

Future gates: browser fetch ต้อง scheme/domain/redirect/DNS/IP checksทุกhop (SSRF fixtureยังNOT-RUNเพราะไม่มี fetch adapter); CodingAgent ต้อง canonical workspace+reparse escape+secrets filtering+OS sandbox (ยังNOT-RUN); native helperใช้ user ACL named pipe และ paired identity ไม่เปิด raw control HTTP endpoint ทุก negative gate ที่ยังไม่มี adapterไม่ถือว่าผ่าน

## Native Lab supplement — 8 October 2026
Closed lab.control permits only the newly owned CIC Lab window, reviewed single action plus native human confirmation. General desktop.control remains disabled; read-only sharing never grants Lab control. Private inherited pipes/nonce and helper-side observation/deadline/geometry/grant checks; one-time≤30s. Web stop waits owned child exit. See NATIVE-LAB.md; no SendInput/clipboard/other-app/shell permission.


## Notepad supplement — 8 October 2026
Closed notepad.append is scoped to the fixed newly launched Windows10 Notepad PID/start-time/path/HWND/editor, reviewed literal text only. Unicode pairs require current focus/geometry/expected text and readback. No arbitrary desktop keys/window/path/shell/capture API. Stop exits the owned helper and leaves Notepad documents open. See NOTEPAD-CONTROL.md; global desktop.control remains disabled.


## YouTube music prototype (2026-10-08)

At #/youtube: explicit public artist-search scope, actual local model plan, one reviewed approval within30s, isolated temporary Chrome only. No personal profile/account, shell, arbitrary URL, download/upload, messaging, subscription or CAPTCHA bypass. Stop waits owned Chrome exit; no global desktop hotkey. See [YOUTUBE-CONTROL.md](YOUTUBE-CONTROL.md) for navigation/resource allowlist, RAM admission and model cancellation limitations. General chat remains text-only.

## Conversation session scope — 12 October 2026

The #/voice conversation can accept one explicit owner-bound local-session grant (ten minutes of inactivity, renewed by an explicitly submitted turn or the ongoing microphone session the user started; expires or is revoked on explicit end/navigation/restart) for fixed app opens (Notepad, normal Chrome, normal Chrome YouTube home) and public Chrome search-result reading. Each automatic turn still has a fresh one-use operation nonce. ASR/LLM output does not issue rights. /conversation/grant accepts only acknowledged:true, a fresh operationId, current sessionRevision and the exact ordered scopes [app-open, chrome-search-read]; no custom tools, executable, paths, account/control/file/send rights. Session approval endpoints enforce current server rights before admission and again during execution; invalid duplicate requests cannot downgrade an active job's permission source. Manual standalone diagnostics retain their per-task review flow.

Chrome reader opens one new installed normal Chrome window for a fixed Google search URL built from a bounded public query. It validates HWND/PID/start-time/path/search URL, reads document names only, and exits its private pipe helper after completion. No debugger, profile/cookie files, input injection or arbitrary HWND selection. Stop does not close normal Chrome. Search-result selection is a model proposal validated against a fresh observation; general navigation, page summary, downloads/uploads/forms and desktop control remain disabled. Models may still misclassify; unsupported computer-action imperatives, denials and truncated/forged query fields cannot auto-admit a search. See ../validation/2026-10-12-chrome-observation/RESULTS.md; this is not microphone/hands-free acceptance.

A scope grant nonce is also consumed once. Pause/explicit end/navigation increment the session revision immediately, so a grant request whose body completes after revocation cannot restore automatic rights. Nonces are bounded to 128 per local session; grant and all task nonces are retained until their respective session/ledger expiry. This is covered by the delayed-body regression, not a microphone acceptance claim.


Conversation continuity update (12 October): the main Stop button now pauses microphone, playback and all current owned jobs while retaining consent. /conversation/pause immediately blocks automatic admission and increments revision, waits apps/Chrome-reader/Notepad cleanup, and only marks this revision settled after all checks. /conversation/continue accepts exactly the current sessionRevision, requires existing unexpired consent and settled cleanup, resumes the same fixed scopes and renews the cookie/session expiry to ten minutes. It does not grant new rights, renew expired/revoked consent, or replay an old command. Each turn still uses its own one-use operation. The separate จบการใช้แอป button invokes revoke; diagnostic Stop retains revoke behavior. No navigation, desktop control, file/send permissions added.


## Development checkpoint — 16 October 2026

The development branch adds selected-window desktop and fixed TikTok prototypes. They remain local loopback/session-owner endpoints; one-use operation/grant nonces, current window/PID/birth identity, geometry, foreground and observation freshness are checked by the native helper. Stop waits only the owned helper exit and leaves user windows open. These additions do not establish all-app support or human speech acceptance. TikTok navigation failed native verification in the latest real trial; no successful scroll is claimed. Training is disabled by default and is an explicit operator feature sharing the main exclusive slot. No models/audio/screenshots/personal memory/raw validation or .env are published in this checkpoint. Personal memory is now an explicit confirmed local store with view/edit/delete; old supplements describe earlier stages.
