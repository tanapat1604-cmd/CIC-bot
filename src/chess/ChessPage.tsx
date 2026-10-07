import { useEffect, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import Brand from '../Brand'
import { localBackendUrl } from '../workspace/transport'
import { LEVELS, explainResult, exportPgn, gameStatus, parseGame, pieceNames, squareName, uciMove, validateChessResult, type Level, type ChessResult } from '../../shared/chess'
import './chess.css'

const symbols = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } }
const errors: Record<string, string> = { unauthorized: 'สิทธิ์หมดอายุ กรุณาเชื่อมต่อใหม่', unavailable: 'เปิด Stockfish 19 ไม่สำเร็จ ตรวจการติดตั้ง backend และ engine', busy: 'engine กำลังปิดงานก่อนหน้า กรุณาลองใหม่', memory: 'RAM ว่างต่ำกว่า 256 MiB กรุณาพักโมเดลหรือปิดงานที่คุณไม่ใช้ แล้วลองใหม่', timeout: 'engine ใช้เวลาเกินกำหนด หยุดงานแล้ว กรุณาลองใหม่', invalid: 'ข้อมูลตำแหน่งไม่ถูกต้องหรือเกมจบแล้ว', limited: 'คำขอถี่เกินไป กรุณาลองใหม่ภายหลัง' }
const base = localBackendUrl(location.hostname, import.meta.env.VITE_BACKEND_URL)
export default function ChessPage() {
  const [game, setGame] = useState(() => new Chess()), gameRef = useRef(game)
  const [side, setSide] = useState<'w' | 'b'>('w'), [level, setLevel] = useState<Level>('medium')
  const [selected, setSelected] = useState<Square | null>(null), [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [connected, setConnected] = useState(false), [busy, setBusy] = useState(false), [paused, setPaused] = useState(false)
  const [notice, setNotice] = useState('เชื่อมต่อเพื่อเล่นกับ Stockfish ในเครื่อง'), [error, setError] = useState('')
  const [result, setResult] = useState<ChessResult | null>(null), [text, setText] = useState(''), [format, setFormat] = useState<'fen' | 'pgn'>('fen')
  const controller = useRef<AbortController | null>(null), identity = useRef(crypto.randomUUID()), sequence = useRef(0)
  const stop = () => { sequence.current++; controller.current?.abort(); controller.current = null; setBusy(false); setPaused(true); setNotice('หยุดคิดแล้ว — กดให้บอทเดินต่อหรือลองวิเคราะห์ใหม่') }
  useEffect(() => {
    const leave = () => { if (location.hash !== '#/chess') { sequence.current++; controller.current?.abort() } }
    addEventListener('hashchange', leave)
    return () => { controller.current?.abort(); removeEventListener('hashchange', leave) }
  }, [])
  const install = (next: Chess, reset = false) => {
    sequence.current++; controller.current?.abort(); controller.current = null; setBusy(false)
    if (reset) identity.current = crypto.randomUUID()
    gameRef.current = next; setGame(next); setSelected(null); setPromotion(null); setResult(null); setError('')
  }
  const connect = async () => {
    if (!base) return
    stop(); setError(''); setNotice('กำลังตรวจ Stockfish…')
    const abort = new AbortController(); controller.current = abort; const seq = sequence.current
    setBusy(true)
    try {
      const response = await fetch(`${base}/chess/status`, { credentials: 'include', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]) })
      if (!response.ok) throw Error('unavailable')
      const status = await response.json()
      if (status.ready !== true || status.location !== 'local' || status.engine !== 'Stockfish 19') throw Error('unavailable')
      const session = await fetch(`${base}/session`, { method: 'POST', credentials: 'include', signal: abort.signal })
      if (!session.ok) throw Error(session.status === 429 ? 'limited' : 'unavailable')
      if (seq !== sequence.current || abort.signal.aborted) return
      setConnected(true); setPaused(false); setNotice(`พร้อม • Stockfish 19 ในเครื่อง • RAM ว่างตอนตรวจ ${status.freeMiB} MiB • ไม่ใช้ Ollama`)
    } catch (e) { if (!abort.signal.aborted && seq === sequence.current) { setConnected(false); setError(errors[e instanceof Error ? e.message : ''] ?? errors.unavailable) } }
    finally { if (seq === sequence.current) { setBusy(false); controller.current = null } }
  }
  const think = async (analysis: boolean) => {
    if (!base || !connected || gameRef.current.isGameOver()) return
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort
    const seq = ++sequence.current, current = gameRef.current, gameId = identity.current, requestId = crypto.randomUUID(), fen = current.fen()
    setBusy(true); setError(''); setResult(null); setNotice(analysis ? 'Stockfish กำลังวิเคราะห์…' : 'Stockfish กำลังเลือกตาเดิน…')
    try {
      const request = { gameId, requestId, pgn: current.pgn(), level, analysis }
      const response = await fetch(`${base}/chess/analyze`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]) })
      const raw = await response.json()
      if (!response.ok) throw Error(raw.code ?? 'unavailable')
      if (abort.signal.aborted || seq !== sequence.current || identity.current !== gameId || gameRef.current.fen() !== fen) return
      const value = validateChessResult(raw, request, fen)
      const next = current.pgn().trim() ? parseGame(current.pgn(), 'pgn') : new Chess()
      const move = uciMove(next, value.move)
      if (move.san !== value.san) throw Error('unavailable')
      if (analysis) { explainResult(value); setResult(value) }
      else { gameRef.current = next; setGame(next); setSelected(null) }
      setNotice(`Stockfish 19 • คิด ${value.thinkMs} ms • รวม ${Math.round(value.elapsedMs)} ms • engine ปิดแล้ว`)
      setPaused(false)
    } catch (e) {
      if (abort.signal.aborted || seq !== sequence.current) return
      const message = e instanceof Error ? e.message : ''
      setError(errors[message] ?? errors.unavailable); setPaused(true)
      if (message === 'unauthorized') setConnected(false)
    } finally { if (seq === sequence.current) { setBusy(false); controller.current = null } }
  }
  // Only trigger bot replies on a new board/connection. A stopped or failed job
  // stays paused; no retry loops. Each response is tied to game + request + FEN.
  useEffect(() => {
    if (connected && !paused && game.turn() !== side && !game.isGameOver()) void think(false)
    // The job owns the snapshot of level/side; control changes abort first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, connected, side])
  const move = (from: Square, to: Square, promote?: string) => {
    const next = game.pgn().trim() ? parseGame(game.pgn(), 'pgn') : new Chess()
    try { next.move({ from, to, ...(promote ? { promotion: promote } : {}) }); install(next); setPaused(false) }
    catch { setError('เดินตานี้ไม่ได้') }
  }
  const click = (square: Square) => {
    if (busy || promotion || game.isGameOver() || game.turn() !== side) return
    if (selected) {
      const targets = game.moves({ square: selected, verbose: true }).filter(m => m.to === square)
      if (targets.length) { if (targets.some(m => m.promotion)) setPromotion({ from: selected, to: square }); else move(selected, square); return }
    }
    setSelected(game.get(square)?.color === side ? square : null)
  }
  const squares = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[side === 'w' ? i % 8 : 7 - i % 8]}${side === 'w' ? 8 - Math.floor(i / 8) : 1 + Math.floor(i / 8)}` as Square)
  const legal = new Set(selected ? game.moves({ square: selected, verbose: true }).map(m => m.to) : [])
  const exportGame = (kind: 'fen' | 'pgn') => {
    const data = kind === 'fen' ? game.fen() : exportPgn(game), blob = new Blob([data], { type: 'text/plain;charset=utf-8' }), url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cic-chess.${kind}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(`ส่งออก ${kind.toUpperCase()} แล้ว`)
  }
  return <div className="chess-page">
    <header className="chess-header"><Brand href="#/app" /><a href="#/app">← กลับแชต</a><span>เครื่องมือในเครื่อง</span></header>
    <main className="chess-main"><section className="chess-intro"><p className="chess-eyebrow">CIC / CHESS</p><h1>คิดทีละตา เล่นให้ไกลขึ้น</h1><p>เล่นและวิเคราะห์ด้วย Stockfish 19 · ตรวจตาเดินด้วย chess.js · ไม่ใช้โมเดลภาษา</p></section>
      {!base && <p className="chess-warning">เว็บสาธารณะเป็นตัวอย่างกระดานเท่านั้น เล่นกับ engine ได้ที่แอปในเครื่อง <code>127.0.0.1:5173/CIC-bot/#/chess</code> — หน้านี้ไม่เชื่อม backend ในเครื่อง</p>}
      <div className="chess-layout"><section className="chess-play" aria-label="กระดานหมากรุก">
        <div className="chess-board-heading"><strong data-testid="game-status">{gameStatus(game)}</strong><span>คุณเล่น{side === 'w' ? 'ขาว' : 'ดำ'}</span></div>
        <div className="chess-board">{squares.map(square => { const piece = game.get(square); return <button type="button" key={square} aria-label={squareName(game, square)} aria-pressed={selected === square} className={`chess-square ${(square.charCodeAt(0) + Number(square[1])) % 2 ? 'light' : 'dark'} ${selected === square ? 'selected' : ''} ${legal.has(square) ? 'legal' : ''}`} onClick={() => click(square)}><small aria-hidden="true">{square}</small><span aria-hidden="true" className={piece?.color === 'w' ? 'white-piece' : 'black-piece'}>{piece && symbols[piece.color][piece.type]}</span></button> })}</div>
        {promotion && <div className="chess-promotion" role="group" aria-label="เลือกตัวเลื่อนเบี้ย"><strong>เลื่อนเบี้ยเป็น</strong>{(['q', 'r', 'b', 'n'] as const).map(p => <button key={p} onClick={() => move(promotion.from, promotion.to, p)}>{pieceNames[p]}</button>)}<button onClick={() => setPromotion(null)}>ยกเลิก</button></div>}
        <p className="chess-caption">แตะตัวหมาก แล้วแตะช่องปลายทาง · ช่องจุดคือตาที่เดินได้</p>
      </section><aside className="chess-panel">
        <h2>เกมของคุณ</h2><div className="chess-fields"><label>ฝ่าย<select aria-label="ฝ่าย" value={side} onChange={e => { stop(); setSide(e.target.value as 'w' | 'b'); install(new Chess(), true); setPaused(false) }}><option value="w">ขาว · เดินก่อน</option><option value="b">ดำ · เดินทีหลัง</option></select></label><label>ระดับ<select aria-label="ระดับ" value={level} onChange={e => { stop(); setLevel(e.target.value as Level) }}>{Object.entries(LEVELS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label></div>
        <p className="chess-muted">Skill {LEVELS[level].skill}/20 · {LEVELS[level].ms} ms/ตา · ไม่ใช่ค่า Elo</p>
        <div className="chess-actions"><button onClick={() => { stop(); install(new Chess(), true); setPaused(false); setNotice('เริ่มเกมใหม่แล้ว') }}>เริ่มเกมใหม่</button><button disabled={!base || busy} onClick={() => void connect()}>{connected ? 'ตรวจการเชื่อมต่อ' : 'เชื่อมต่อ Stockfish'}</button></div>
        <div className="chess-actions"><button className="primary" disabled={!connected || busy || game.isGameOver()} onClick={() => void think(true)}>วิเคราะห์ตำแหน่ง</button><button disabled={!busy} onClick={stop}>หยุดคิด</button></div>
        {connected && !busy && !game.isGameOver() && game.turn() !== side && <button className="chess-resume" onClick={() => void think(false)}>ให้บอทเดินต่อ / ลองใหม่</button>}
        <p role="status" className="chess-status">{notice}</p>{error && <p role="alert" className="chess-error">{error}</p>}
        {result && <section className="chess-analysis" aria-label="ผลวิเคราะห์"><h3>ตาแนะนำ {result.san}</h3><p>{explainResult(result)}</p><small>แหล่ง: {result.engine} · ลึก {result.depth} ply · Threads 1 / Hash 16 MiB · วิเคราะห์ 1,000 ms</small></section>}
        <details><summary>ตาเดิน · {game.history().length} ply</summary><p className="chess-moves">{game.history({ verbose: true }).map((m, i) => `${m.color === 'w' ? `${m.before.split(' ')[5]}. ` : i === 0 ? `${m.before.split(' ')[5]}... ` : ''}${m.san}`).join(' ') || 'ยังไม่มีตาเดิน'}</p></details>
        <details><summary>นำเข้า / ส่งออก FEN และ PGN</summary><label>รูปแบบ<select aria-label="รูปแบบ" value={format} onChange={e => setFormat(e.target.value as 'fen' | 'pgn')}><option value="fen">FEN · ตำแหน่ง</option><option value="pgn">PGN · ประวัติเกม</option></select></label><textarea aria-label="ข้อมูลนำเข้า" maxLength={32000} value={text} onChange={e => setText(e.target.value)} placeholder="วาง FEN หรือ PGN ที่นี่" /><div className="chess-actions"><button onClick={() => { try { const next = parseGame(text, format); stop(); install(next, true); setPaused(true); setNotice('นำเข้าสำเร็จ — ตรวจตำแหน่งแล้วกดเล่นต่อหรือวิเคราะห์') } catch { setError('นำเข้าไม่ได้: ตรวจ FEN/PGN มาตรฐานและตาเดิน ไม่มีการเปลี่ยนเกมเดิม') } }}>นำเข้า</button><button onClick={() => exportGame('fen')}>ส่งออก FEN</button><button onClick={() => exportGame('pgn')}>ส่งออก PGN</button></div></details>
        <details><summary>ขอบเขตและทรัพยากร</summary><p>engine เปิดเฉพาะตอนคิดและปิดเมื่อจบ ใช้ 1 เธรด / Hash 16 MiB (ไม่ใช่ RAM รวม) ไม่เรียกหรือปิด Ollama และไม่ปิดโปรแกรมอื่น ถ้า RAM ต่ำจะแจ้งข้อผิดพลาด</p><p>CIC จบเสมออัตโนมัติเมื่อตำแหน่งซ้ำสามครั้งหรือครบกฎ 50 ตา ไม่มีนาฬิกาและขั้นตอนขอเสมอแบบการแข่งขัน FEN ไม่มีประวัติการซ้ำก่อนหน้า ใช้ PGN เพื่อเก็บประวัติ</p><p>เกมอยู่ในหน้านี้ชั่วคราว ส่งออกก่อนออกจากหน้าหรือรีเฟรช รองรับหมากรุกมาตรฐาน ไม่รองรับ Chess960</p><a href="./THIRD-PARTY-NOTICES.txt" target="_blank" rel="noreferrer">สิทธิใช้งานเครื่องมือ</a></details>
      </aside></div>
    </main>
  </div>
}
