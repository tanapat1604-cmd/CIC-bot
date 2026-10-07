// Run only with the user-approved official Stockfish installed locally.
import { Chess } from 'chess.js'
import { createChessEngine } from '../.backend-build/backend/chessEngine.js'
import { uciMove } from '../.backend-build/shared/chess.js'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { freemem } from 'node:os'

const dir = 'validation/2026-10-07-chess'
mkdirSync(dir, { recursive: true })
const files = ['backend/chessEngine.ts', 'shared/chess.ts', 'src/chess/ChessPage.tsx', 'scripts/chess-evaluate.mjs', `${dir}/PLAN.md`]
const freeze = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]))
writeFileSync(`${dir}/evaluation-freeze.json`, JSON.stringify({ at: new Date().toISOString(), files: freeze }, null, 2))
const engine = createChessEngine(), signal = new AbortController().signal
const results = { at: new Date().toISOString(), config: engine.status(), freeMiB: Math.floor(freemem() / 1048576), tactics: [], matches: [] }
const run = (game, level, analysis = false) => engine.run({ gameId: 'evaluation', requestId: crypto.randomUUID(), pgn: game.pgn(), level, analysis }, signal)
for (const fen of ['6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1']) {
  const game = new Chess(fen), result = await run(game, 'hard', true)
  uciMove(game, result.move); results.tactics.push({ fen, result, checkmate: game.isCheckmate() })
  writeFileSync(`${dir}/evaluation.json`, JSON.stringify(results, null, 2))
}
for (const strongColor of ['w', 'b']) {
  const game = new Chess(), moves = [], started = Date.now()
  while (!game.isGameOver() && moves.length < 160) {
    const level = game.turn() === strongColor ? 'hard' : 'easy', result = await run(game, level)
    uciMove(game, result.move); moves.push({ level, ...result })
    if (moves.length % 20 === 0) console.log(JSON.stringify({ strongColor, ply: moves.length, elapsedMs: Date.now() - started }))
  }
  const outcome = game.isCheckmate() ? (game.turn() === strongColor ? 'strong-loss' : 'strong-win') : game.isDraw() ? 'draw' : 'unfinished-at-160-ply'
  for (const [key, value] of Object.entries({ Event: 'CIC bounded local engine evaluation', White: strongColor === 'w' ? 'Stockfish19 Skill20 800ms' : 'Stockfish19 Skill0 150ms', Black: strongColor === 'b' ? 'Stockfish19 Skill20 800ms' : 'Stockfish19 Skill0 150ms', Result: game.isCheckmate() ? game.turn() === 'w' ? '0-1' : '1-0' : game.isDraw() ? '1/2-1/2' : '*' })) game.setHeader(key, value)
  writeFileSync(`${dir}/match-strong-${strongColor}.pgn`, game.pgn())
  results.matches.push({ strongColor, outcome, plies: moves.length, durationMs: Date.now() - started, finalFen: game.fen(), moves })
  writeFileSync(`${dir}/evaluation.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ strongColor, outcome, plies: moves.length }))
}
console.log(JSON.stringify({ tactics: results.tactics.map(t => t.checkmate), matches: results.matches.map(m => ({ outcome: m.outcome, plies: m.plies })) }))
