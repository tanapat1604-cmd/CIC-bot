type Fraction = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a < 0n ? -a : a
function fraction(n: bigint, d = 1n): Fraction {
  if (!d) throw new Error('หารด้วยศูนย์ไม่ได้')
  if (d < 0n) { n = -n; d = -d }
  const g = gcd(n, d), value = { n: n / g, d: d / g }
  if (value.n > 10n ** 18n || value.n < -(10n ** 18n) || value.d > 10n ** 18n) throw new Error('ตัวเลขเกินขอบเขต')
  return value
}
function format(value: Fraction) {
  let d = value.d
  for (const factor of [2n, 5n]) while (d % factor === 0n) d /= factor
  if (d !== 1n) return `${value.n}/${value.d}` // Exact rational, never a misleading rounded decimal.
  const sign = value.n < 0n ? '-' : '', n = value.n < 0n ? -value.n : value.n
  let rest = n % value.d, decimal = ''
  while (rest) { rest *= 10n; decimal += String(rest / value.d); rest %= value.d }
  return `${sign}${n / value.d}${decimal ? '.' + decimal : ''}`
}
export function calculate(expression: string): string {
  if (!expression.trim() || expression.length > 128 || /[^\d\s.+\-*/()]/u.test(expression)) throw new Error('รองรับตัวเลข + - * / และวงเล็บ ไม่เกิน 128 ตัวอักษร')
  const tokens = expression.match(/\d+(?:\.\d{1,4})?|[()+\-*/]/g) ?? []
  if (tokens.join('') !== expression.replace(/\s/g, '') || tokens.length > 48) throw new Error('รูปแบบนิพจน์ไม่ถูกต้องหรือยาวเกินไป')
  let at = 0
  const atom = (): Fraction => {
    const token = tokens[at++]
    if (token === '+' || token === '-') { const value = atom(); return token === '-' ? { ...value, n: -value.n } : value }
    if (token === '(') { const value = sum(); if (tokens[at++] !== ')') throw new Error('วงเล็บไม่ครบ'); return value }
    if (!token || !/^\d+(?:\.\d+)?$/.test(token) || token.length > 14) throw new Error('คาดว่าจะเป็นตัวเลข')
    const [whole, decimals = ''] = token.split('.')
    return fraction(BigInt(whole + decimals), 10n ** BigInt(decimals.length))
  }
  const product = (): Fraction => {
    let value = atom()
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++], right = atom()
      value = op === '*' ? fraction(value.n * right.n, value.d * right.d) : fraction(value.n * right.d, value.d * right.n)
    }
    return value
  }
  const sum = (): Fraction => {
    let value = product()
    while (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++], right = product()
      value = fraction(value.n * right.d + (op === '+' ? 1n : -1n) * right.n * value.d, value.d * right.d)
    }
    return value
  }
  const value = sum()
  if (at !== tokens.length) throw new Error('มีข้อความหรือเครื่องหมายเกิน')
  return format(value)
}
