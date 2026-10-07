import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { freemem } from 'node:os'
import { resolve } from 'node:path'
import { Chess } from 'chess.js'
import { LEVELS, enginePosition, gameFromRequest, uciMove, type ChessRequest, type ChessResult } from '../shared/chess.js'

export class EngineError extends Error { constructor(public code: 'unavailable' | 'busy' | 'memory' | 'timeout' | 'invalid' | 'cancelled') { super(code) } }
export type ChessEngine = ReturnType<typeof createChessEngine>
export function createChessEngine(path = process.env.STOCKFISH_PATH ?? resolve('.tools/stockfish19/package/stockfish/stockfish-windows-x86-64-universal.exe'), hardTimeoutMs = 10000) {
  let busy = false
  return {
    status: () => ({ ready: existsSync(path), busy, engine: 'Stockfish 19', threads: 1, hashMiB: 16, freeMiB: Math.floor(freemem() / 1048576), location: 'local' }),
    async run(request: ChessRequest, signal: AbortSignal): Promise<ChessResult> {
      signal.throwIfAborted()
      if (busy) throw new EngineError('busy')
      if (!existsSync(path)) throw new EngineError('unavailable')
      if (freemem() < 256 * 1048576) throw new EngineError('memory')
      const game = gameFromRequest(request)
      if (game.isGameOver()) throw new EngineError('invalid')
      busy = true
      const start = Date.now(), thinkMs = request.analysis ? 1000 : LEVELS[request.level].ms
      try {
        return await new Promise<ChessResult>((resolveResult, reject) => {
          const child = spawn(path, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false })
          let buffer = '', total = 0, phase = 'uci', name = '', depth = 0, score: ChessResult['score'] = null, pv: string[] = [], result: ChessResult | undefined, failure: Error | undefined, killTimer: ReturnType<typeof setTimeout> | undefined
          const send = (command: string) => { if (!child.stdin.destroyed) child.stdin.write(command + '\n') }
          const finish = (error?: Error) => {
            if (phase === 'closing') return
            failure = error; phase = 'closing'; send('stop'); send('quit')
            killTimer = setTimeout(() => child.kill(), 250)
          }
          const abort = () => finish(new EngineError('cancelled'))
          const timer = setTimeout(() => finish(new EngineError('timeout')), hardTimeoutMs)
          signal.addEventListener('abort', abort, { once: true })
          child.stdin.on('error', () => finish(new EngineError('unavailable')))
          child.on('error', () => finish(new EngineError('unavailable')))
          child.stderr.on('data', () => {})
          child.stdout.setEncoding('utf8')
          child.stdout.on('data', (chunk: string) => {
            total += chunk.length; buffer += chunk
            if (total > 512000 || buffer.length > 64000) { finish(new EngineError('unavailable')); return }
            let newline: number
            while ((newline = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1)
              if (phase === 'closing') continue
              if (line.startsWith('id name ')) name = line.slice(8)
              if (line === 'uciok' && phase === 'uci') {
                if (!/^Stockfish 19(?:\s|$)/.test(name)) { finish(new EngineError('unavailable')); continue }
                send('setoption name Threads value 1'); send('setoption name Hash value 16'); send('setoption name MultiPV value 1'); send(`setoption name Skill Level value ${request.analysis ? 20 : LEVELS[request.level].skill}`); send('isready'); phase = 'ready'
              } else if (line === 'readyok' && phase === 'ready') { send(enginePosition(game)); send(`go movetime ${thinkMs}`); phase = 'thinking' }
              else if (phase === 'thinking' && line.startsWith('info ') && /\bmultipv 1\b/.test(line)) {
                const evaluation = /\bscore (cp|mate) (-?\d+)(?: (lowerbound|upperbound))?/.exec(line)
                const variation = /\bpv (.+)$/.exec(line)
                if (!evaluation || !variation) continue
                try {
                  const copy = new Chess(game.fen()), moves = variation[1].split(' ').slice(0, 12).map(move => uciMove(copy, move).san)
                  const sign = game.turn() === 'w' ? 1 : -1
                  let bound = (evaluation[3] ?? 'exact') as NonNullable<ChessResult['score']>['bound']
                  if (sign === -1 && bound !== 'exact') bound = bound === 'lowerbound' ? 'upperbound' : 'lowerbound'
                  depth = Number(/\bdepth (\d+)/.exec(line)?.[1] ?? 0); score = { type: evaluation[1] as 'cp' | 'mate', value: Number(evaluation[2]) * sign, bound }; pv = moves
                } catch { finish(new EngineError('unavailable')) }
              } else if (phase === 'thinking' && line.startsWith('bestmove ')) {
                try {
                  const move = line.split(' ')[1], san = uciMove(new Chess(game.fen()), move).san
                  // Weak-skill selected move may differ from the principal variation.
                  if (pv[0] !== san) { score = null; pv = [] }
                  result = { gameId: request.gameId, requestId: request.requestId, fen: game.fen(), engine: name, move, san, pv, depth, score, elapsedMs: Date.now() - start, thinkMs }
                  finish()
                } catch { finish(new EngineError('unavailable')) }
              }
            }
          })
          child.once('close', () => {
            clearTimeout(timer); clearTimeout(killTimer); signal.removeEventListener('abort', abort)
            if (signal.aborted) reject(new EngineError('cancelled'))
            else if (failure || !result) reject(failure ?? new EngineError('unavailable'))
            else resolveResult(result)
          })
          send('uci'); if (signal.aborted) abort()
        })
      } finally { busy = false }
    },
  }
}
