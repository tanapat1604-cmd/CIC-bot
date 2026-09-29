# CIC text backend — stage 3A, local development only

This release has a free deterministic **test provider, not AI**. No upstream API, paid model or public backend is configured. Do not expose it with a tunnel, reverse proxy or public listener. The local trust model is not public user authentication.

## Run

Requires Node 22.12+; dependencies are installed from the repository root with `npm ci`.

1. Optionally copy `backend/.env.example` to `backend/.env` and edit local settings. The real file is ignored. No key is needed for `AI_PROVIDER=test`.
2. Run `npm run backend:dev` from the root. It compiles TypeScript into `.backend-build/` and listens only at `http://127.0.0.1:8787`.
3. In another terminal, `npm run dev` and open `http://127.0.0.1:5173/CIC-bot/#/app` (use `127.0.0.1`, not `localhost`, so the local session cookie is same-site).
4. Click **การเชื่อมต่อ → ตรวจการเชื่อมต่อ backend → เริ่มแชตทดสอบ backend**. The health and local session checks must both succeed first.
5. Send Thai text; it streams a labelled test response. Stop cancels the HTTP request and provider signal. New chat/switch/route departure cancel too.

`npm run backend:build` only compiles. `npm run build` builds the frontend. `npm test` includes free backend, transport and browser tests; CI never calls a paid provider. The browser tests use port 8787, so stop a manually started backend before running tests.

Only public `VITE_BACKEND_URL` belongs in the root `.env.local`, if overriding the local port. Never put any key in `VITE_*`. The frontend rejects non-loopback endpoints in this release and disables backend connection on public hostnames regardless of configuration. GitHub Pages remains a working demo.

## Protocol and boundaries

- `GET /health`: `{version:1,ready:true,kind:"test",capabilities:["text-stream"]}`; no model/key/provider internals.
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
- Chat: 10 attempts/minute per local credential, 1 concurrent per credential, 2 globally, 100 admitted provider calls per process lifetime. Duplicate operationId on a credential is rejected; manual retry uses a new one. Invalid attempts count toward rate limits, cancellation still counts toward call budget.
- 10s HTTP request/header timeout; 30s total chat/body/provider timeout; 12,000 output characters maximum. Frontend has a 35s whole-request bound. Abort closes the reader/fetch; response close aborts provider; timeout/output errors clean up listeners and counters. Providers must honor the supplied signal for actual upstream cancellation.
- `CHAT_ENABLED=false` disables chat on next server start. Stop the process to stop usage immediately. The 100-call counter is an additional local test circuit breaker, **not monetary cost accounting**; restarts reset all counters. Before any paid/public provider, add persistent user/service quotas and a provider spend cap/kill switch appropriate to that service.
- Logs contain only generated request ID, status and elapsed milliseconds. Do not log prompts, cookies, keys or raw provider errors. User-facing errors are allowlisted Thai messages.

## Next decisions (3B / 3C)

Choose one provider/model and a backend hosting/access approach with the user; read current official API docs before implementation. Have the user configure secrets in the server environment/secret manager, never in chat/source/VITE variables. No API calls with cost until explicitly authorized.

3B requires implementing that single real provider and a minimal authorized answer/stop check. Stopping cannot refund usage already incurred. 3C additionally requires server-verifiable user access (e.g. selected gateway identity), persistent quotas/rate/concurrency controls, provider token/output/spend limits, HTTPS/session/CSRF configuration and explicit frontend origins. GitHub Pages only serves frontend; backend must run elsewhere. Do not simply remove the local checks and publish this server.

Implementation references: [ReadableStream reader](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/getReader), [incremental TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode).
