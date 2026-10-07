import { Chess, DEFAULT_POSITION, type Square } from 'chess.js'

export const LEVELS = { easy: { label: 'ฝึกเล่น', skill: 0, ms: 150 }, medium: { label: 'ปานกลาง', skill: 8, ms: 350 }, hard: { label: 'เต็มกำลังตามเวลาที่จำกัด', skill: 20, ms: 800 } } as const
export type Level = keyof typeof LEVELS
export type ChessRequest = { gameId: string; requestId: string; pgn: string; level: Level; analysis: boolean }
export type ChessResult = { gameId: string; requestId: string; fen: string; engine: string; move: string; san: string; pv: string[]; depth: number; score: { type: 'cp' | 'mate'; value: number; bound: 'exact' | 'lowerbound' | 'upperbound' } | null; elapsedMs: number; thinkMs: number }
export function parseGame(text: string, format: 'fen' | 'pgn'): Chess {
  if (!text.trim() || text.length > 32000) throw Error('ข้อมูลว่างหรือยาวเกิน 32,000 ตัวอักษร')
  const game = new Chess()
  if (format === 'fen') {
    if (text.length > 120 || /[\r\n]/.test(text)) throw Error('FEN ไม่ถูกต้อง')
    game.load(text.trim())
    const fields = text.trim().split(/\s+/)
    if (new Set(fields[2]).size !== fields[2].length) throw Error('สิทธิ์เข้าป้อมซ้ำ')
    if (fields[3] !== '-') {
      const file = fields[3][0], whiteTurn = fields[1] === 'w'
      const pawn = game.get(`${file}${whiteTurn ? '5' : '4'}` as Square)
      if (!pawn || pawn.type !== 'p' || pawn.color !== (whiteTurn ? 'b' : 'w') || game.get(fields[3] as Square) || game.get(`${file}${whiteTurn ? '7' : '2'}` as Square)) throw Error('ช่อง en passant ไม่ตรงกับเบี้ยที่เพิ่งเดิน')
    }
  } else {
    game.loadPgn(text, { strict: true })
    const initial = game.history({ verbose: true })[0]?.before ?? game.fen()
    parseGame(initial, 'fen')
  }
  // Syntax alone does not establish a playable orthodox position.
  const board = game.board().flat().filter(piece => piece !== null)
  for (const color of ['w', 'b'] as const) {
    const pieces = board.filter(piece => piece.color === color)
    if (pieces.length > 16 || pieces.filter(piece => piece.type === 'p').length > 8) throw Error('จำนวนตัวหมากเกินกติกา')
  }
  const fen = game.fen().split(' ')
  const other = new Chess([fen[0], game.turn() === 'w' ? 'b' : 'w', '-', '-', '0', '1'].join(' '))
  if (other.isCheck()) throw Error('ตำแหน่งผิดกติกา: ฝ่ายที่เพิ่งเดินยังถูกรุก')
  const castles = { K: ['e1', 'h1', 'w'], Q: ['e1', 'a1', 'w'], k: ['e8', 'h8', 'b'], q: ['e8', 'a8', 'b'] } as const
  for (const right of fen[2]) if (right !== '-') {
    const [king, rook, color] = castles[right as keyof typeof castles]
    if (game.get(king)?.type !== 'k' || game.get(king)?.color !== color || game.get(rook)?.type !== 'r' || game.get(rook)?.color !== color) throw Error('สิทธิ์เข้าป้อมไม่ตรงกับตัวหมาก')
  }
  return game
}
export function parseChessRequest(value: unknown): ChessRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid')
  const v = value as Record<string, unknown>
  if (Object.keys(v).sort().join() !== 'analysis,gameId,level,pgn,requestId' || typeof v.gameId !== 'string' || !/^[\w-]{1,64}$/.test(v.gameId) || typeof v.requestId !== 'string' || !/^[\w-]{1,64}$/.test(v.requestId) || typeof v.pgn !== 'string' || v.pgn.length > 32000 || typeof v.level !== 'string' || !Object.hasOwn(LEVELS, v.level) || typeof v.analysis !== 'boolean') throw Error('invalid')
  if (v.pgn.trim()) parseGame(v.pgn, 'pgn')
  return v as ChessRequest
}
export function gameFromRequest(request: ChessRequest) { return request.pgn.trim() ? parseGame(request.pgn, 'pgn') : new Chess() }
export function validateChessResult(value: unknown, request: ChessRequest, fen: string): ChessResult {
  if (!value || typeof value !== 'object') throw Error('unavailable')
  const v = value as Record<string, unknown>
  if (v.gameId !== request.gameId || v.requestId !== request.requestId || v.fen !== fen || v.engine !== 'Stockfish 19' || typeof v.move !== 'string' || typeof v.san !== 'string' || !Array.isArray(v.pv) || v.pv.length > 12 || !Number.isInteger(v.depth) || Number(v.depth) < 0 || Number(v.depth) > 256 || typeof v.elapsedMs !== 'number' || !Number.isFinite(v.elapsedMs) || v.elapsedMs < 0 || v.thinkMs !== (request.analysis ? 1000 : LEVELS[request.level].ms)) throw Error('unavailable')
  if (v.score !== null) {
    if (!v.score || typeof v.score !== 'object') throw Error('unavailable')
    const score = v.score as Record<string, unknown>
    if (!['cp', 'mate'].includes(String(score.type)) || !Number.isInteger(score.value) || Math.abs(Number(score.value)) > 1000000 || !['exact', 'lowerbound', 'upperbound'].includes(String(score.bound))) throw Error('unavailable')
  }
  const game = new Chess(fen)
  if (uciMove(new Chess(fen), v.move).san !== v.san) throw Error('unavailable')
  for (const san of v.pv) { if (typeof san !== 'string') throw Error('unavailable'); game.move(san, { strict: true }) }
  if (v.pv.length && v.pv[0] !== v.san || v.score !== null && !v.pv.length) throw Error('unavailable')
  return v as ChessResult
}
export function uciMove(game: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw Error('ตาเดินจาก engine ไม่ถูกต้อง')
  return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })
}
export function enginePosition(game: Chess) {
  const history = game.history({ verbose: true })
  const initial = history[0]?.before ?? game.fen()
  return `position ${initial === DEFAULT_POSITION ? 'startpos' : `fen ${initial}`} moves ${history.map(m => m.from + m.to + (m.promotion ?? '')).join(' ')}`.trim()
}
export function gameStatus(game: Chess) {
  if (game.isCheckmate()) return `รุกฆาต — ${game.turn() === 'w' ? 'ดำ' : 'ขาว'}ชนะ`
  if (game.isStalemate()) return 'เสมอ — ไม่มีตาเดินและไม่ถูกรุก'
  if (game.isInsufficientMaterial()) return 'เสมอ — ตัวหมากไม่พอรุกฆาต'
  if (game.isThreefoldRepetition()) return 'เสมอ — ตำแหน่งซ้ำสามครั้ง (กติกา CIC)'
  if (game.isDrawByFiftyMoves()) return 'เสมอ — กฎ 50 ตา (กติกา CIC)'
  return `ตา${game.turn() === 'w' ? 'ขาว' : 'ดำ'}${game.isCheck() ? ' • รุก!' : ''}`
}
export function exportPgn(game: Chess) {
  const copy = game.pgn().trim() ? parseGame(game.pgn(), 'pgn') : new Chess()
  copy.setHeader('Result', game.isCheckmate() ? game.turn() === 'w' ? '0-1' : '1-0' : game.isDraw() ? '1/2-1/2' : '*')
  return copy.pgn()
}
export function scoreText(result: ChessResult) {
  const score = result.score
  if (!score) return 'engine ไม่ส่งคะแนนที่ยืนยันได้'
  const bound = score.bound === 'lowerbound' ? 'อย่างน้อย ' : score.bound === 'upperbound' ? 'ไม่เกิน ' : ''
  if (score.type === 'mate') return `${bound}${score.value > 0 ? 'ขาว' : 'ดำ'}มีแนวรุกฆาตใน ${Math.abs(score.value)} ตา ตามการค้นหา`
  return `${bound}${score.value >= 0 ? '+' : ''}${(score.value / 100).toFixed(2)} เบี้ย (มุมมองขาว)`
}
export function explainResult(result: ChessResult) {
  const game = new Chess(result.fen), move = uciMove(game, result.move)
  const facts = [move.captured ? `กิน${pieceNames[move.captured]}` : '', move.promotion ? `เลื่อนเบี้ยเป็น${pieceNames[move.promotion]}` : '', game.isCheckmate() ? 'เป็นรุกฆาต' : game.isCheck() ? 'ทำให้ฝ่ายตรงข้ามถูกรุก' : '', move.isKingsideCastle() || move.isQueensideCastle() ? 'เข้าป้อม' : ''].filter(Boolean)
  return `แนะนำ ${move.san}${facts.length ? `: ${facts.join(' · ')}` : ''} · ${scoreText(result)} คะแนนเป็นการประเมินภายในเวลาที่กำหนด ไม่รับประกันผลเกม${result.pv.length ? ` แนวเดินที่ตรวจว่าถูกกฎ: ${result.pv.join(' ')}` : ''}`
}
export const pieceNames = { k: 'คิง', q: 'ควีน', r: 'เรือ', b: 'บิชอป', n: 'ม้า', p: 'เบี้ย' }
export function squareName(game: Chess, square: Square) { const piece = game.get(square); return `${square} ${piece ? `${piece.color === 'w' ? 'ขาว' : 'ดำ'} ${pieceNames[piece.type]}` : 'ว่าง'}` }
