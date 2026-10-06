# Capability foundation — 2026-10-07

## Delivered scope / pending choice
Stages1–2: close the known calculation-result sending defect and add a validated common runner for existing exact calculator/time tools. Settings shows available/experimental/unsupported capabilities. First new capability has NOT been selected yet; no chess, slides, video or solver implementation claimed. Two question cards await architecture and first capability. No downloads, model/prompt changes, training, paid API, transfer of user files or public backend. Notification via this chat/cards only.

Start fe686c6 clean and synced. Audit/alternatives/fine-tuning assessment: [CAPABILITY-ROADMAP.md](../../CAPABILITY-ROADMAP.md). Acceptance was frozen in PLAN.md before edits. Cases in scripts/foundation-cases.json; baseline source archived as .ts.txt. FINAL-FREEZE.json records production/case hashes before held evaluation. No tuning after held results.

## Routing / tool correctness (not model quality)
Development: baseline8/12→final12/12. The four misses were actual send requests whose object included คำนวณ, including mixed valid/invalid calculation and latest-action followup. The fix compares send/task positions in quote-masked clauses: a task word inside the object no longer authorizes sending; a preceding drafting/translation request remains a text task. Negation, own-send and user-only followup boundaries remain. This is bounded grammar, not general intent understanding and not external-action authorization.

New held set12/12 passed on the frozen code. Mixed calculations50,33 and midnight rollover came from local tools; invalid exponent request retained its tool error plus unsent status. Draft/instructions/quoted/negated supported tasks were not system-refused. Latest corrected text/action/cancellation paths matched the frozen expectations. Raw final-holdout.json includes text, plan, sources, tool/model call count and elapsed time. This result does not certify all phrasing or generated text; these cases become regression, not a reusable unseen benchmark.

Common runner: allowlisted tool IDs, strict input/result shape and length, source supplied by registry, timeout and upstream AbortSignal; no shell/URL/path/model-generated execution. Tests cover invalid input, unknown tool, internal-error sanitization, malformed/oversized output, timeout, caller abort and late completion suppression. Exact decimal/rational math and time parsing are reused. Existing auth/session/Origin/loopback/limits/NDJSON preserved. Bound synchronous arithmetic cannot be preempted by a timer during its execution; its work is bounded. Future engine/media subprocesses need real process stop/kill verification.

## Actual model audit — failures retained
MODEL-PLAN.json fixed five tasks/seven turns before running. model-audit.json holds actual submitted histories, source, unfiltered answers and times. Original qwen3:0.6b/prompt/settings unchanged. No new prompt experiment.

| Task/turn | Actual result | Assessment |
|---|---|---|
| Thai meeting draft10→11 | Includes correct times but repeats confirmation and adds inability to proceed at the specified time | FAIL usable draft |
| Correct to13:00, no confirmation | Correct time13:00 but still asks confirmation and repeats irrelevant inability | FAIL latest constraint |
| English budget draft byFriday | Only “Do not send it.” | FAIL missing draft |
| Rewrite forMonday | “Please review the budget by Monday.” | PASS this short rewrite |
| Unknown cash in user's pocket | “ไม่รู้” | PASS admits unavailable fact |
| Unknown number on nearby paper | Says cannot know the exact number | PASS no invented number/vision claim in this case |
| /calc (125-45)/4 then send result |20 with explicit unsent clause, modelCalls0 | PASS SYSTEM/TOOL, not model reasoning |

No aggregate score used to mask drafting failures. Observed model times7287/3286/518/628/534/784ms, tool6ms; one run, mixed cache/cold effects and uncontrolled background apps, not a throughput/RAM guarantee. No timeouts in this small model audit. Prior failures still apply. General Thai assistance remains experimental, and even English drafting is not reliably accepted. Tools improve verifiable tasks, not the model's general reasoning.

## Verification
- Frontend/backend builds and lint passed. Default suite77PASS/2 real-model opt-inSKIP (1.9m), including browser stop/retry/switch/no duplicates, source validation, actual animations/WebGL, desktop/mobile/short layouts.
- Related initial run26PASS/1FAIL: newly written English mixed-case test incorrectly required the Thai refusal label; actual answer had correct English refusal and56. Corrected only that bilingual expectation, kept refusal and model-call assertions. Focused5/5 passed, then full suite above passed. No production change from this failure.
- New Settings dialog and composer checked at1440x900,390x844,360x480. Inspected mobile/short screenshots in .tools/foundation-images; dialog scrolls, Escape closes, no horizontal overflow, composer visible after closing. No physical-device/Safari/Firefox/screen-reader verification.
- Actual installed-model browser tests2/2PASS (23.0s): send/followup/stop/upstream abort/retry/no duplicate and chat-switch isolation. These certify transport, not the correctness of raw model arithmetic. Evidence ollama-live.json/ollama-switch.json and model-browser-tests.txt. Restored actual app verified54+unsent, help/correction/clarification/time/errors, healthy0.6b and127.0.0.1 listeners at5173/8787/11434. readiness.json confirms production/cases unchanged after freeze. Final lint including diagnostics passed. CI/public demo pending final checkpoint.

## Next
Wait for the user to choose architecture and FIRST new capability from the cards. Local specialized tools are recommended, chess is the suggested first milestone. Any missing engine/dependency download or external data/cost requires a concrete separate choice/authorization. For slides need a content/design brief; for video need input files and edit/generation scope; for puzzles choose rules. Stop unbounded prompt tuning. Read WORK-PROGRESS.md for final commit/CI/readiness.

## Final delivery

Stages1–2 delivered: code c8d75e04fb57473b15e3d273610e0db2e8f4a423 pushed; CI https://github.com/tanapat1604-cmd/CIC-bot/actions/runs/37547518626 SUCCESS (lint/builds/default tests/frontend-only deploy). Actual public demo desktop/mobile/controls/reload/WebGL PASS, no page/console/asset errors or localhost/Ollama requests; asset /CIC-bot/assets/index-Bp3ilC9k.js matches local build. Local app restored and ready0.6b on loopback. No model/prompt changes, downloads, external AI or training. First new capability and architecture remain awaiting user selection; do NOT start several capabilities or treat no reply as approval.

Inspected actual public desktop/mobile screenshots. ci.json and public-demo.json preserve job/flow evidence; code hashes in readiness.json remained unchanged after the held set. Final docs checkpoint uses [skip ci]; tested implementation remains c8d75e0. Browser model retry completed but raw reply is a list of arithmetic questions, not a correct2+3 answer; it is deliberately not a reasoning-quality pass.
