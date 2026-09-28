# CIC app foundation — progress

Updated: 2026-09-28. User requests a working simulated app, linked from the existing landing page, then test, commit, push and verify GitHub Pages.

## Baseline
- Repository clean at `bcca397`; fetched origin/main, no incoming changes.
- Existing React 19 / TypeScript / Vite / Playwright; preserve the landing scene and motion.
- Full brief: user attachment `0ae6a7f9-3f7d-410b-b38a-1f4edf6f3d5c/Pasted text.txt`.

## Implemented (not committed yet)
- Lazy hash route `#/app`, scoped landing CSS, shared tokens/Brand. Landing entry buttons now open app, downloads keep dialog.
- Expanded/compact workspace, in-memory SessionStore, injected mock adapters, AbortSignal + session/operation checks, per-action approval and context selection.
- Local image previews with validation/revocation, URL attachments without fetch, IME-safe composer, native dialogs, responsive sidebar/drawers.
- New `tests/workspace.spec.ts` (11 browser cases) and `tests/store.spec.ts` (6 behavior cases).
- Production build and lint passed. Workspace chunk 36 KB before gzip; Three remains separate/lazy.

## Verification progress
- All 30 test cases have passed across regression and targeted reruns (13 existing landing/motion + 17 new app/store). Most recent app/store suite: 17/17 passed; additional rich composer check at 360×480 passed.
- Fixed lazy-route test synchronization. WebGL scroll/context-loss test passes at 1280×800 (software renderer is slow; no FPS claim).
- Fixed actual new-message button issue: active-scale selector overrode translateX centering, moving the button during click. Centering now uses auto margins, with independent press transform.
- Inspected desktop, laptop, mobile and compact screenshots; fixed empty chat initially scrolling downward on short screens. No horizontal overflow in tested viewports.
- Contrast ratios measured: success 6.13, warning 5.95, error 6.78, muted 4.56, primary white 5.49.
- APP-FOUNDATION.md and README updated. Production build and final lint passed. Only existing Three chunk-size warning remains; app direct route does not load it.

## Remaining
- Commit/push without force, verify GitHub Actions deployment and live URLs.
- Live app checker is `.tools/verify-app-live.mjs`; it compares the served JS hash to local build, tests app/landing, approval across layouts, mobile and errors, and writes `test-results/live-app-verification.json`.

## Commands
PowerShell: prepend `.tools/node-v22.22.0-win-x64` to PATH; set PLAYWRIGHT_BROWSERS_PATH to `.tools/browsers`. `npm run build`, `npm run lint`, `npm test`.
Network/git writes may need sandbox escalation. Never bypass a quota/approval failure; keep this file current for continuation.
