# CIC text backend — local Ollama (3B) and test provider

This release supports the installed **local Ollama model** and a free deterministic test provider. No paid/cloud API or public backend is configured. Do not expose it with a tunnel, reverse proxy or public listener. The local trust model is not public user authentication. Actual results and remaining Thai-language limitations: [OLLAMA-VALIDATION.md](../OLLAMA-VALIDATION.md).

## Run

Requires Node 22.12+; dependencies are installed from the repository root with `npm ci`.

1. Copy `backend/.env.example` to `backend/.env` if it does not exist. For real local AI set `AI_PROVIDER=ollama`, `AI_MODEL=qwen3:0.6b` (or another installed model). For free deterministic testing set `AI_PROVIDER=test`. No key is needed; no model is downloaded by the backend. The current user's ignored `.env` already selects Ollama.
2. Run `npm run backend:dev` from the root. It compiles TypeScript into `.backend-build/` and listens only at `http://127.0.0.1:8787`.
3. In another terminal, `npm run dev` and open `http://127.0.0.1:5173/CIC-bot/#/app` (use `127.0.0.1`, not `localhost`, so the local session cookie is same-site).
4. Click **การเชื่อมต่อ → ตรวจการเชื่อมต่อ backend → เริ่มแชต AI ในเครื่อง** (or **เริ่มแชตทดสอบ backend** when using test). Health checks Ollama `/api/show`, installed model and thinking support before enabling local AI. Each model request checks again. Missing/stopped Ollama returns a real error, never a mock answer.
5. Send text; responses are labelled with the local model. Stop cancels frontend → backend → Ollama HTTP. New chat/switch/route departure cancel too.

`npm run backend:build` only compiles. `npm run build` builds the frontend. `npm test` includes free backend, transport and browser tests; CI never calls a paid provider. The browser tests use port 8787, so stop a manually started backend before running tests.

`tests/ollama.spec.ts` uses deterministic HTTP fixtures, not a real model. Explicit local smoke test (PowerShell): `$env:CIC_TEST_OLLAMA='1'; npx playwright test tests/ollama-live.spec.ts`; remove the variable afterward. This calls the installed model and requires Ollama running. `node scripts/ollama-probe.mjs before` / `after` records a short bilingual comparison under `.tools/ollama-evidence/` after `npm run backend:build`. CLI echo uses direct process argv/stdout bytes, without changing terminal encoding.

Default Ollama settings: `OLLAMA_CONTEXT=2048`, `OLLAMA_OUTPUT=192`, `OLLAMA_THREADS=3`, `OLLAMA_THINK=false`, `OLLAMA_KEEP_ALIVE=1m`, `OLLAMA_URL=http://127.0.0.1:11434`. These are per-request limits, not a RAM guarantee. Only one CIC Ollama request runs at a time. Other apps using Ollama are outside CIC's limits. Config validates modest upper bounds; model must support the selected thinking flag. Redirects/non-loopback endpoints/cloud-model metadata are rejected.

Ollama receives a server-owned CIC instruction, language hint and text history. `truncate:false`/`shift:false` prevent silent context loss. Its token context can reject a conversation before the generic 24,000-character transport limit; start a new chat or shorten the request. A `done_reason=length` response keeps partial text and reports the output cap instead of marking it complete. Thinking and tool calls never become user answers or actions.

Only public `VITE_BACKEND_URL` belongs in the root `.env.local`, if overriding the local port. Never put any key in `VITE_*`. The frontend rejects non-loopback endpoints in this release and disables backend connection on public hostnames regardless of configuration. GitHub Pages remains a working demo.

## Protocol and boundaries

- `GET /health`: `{version:1,ready:true,kind:"test",capabilities:["text-stream"]}`; local AI adds `kind:"live",model:"qwen3:0.6b",location:"local"` for an honest UI label. No key or raw provider internals.
- `POST /session`: on an explicitly allowed local Origin only, creates a random 256-bit, 10-minute HttpOnly, SameSite=Strict cookie. This credential is checked by `/chat`; it is not a shared frontend secret. Any trusted local process can bootstrap it, so **this is a development trust boundary only**.
- `POST /chat`: JSON `{sessionId,operationId,messages:[{role:"user"|"assistant",text}]}`. Strict runtime allowlist in `shared/chatProtocol.ts`; unknown keys, attachments, source, actions, system messages and non-text content are rejected.
- Response: `application/x-ndjson; charset=utf-8`, one JSON event per newline. Every event includes sessionId/operationId. `delta` has text; `done` terminates; `error` has an allowlisted code. Client understands `cancelled`, but a disconnected socket cannot receive it. Client never accepts action events and never interprets text as a tool call.
- UTF-8 is decoded incrementally and lines buffered across arbitrary network chunks. EOF without a newline-terminated terminal event is an interrupted response, not success. No automatic retries.
- Client sends only the current backend session's history: complete user/assistant text, omitting interrupted/failed assistant replies. Keep the latest whole-message suffix (no partial slicing), maximum 24 messages / 24,000 JS characters, each at most 8,000. Drop an initial orphan assistant if trimming lands on it. Latest user text is always retained or explicitly rejected as too large. UI notes omitted history.
- Backend revalidates these limits and enforces a 160,000-byte body cap. Limits count JS UTF-16 code units, not tokens. A provider adapter must additionally enforce its provider's token/output constraints.
- Provider interface receives only text messages, server-owned system instruction, output limit and AbortSignal. No provider secrets, configuration or implementation is imported into frontend code.

