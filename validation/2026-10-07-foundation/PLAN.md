# 2026-10-07: capability foundation, before implementation

Start fe686c6, clean and origin/main equal. No AGENTS.md in repository or checked D: parents. Preserve original production model/prompt; no downloads, paid calls, external user-data transfers, training or public backend. Approval cards pending: architecture and first capability. Complete routing defect and common tool lifecycle while waiting; do not start several capabilities.

## Acceptance fixed before edits
- Development: 12 synthetic contrast/followup cases in scripts/foundation-cases.json. Every requested allowed calculation must survive mixed sending requests; denied sending must be explicit. Draft/translation/instructions must not be system-refused. Original denied text is retained.
- Regression: prior tests and the previous h-result-team failure. New held set: 12 different questions in same frozen file. Run once after final code freeze; no tuning from its outcomes or claiming it remains unseen next time. Separate routing from actual model text quality.
- Tool foundation: strict registered IDs/inputs/results; no arbitrary shell/URL/model-authored tool execution. Bounded input/output and timeout; propagate abort; ignore late completion. Existing calculator/time results and provenance preserved. Invalid/unknown/oversized/malformed/timeout/abort covered.
- Browser: original send-result failure yields 54 and explicit unsent status; draft stays model; latest corrections respected; desktop1440x900/mobile390x844/short360x480, stop/retry/switch regression. No public local-backend connection. Model smoke judged as transport, never a Thai-quality pass.
- Build/lint/tests sequential because resources are constrained. Record failures. Commit only related reviewed files; final CI/demo verification if frontend changes. Restore local backend/frontend and readiness.

## Audit snapshot
i5-7500 4 cores/4 threads; Intel HD Graphics630. RAM visible8270012KiB, free704624KiB (~688MiB) at audit. C free195479605248 bytes; D free996464259072 bytes. Only Ollama11434 listening, loopback. Ollama0.35.1, qwen3:0.6b and qwen3:1.7b installed. Both failed general Thai acceptance in earlier controlled trial; no reason to repeat unbounded prompt tuning. CPU throughput/RAM are current limits, storage is not.

Bundled Node/Python/Playwright/PptxGenJS/python-pptx/Pillow exist; PowerPoint executable exists (automation/render not tested). Stockfish, chess library, FFmpeg/ffprobe not found on PATH or project tools; not proof absent everywhere. No installed chess engine or media pipeline in CIC. Existing app: local text streaming, bounded exact calculator/time, system help, isolated demo, abort/retry and truthful source labels. No delivered chess/slides/video/game solver capability.

## Direction and fine-tuning
Recommend specialized local tools first; maintain model as experimental explanation only. Hybrid external AI may help Thai but needs explicit provider/data/budget selection; strong local model needs more resources. No exact external price quoted before provider choice. Current evidence does not justify fine-tuning: solve routing/tool correctness first, then reassess a fixed real-task corpus. Any later training proposal must specify licensed/consented Thai data, deduplication and separate held-out tasks, hardware/budget and comparison against the untrained base. No training now.
