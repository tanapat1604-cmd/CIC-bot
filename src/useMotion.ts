import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const motionEase = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const media = matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

// One in-flight transition: new selections replace it without adding a queue.
export function useTabMotion(active: number, reduced: boolean) {
  const [shown, setShown] = useState(active)
  const panels = useRef<(HTMLDivElement | null)[]>([])
  const running = useRef<{ node: HTMLElement; animation: Animation } | null>(null)
  useLayoutEffect(() => {
    const node = panels.current[shown]
    if (!node) return
    const previous = running.current
    const opacity = getComputedStyle(node).opacity
    const transform = getComputedStyle(node).transform
    if (previous) { previous.animation.onfinish = null; previous.animation.cancel() }
    running.current = null
    if (reduced) { if (shown !== active) setShown(active); return }
    if (shown === active && !previous) return
    const leaving = active !== shown
    const animation = node.animate([
      { opacity: previous?.node === node ? opacity : leaving ? 1 : 0, transform: previous?.node === node ? transform : leaving ? 'translateY(0)' : 'translateY(9px)' },
      { opacity: leaving ? 0 : 1, transform: leaving ? 'translateY(-5px)' : 'translateY(0)' },
    ], { duration: leaving ? 90 : 220, easing: motionEase, fill: 'both' })
    running.current = { node, animation }
    animation.onfinish = () => {
      if (running.current?.animation === animation && leaving) setShown(active)
    }
  }, [active, shown, reduced])
  useEffect(() => () => running.current?.animation.cancel(), [])
  return { shown, panels }
}
