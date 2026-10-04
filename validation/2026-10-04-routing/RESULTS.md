# Routing, latest intent and animation round — 2026-10-04

Start: clean `ccb9efa` / origin main, previous tested code `f1eeb1f`. Read WORK-PROGRESS.md and the help report before edits. qwen3:0.6b, installed 1.7b retained; no pulls, public backend, reminder, screen or control implementation. Production model prompt/settings unchanged.

## Decisions and evaluation boundary

The user chose targeted clarification (draft or explain how to do manually, state no external work) and a separate prompt experiment in this round. There is no callable immediate app-notification tool in this session; choices use app question cards and completion uses chat. No toast/notification delivery claimed, automation created or other channel contacted.

PLAN.json records start/hash/free RAM. scripts/routing-cases.json froze 12 development and 16 new holdout cases before edits; baseline compiled files were archived locally. baseline-dev and baseline-holdout were recorded before edits; holdout answers were not inspected until FINAL-FREEZE.json and final-holdout completed. Final production hashes remain fixed after that. New failures become next-round regression, not same-round tuning. All inputs are synthetic.

Raw evidence: baseline-dev.json, final-dev.json, baseline-holdout.json, final-holdout.json. Each retains messages, original/effective plan, source, raw model input/output, error, first-token and total milliseconds. App source `capabilities` also carries `plan.kind=clarify`; source alone does not distinguish refusal from clarification.

## Changes

- Added bounded recognition of sending results/answers, preserving draft, quotes, negation and own-send prose. Mixed replies retain original denied clauses and actual allowed tool/help/model output. No output filtering or keyword deletion.
- Explicit replacement prefixes create an effective latest request while retaining original text in the plan. An unknown correction/cancellation is a barrier to resurrecting older actions. Utility/help followups can run actual supported utility/help; assistant claims never authorize a task. Recursion is bounded. This is a limited grammar, not general Thai intent understanding.
- Targeted clarification states external work has not happened. Production frontend/CSS/animation behavior unchanged. No success indicator is created from model prose.

## New held questions: separate failure types

Counts below concern final target turns, not all preparatory turns. Mixed routing success does not certify generated text. See the raw answers for every preparatory turn.

| Measurement | Baseline | Final | Meaning |
|---|---:|---:|---|
| Unsupported-part routing misses | 6/6 | 1/6 | Includes 4 mixed and 2 action requests; does not imply baseline model always promised success |
| Correct mixed dispatch | 0/4 | 3/4 | Valid tool/help split, invalid tool error preserved |
| System false refusal of supported target | 0/7 | 0/7 | 5 model tasks, help and calculator; separate from 3 ambiguous targets |
| Ambiguous targets not clarified correctly | 1/3 | 0/3 | Unknown replacement previously resurrected old button request |
| Model explicit false refusal of the supported text task | 3/5 | 2/5 | Draft and untrusted-history greeting remain; final draft is partial and also timed out |
| Model missing requested draft with irrelevant external-action refusal, separately | 1/5 | 1/5 | h-no-result refuses sending and repeats the requested draft instruction; does not explicitly refuse drafting |
| Model explicit false completed-action claim in these target outputs | 0/5 | 0/5 | Narrow observed sample, not a guarantee |
| Completed correct valid calculator target | 0/3 | 2/3 | /calc 90 / 3 + 7 = 37; corrected /calc 63 - 24 = 39 |
| Target request error | 0/16 | 1/16 | Final h-draft-own aborted at 30,273ms (numeric AbortSignal TimeoutError code23) |

Remaining held failure `h-result-team`: `/calc 48 + 6 แล้วส่งผลการคำนวณให้ทีม` stays one model-plan clause for the send portion because the task-word heuristic treats คำนวณ as a text task; calculator receives the unsplit suffix and rejects it. There is no system acknowledgment that sending was not done and the allowed arithmetic result is lost. Do not call the send-result problem fully solved. It is recorded for a future fresh-development round.

Help correction `h-correct-help` becomes bounded system instructions; calculator correction `h-correct-calc` becomes an actual tool result. Unknown replacement, cancellation and bare go all ask targeted clarification. `h-negated-change` correctly refuses actual sending after cancelling draft. `h-assistant-not-authority` still routes only from user greeting but the model falsely refuses it.

Other model quality failures remain: quote translation returns `"Send the result"` and omits the friend; latest birthday request returns thanks for writing a wish rather than a wish. h-no-result repeats/refuses instead of drafting. Final h-draft-own has refusal text plus timeout. A better route does not establish usable Thai assistance.

Main final holdout overlapped browser/build activity on the same small CPU/RAM host. It is retained unchanged, including timeout; times are real measurements but not an isolated speed comparison. No latency improvement claim. Baseline/final real dialogue assistant histories differ intentionally as produced; model causality is investigated separately using identical frozen histories.

Development: all 12 target routes match intended source/clarification. d-draft-only retains output_limit in both baseline/final; no generated draft. This was not hidden or solved with a canned general response.

## Animation diagnosis and stronger test

