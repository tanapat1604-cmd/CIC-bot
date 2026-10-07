import { test, expect } from '@playwright/test'
import { Chess } from 'chess.js'
import { once } from 'node:events'
import { createChatServer } from '../backend/server'
import { createChessEngine } from '../backend/chessEngine'
import { enginePosition, explainResult, exportPgn, gameStatus, parseChessRequest, parseGame, uciMove, validateChessResult, type ChessRequest, type ChessResult } from '../shared/chess'

const input = (pgn = ''): ChessRequest => ({ gameId: 'game-1', requestId: crypto.randomUUID(), pgn, level: 'hard', analysis: true })
test('standard perft start and Kiwipete match known counts through depth three', () => {
  const start = new Chess(), kiwi = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
  expect([1, 2, 3].map(d => start.perft(d))).toEqual([20, 400, 8902])
  expect([1, 2, 3].map(d => kiwi.perft(d))).toEqual([48, 2039, 97862])
})
test('castling both wings and attacked transit squares', () => {
  const clear = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
  expect(clear.moves()).toEqual(expect.arrayContaining(['O-O', 'O-O-O']))
  clear.move('O-O'); expect(clear.get('f1')?.type).toBe('r'); expect(clear.get('g1')?.type).toBe('k')
  clear.move('O-O-O'); expect(clear.get('d8')?.type).toBe('r')
  const attacked = new Chess('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1')
  expect(attacked.moves()).not.toContain('O-O'); expect(attacked.moves()).toContain('O-O-O')
})
test('en passant and pinned en passant; all four promotion choices', () => {
  const ep = new Chess(); for (const m of ['e4', 'a6', 'e5', 'd5']) ep.move(m)
  expect(ep.move('exd6').isEnPassant()).toBe(true); expect(ep.get('d5')).toBeUndefined()
  const pinned = new Chess('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
  expect(pinned.moves()).not.toContain('exd6')
  for (const promotion of ['q', 'r', 'b', 'n']) {
    const game = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1')
    game.move({ from: 'a7', to: 'a8', promotion }); expect(game.get('a8')?.type).toBe(promotion)
  }
})
test('check mate stalemate insufficient material repetition and fifty moves', () => {
  const game = new Chess(); for (const m of ['f3', 'e5', 'g4', 'Qh4#']) game.move(m)
  expect(game.isCheck()).toBe(true); expect(gameStatus(game)).toContain('ดำชนะ')
  expect(gameStatus(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toContain('ไม่มีตาเดิน')
  expect(gameStatus(new Chess('7k/8/8/8/8/8/8/K7 w - - 0 1'))).toContain('ตัวหมากไม่พอ')
  const repetition = new Chess(); for (let i = 0; i < 2; i++) for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) repetition.move(m)
  expect(gameStatus(repetition)).toContain('ซ้ำสามครั้ง')
  expect(parseGame(repetition.pgn(), 'pgn').isThreefoldRepetition()).toBe(true)
  expect(enginePosition(repetition)).toContain('g1f3 g8f6 f3g1 f6g8')
  expect(gameStatus(new Chess('7k/8/8/8/8/8/R7/K7 w - - 100 60'))).toContain('50 ตา')
})
test('strict FEN PGN import roundtrip and invalid data do not become commands', () => {
  const game = new Chess(); ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'].forEach(m => game.move(m))
  expect(parseGame(game.pgn(), 'pgn').fen()).toBe(game.fen())
  expect(parseGame(game.fen(), 'fen').fen()).toBe(game.fen())
  for (const fen of ['', 'garbage', '7k/8/8/8/8/8/8/K7 w K - 0 1', '8/8/8/8/8/8/8/8 w - - 0 1', '7k/7K/8/8/8/8/8/8 w - - 0 1']) expect(() => parseGame(fen, 'fen')).toThrow()
  for (const pgn of ['1. e4 e5 2. Ke4', 'garbage', '1. e4\nquit']) expect(() => parseGame(pgn, 'pgn')).toThrow()
  for (const value of [null, { ...input(), path: 'evil' }, { ...input(), level: 'shell' }, { ...input(), pgn: 'a'.repeat(32001) }, { ...input(), gameId: 'x\nquit' }]) expect(() => parseChessRequest(value)).toThrow()
})
test('explanations use legal facts and score with white perspective, never model', () => {
  const result: ChessResult = { ...input(), fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', engine: 'Stockfish 19', move: 'g6g7', san: 'Qg7#', pv: ['Qg7#'], depth: 8, score: { type: 'mate', value: 1, bound: 'exact' }, elapsedMs: 100, thinkMs: 1000 }
  expect(explainResult(result)).toContain('เป็นรุกฆาต'); expect(explainResult(result)).toContain('ขาวมีแนวรุกฆาตใน 1')
  expect(() => uciMove(new Chess(), 'e2e5')).toThrow()
})
test('exported PGN carries terminal result and imports starting side/fullmove; bad result payloads rejected', () => {
  const mate = new Chess(); ['f3', 'e5', 'g4', 'Qh4#'].forEach(m => mate.move(m))
  expect(exportPgn(mate)).toContain('[Result "0-1"]'); expect(parseGame(exportPgn(mate), 'pgn').isCheckmate()).toBe(true)
  const draw = parseGame('7k/8/8/8/8/8/8/K7 w - - 0 1', 'fen'); expect(exportPgn(draw)).toContain('[Result "1/2-1/2"]')
  const black = parseGame('7k/8/8/8/8/8/R7/K7 b - - 0 35', 'fen'); black.move('Kg8'); expect(exportPgn(black)).toContain('35. ... Kg8'); expect(parseGame(exportPgn(black), 'pgn').fen()).toBe(black.fen())
  expect(() => parseGame('7k/8/8/8/8/8/8/K7 w - d6 0 1', 'fen')).toThrow()
  const req = input(), fen = new Chess().fen(), valid = { gameId: req.gameId, requestId: req.requestId, fen, engine: 'Stockfish 19', move: 'e2e4', san: 'e4', pv: ['e4'], depth: 1, score: { type: 'cp', value: 23, bound: 'exact' }, elapsedMs: 50, thinkMs: 1000 }
  expect(validateChessResult(valid, req, fen).score?.value).toBe(23)
  for (const bad of [{ ...valid, score: { type: 'cp', value: 'huge', bound: 'exact' } }, { ...valid, gameId: 'old' }, { ...valid, pv: ['e4', 'e5', 'Ke4'] }, { ...valid, move: 'e2e5' }, { ...valid, thinkMs: 99999 }]) expect(() => validateChessResult(bad, req, fen)).toThrow()
})
test('chess API preserves auth, strict inputs, errors and disconnect cancellation independent of model', async () => {
  let calls = 0, aborted = false
  const engine = { status: () => ({ ready: true, busy: false, engine: 'Stockfish 19', threads: 1, hashMiB: 16, freeMiB: 800, location: 'local' }), run: async (_: ChessRequest, signal: AbortSignal): Promise<ChessResult> => { calls++; return new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(Error('stopped')) }, { once: true })) } }
  const server = createChatServer({ chess: engine, provider: { kind: 'live', check: async () => { throw Error('no Ollama') }, async *stream() { yield 'not used' } } }); server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`, origin = 'http://127.0.0.1:4173'
  try {
    expect((await (await fetch(url + '/chess/status')).json()).ready).toBe(true)
    const auth = await fetch(url + '/session', { method: 'POST', headers: { Origin: origin } }), cookie = auth.headers.get('set-cookie')!.split(';')[0]
    const post = (value: unknown, headers = {}, signal?: AbortSignal) => fetch(url + '/chess/analyze', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value), signal })
    expect((await post(input(), { Cookie: '' })).status).toBe(401)
    expect((await post(input(), { Origin: 'https://evil.example' })).status).toBe(403)
    expect((await post({ ...input(), executable: 'bad' })).status).toBe(400); expect(calls).toBe(0)
    const abort = new AbortController(), pending = post(input(), {}, abort.signal).catch(() => null)
    await expect.poll(() => calls).toBe(1); expect((await post(input())).status).toBe(429)
    abort.abort(); await pending; await expect.poll(() => aborted).toBe(true)
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
test('actual Stockfish validates moves, cancels, times out and releases single-job lock', async () => {
  test.skip(process.env.CIC_CHESS_LIVE !== '1', 'official local executable opt-in')
  const engine = createChessEngine()
  const result = await engine.run(input(), new AbortController().signal)
  expect(result.engine).toBe('Stockfish 19'); expect(() => uciMove(new Chess(), result.move)).not.toThrow(); expect(result.score).not.toBeNull()
  const abort = new AbortController(), job = engine.run(input(), abort.signal)
  await expect(engine.run(input(), new AbortController().signal)).rejects.toMatchObject({ code: 'busy' })
  abort.abort(); await expect(job).rejects.toMatchObject({ code: 'cancelled' }); expect(engine.status().busy).toBe(false)
  await expect(createChessEngine(undefined, 1).run(input(), new AbortController().signal)).rejects.toMatchObject({ code: 'timeout' })
  expect((await engine.run(input(), new AbortController().signal)).move).toBeTruthy()
})
