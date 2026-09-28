# CIC app foundation — progress

Updated: 2026-09-28. User requests a working simulated app, linked from the existing landing page, then test, commit, push and verify GitHub Pages.

## Baseline
- Repository clean at `bcca397`; fetched origin/main, no incoming changes.
- Existing React 19 / TypeScript / Vite / Playwright; preserve the landing scene and motion.
- Full brief: user attachment `0ae6a7f9-3f7d-410b-b38a-1f4edf6f3d5c/Pasted text.txt`.

## Implemented and published
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

## Deployment and final handoff
- Code committed/pushed as `7aade646a664a5bdfc14c7d17c6dc7a75825d175`; no force push.
- GitHub Actions run https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/36411840221 completed successfully (build/tests/deploy).
- A quota limit interrupted the first live-browser verification attempt. User resumed after quota reset; verification then completed successfully.
- Live landing: https://tanapat1604-cmd.github.io/CIC-bot/
- Live app: https://tanapat1604-cmd.github.io/CIC-bot/#/app
- Live served asset `/CIC-bot/assets/index-D291Lb3r.js` matches local production build; HTTP 200, no console/page errors or HTTP asset errors.
- Verified direct app/reload, desktop/mobile, source selection, approval carried from expanded to compact, completed mock action, landing footer entry and actual landing WebGL. Direct app does not request Three/Scene chunk.
- Inspected live screenshots: desktop, approval card, compact and mobile. Evidence is in `test-results/live-app-*.png` and `test-results/live-app-verification.json` (gitignored).
- No remaining work for this brief. AI, real screen sharing, desktop integration and persistence remain future work; see APP-FOUNDATION.md.
- Browser coverage is Chromium with simulated viewports; physical mobile devices, Safari/Firefox and screen readers have not been verified.

## Commands
PowerShell: prepend `.tools/node-v22.22.0-win-x64` to PATH; set PLAYWRIGHT_BROWSERS_PATH to `.tools/browsers`. `npm run build`, `npm run lint`, `npm test`.
Network/git writes may need sandbox escalation. Never bypass a quota/approval failure; keep this file current for continuation.