## Local access and resource limits

- Listener bound to `127.0.0.1`; Host must match that address/port. Reject non-loopback peers, proxy forwarding headers and unlisted Origin. No wildcard CORS. CORS is not the only access check.
- Default origins exactly `http://127.0.0.1:5173` and `http://127.0.0.1:4173`; backend rejects non-loopback origins even if configured.
- Local session bootstrap: 10/minute globally, at most 32 sessions; sessions expire after 10 minutes. Recheck connection to renew. No storage/database/login.
- Chat: 10 attempts/minute per local credential, 1 concurrent per credential, 1 globally for Ollama (2 for the test provider), 100 admitted chat requests (including utilities) per process lifetime. Duplicate operationId on a credential is rejected; manual retry uses a new one. Invalid attempts count toward rate limits, cancellation still counts toward call budget.
- 10s HTTP request/header timeout; 30s total chat/body/provider timeout; 12,000 output characters maximum. Frontend has a 35s whole-request bound. Abort closes the reader/fetch; response close aborts provider; timeout/output errors clean up listeners and counters. Providers must honor the supplied signal for actual upstream cancellation.
- `CHAT_ENABLED=false` disables chat on next server start. Stop the process to stop usage immediately. The 100-call counter is an additional local test circuit breaker, **not monetary cost accounting**; restarts reset all counters. Before any paid/public provider, add persistent user/service quotas and a provider spend cap/kill switch appropriate to that service.
- Logs contain only generated request ID, status and elapsed milliseconds. Do not log prompts, cookies, keys or raw provider errors. User-facing errors are allowlisted Thai messages.

## Latest local model trial (2026-10-04)

Authorized 1.7b trial is complete; both models remain installed, default stays 0.6b. 1.7b was usable with CPU/RAM after closing apps but failed correctness/capability gates and real-app retry completion. Neither model is accepted for general Thai/personal-assistant reliability. Frozen questions, raw responses, measured times/RAM and evaluation are in [RESULTS.md](../validation/2026-10-04-thai/RESULTS.md). Next focus selected by the user is truthful capabilities and correctness before personality, still text-only/local.

## Remaining quality work / 3C

3B connectivity is verified with Ollama 0.34.4/qwen3:0.6b on the user's machine and rechecked on 0.35.1; general Thai quality is not accepted yet. No additional model downloads without the user's choice/authorization. Swap the installed model via server config without changing frontend API calls, then restart backend and begin a new chat. Ollama API details were checked against the [v0.34.4 documentation](https://github.com/ollama/ollama/blob/v0.34.4/docs/api.md) and [types](https://github.com/ollama/ollama/blob/v0.34.4/api/types.go), then the [v0.35.1 types](https://github.com/ollama/ollama/blob/v0.35.1/api/types.go) on 2026-10-04 before retesting.

3C remains out of scope and requires server-verifiable user access, persistent quotas/rate/concurrency controls, HTTPS/session/CSRF configuration and explicit frontend origins before any public backend. GitHub Pages remains demo only. Do not remove the local checks to publish this server. If a paid provider is selected later, configure server secrets outside chat and obtain cost authorization first.

Implementation references: [ReadableStream reader](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/getReader), [incremental TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode).

## Truthful capabilities and bounded text utilities

Live health carries the authoritative capabilityProfile from shared/capabilities.ts; frontend verifies this before connection. Chat completion only means text delivery. Server chooses done.source (model, calculator, time-calculator or capabilities); prose/embedded JSON cannot confirm an external action. /calc supports bounded arithmetic and /time HH:MM +/- integer minutes supports clock arithmetic with day offsets. Neither creates reminders/jobs or calls model for invalid syntax. Use /capabilities for help. Natural-language math still goes to model and may be wrong. A conservative unsupported-request grammar rejects some explicit requests; it cannot cover every paraphrase. The model can still falsely claim capabilities; UI warns that text is unverified and no external work was performed. See [current trial](../validation/2026-10-04-correctness/RESULTS.md) for bounds and raw failures. Default remains qwen3:0.6b;1.7b stays installed, no downloads.
