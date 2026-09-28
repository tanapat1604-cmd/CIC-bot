export default function Brand({ href = '#top', className = 'brand' }: { href?: string; className?: string }) {
  return <a className={className} href={href} aria-label="CIC Bot กลับหน้าแนะนำ"><svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M27 9a14 14 0 1 0 0 22" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" /><circle cx="26" cy="20" r="4" fill="currentColor" /></svg><span>CIC<span className="brand-bot"> Bot</span></span></a>
}
