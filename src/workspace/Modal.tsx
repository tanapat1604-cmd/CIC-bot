import { useEffect, useRef, type ReactNode } from 'react'
import Icon from '../Icon'
import s from './Workspace.module.css'

export default function Modal({ open, title, onClose, children, drawer = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    if (open && !dialog.open) { dialog.inert = false; dialog.showModal() }
    else if (!open && dialog.open) { dialog.close(); dialog.inert = true }
  }, [open])
  return <dialog ref={ref} className={`${s.modal} ${drawer ? s.drawer : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
  }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]')).filter(element => element.getClientRects().length)
    const first = elements[0], last = elements.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <div className={s.modalHeading}><h2>{title}</h2><button className={s.iconButton} aria-label={`ปิด${title}`} onClick={onClose} autoFocus><Icon name="close" /></button></div>
    {children}
  </dialog>
}
