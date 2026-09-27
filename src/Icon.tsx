export type IconName = 'arrow' | 'download' | 'work' | 'game' | 'structure' | 'design' | 'code' | 'screen' | 'spark' | 'check' | 'close' | 'menu' | 'plus' | 'shield'
const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" /></>,
  work: <><rect x="4" y="6" width="16" height="15" rx="2" /><path d="M8 6V3h8v3M8 11h8M8 15h5" /></>,
  game: <><path d="M7 7h10c3 0 5 12 2 12-2 0-3-4-4-4H9c-1 0-2 4-4 4-3 0-1-12 2-12Z" /><path d="M6 11h5m-2.5-2.5v5M16 10v.1M18 12v.1" /></>,
  structure: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="2" y="16" width="6" height="5" rx="1" /><rect x="16" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M5 16v-4h14v4" /></>,
  design: <><path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5M3 21l5-5" /></>,
  code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18" /></>,
  screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 17v4M8 21h8" /></>,
  spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M5 12h14M12 5v14" />,
  shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
}
export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
