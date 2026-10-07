# Chess acceptance — frozen before implementation, 2026-10-07

User selected local specialized tools and chess first; approved official Stockfish and chess.js. No AI model download, paid API, external data or public backend. Baseline fad54a3, clean except engine-download evidence. Free RAM 888532 KiB at audit (not a guarantee).

## Acceptance
- Rules: start perft depths 1–3 = 20/400/8902; Kiwipete 48/2039/97862. Legal castling, attacked castling blocked, en passant including pinned pawn, all four promotions, checkmate, stalemate, insufficient material, repetition and fifty-move policy. Reject invalid FEN/PGN; export and reimport same position/history.
- Engine: official Stockfish19 SHA256 verified, Threads1/Hash16, skill0/8/20 with 150/350/800ms (analysis1000ms). Fresh process only on explicit chess use; quit after each request. Hard timeout, one engine job, cancellation reaches child and exits, stale response never changes game. All best/PV moves verified legally; score source, perspective, bound and depth displayed. No LLM calls/explanation inventions.
- Access: existing loopback/Host/Origin/session trust boundary, bounded request/response sizes and rate/concurrency. Public site cannot call local backend. Chess availability independent of Ollama.
- UI: play either side, new game, stop/resume/retry, FEN/PGN controls, analysis; desktop1440x900/mobile390x844/short360x480 inspect screenshots, no overflow; change game/route during thinking safe.
- Regression: existing tests unchanged, new rules/protocol/lifecycle/browser tests, lint and both builds; actual local engine browser evidence separately from fixture tests. No FPS/Elo claim.

## Evaluation separation
Development: starting position, Fool's mate, standard special rules and mate-in-one white kingf6 queen g6 / black kingh8.
New evaluation (do not tune from results): mate tactics FEN 6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1 and 7k/5Q2/6K1/8/8/8/8/8 w - - 0 1. Verify returned move actually checkmates, preserve failures. These are new to this project, not claimed absent from engine training.
Matches: two games, swap colors, Stockfish19 skill20 800ms vs same engine skill0 150ms; Threads1 Hash16 fresh process each ply, max160 plies. Record PGN/moves/time/outcome; unfinished at cap is unfinished, not a draw or win. No invented rating.

## Distribution
Stockfish executable remains ignored under .tools, never in Pages/repository; preserve full official archive including GPLv3 Copying.txt, AUTHORS and source. Any future binary redistribution requires corresponding exact source and applicable GPL obligations review. chess.js1.4.0 BSD-2-Clause notice retained with frontend distribution. No claim process boundary waives licenses.

Pending implementation/testing: this plan is not a result. Explain only SAN/PV/check/capture/promotion and recorded score; no invented positional rationale. Draw policy: CIC auto-ends at chess.js threefold/fifty-move conditions (casual play policy, not tournament claim workflow). FEN cannot encode earlier repetition history; PGN can. No clocks, undo, persistence or Chess960 in this round.