The unchanged original landing assertion failed twice: it sampled `getAnimations()` after click/open/focus host round trips. Diagnostics observed real opacity/transform transitions ending at elapsedTime 0.26 and opening style moving from opacity0/scale.96 to opacity1/scale1. Event-only normal sample arrived 287ms after open; offscreen sample 73ms; intentionally delayed samples at 746/552ms had no running animations despite real transition events. Dense-frame/style diagnostics may affect rendering and are marked accordingly. Data: animation-baseline.json, animation-passive.json, animation-events-only.json; scripts/animation-audit.mjs reproduces event-only diagnosis to a NEW output path.

Evidence supports a late-observation test problem, magnified by host/WebGL load, rather than missing CSS animation in this installed Chromium run. It does not measure physical GPU FPS or rule out every animation defect/device. Production animation, durations and WebGL were not changed or disabled.

Landing/workspace tests now observe actual transitionrun/end before click, require both opacity and transform runtime duration260, opacity below1 at start, actual end0.26 and final open opacity1/identity transform. All existing focus/Escape/reopen/layout assertions remain. Negative controls with transition:none and700ms must fail the same assertion; both passed. This is stronger than checking only a CSS declaration or a late running-animation sample.

Initial edit diagnostics included missing test-helper import and a TypeScript duration union error; repaired without assertion changes, checked again. Related 16 tests passed. First full run:71 pass/1 fail/2 opt-in skips, on fallback-renderer readiness while build ran concurrently (local-first-tests.txt, trace kept ignored locally). This failure is retained; sequential final verification below determines current status.

## Verification and delivery

- Final sequential default suite: 72 PASS / 2 installed-model opt-in SKIP (2.7m), local-final-tests.txt. Related 16 PASS earlier. Landing actual animation observed repeatedly; negative controls remain strict. The extra unrelated attachment observer was removed; affected attachment test rechecked PASS. No production retuning after holdout.
- Installed qwen3:0.6b browser send/followup/stop/upstream cancel/frozen partial/retry/no duplicate PASS (27.8s), chat switching/isolation/source preservation PASS (5.7s); full opt-in run45.8s. Raw ollama-live.json / ollama-switch.json. This certifies transport only: retry raw output gives a list of addition questions instead of answering2+3; not a mathematical-quality pass. Controlled outage verifies error/retry labels, not a claim of actual service failure.
- Frontend/backend builds and lint PASS after final test-helper repair. Frontend production source/assets unchanged. Existing chunk-size warning retained, no warning threshold changes.
- Actual restored backend is ready on127.0.0.1:8787, default0.6b; frontend5173 and Ollama11434 also loopback. Restored actual app verifies mixed53/no send, corrected help/do, unknown clarification/do, time midnight rollover, division-by-zero, invalid time and /help. restored-app-ready.json. No secrets/.env/PID files/screenshots/traces staged.
- Actual desktop1440x900, mobile390x844, short360x480 screenshots inspected: new clarification and source/status wrap without horizontal overflow; composer/buttons visible. Also inspected installed-model partial/retry/switch images. Images/traces retained in ignored .tools/routing-images / routing-first-tests. No physical mobile-device claim.
- Separate experiment completed: identical histories verified by SHA for all fixed pairs; actual dialogues separately retained. Candidate NOT promoted: old fixed refusals2/4→0/4 but output_limit0/4→1/4; new fixed direct-model false completion1/2→0/2 yet clear refusal0/2 both; live draft output_limit0/4→2/4 across all dialogue turns. Candidate also mixed Vietnamese into Thai translation. Full separate model-experiment/RESULTS.md, PLAN, frozen hash, development and held raw results. Production prompt unchanged.
- Tested implementation/results de507a9c9726bb43640dc53bc1a3ad851eb35ccd committed and pushed. CI/Pages https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/37209420882 SUCCESS: lint, frontend/backend build, default tests and frontend-only deploy. ci.json preserves actual job/step conclusions; installed-model tests are separate, never downloaded/run in CI.
- Post-deploy actual public browser demo desktop/mobile/controls/reload/WebGL PASS with no page/console/asset errors. public-demo.json confirms cannot enable local backend and no127.0.0.1/localhost/Ollama requests throughout flows. HTTP200; index-BkgBqIaQ.js SHA256 1D013A85E132DD799DF0B5EDE006479C6F474D06D3E8B3339CD5692DEAC14B87 matches local build after successful deployment (public-asset-hash.json). Public frontend assets unchanged; backend not published.
- final-readiness.json confirms production freeze unchanged, backend ready/default0.6b and all listeners loopback; free RAM1,934,432KiB at that check. Local backend left running. Final documentation checkpoint uses [skip ci], tested implementation remains de507a9. Round complete; no pending model pull/test/push or automatic followup created. Completion is reported in chat; no native popup delivery claimed.

## Remaining scope and next choices

Keep default0.6b and production prompt. Next round should add fresh development/holdout pairs for task words inside actual-send objects (the result-of-calculation failure), before widening grammar. Prompt experiment raw refusals/claims must be assessed separately; don't promote on total score alone. General Thai, role, instruction-following and capability honesty remain unaccepted. No real-device/Safari/Firefox/screen-reader claim.
