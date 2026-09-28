import { useState } from 'react'
import Icon from './Icon'

export default function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false)
  return <article className="faq-item" data-open={open}>
    <h3><button className="faq-trigger" aria-expanded={open} aria-controls={`faq-answer-${index}`} id={`faq-question-${index}`} onClick={() => setOpen(current => !current)}>
      <span className="faq-number">0{index + 1}</span><span>{question}</span><Icon name="plus" />
    </button></h3>
    <div id={`faq-answer-${index}`} className="faq-answer" role="region" aria-labelledby={`faq-question-${index}`} aria-hidden={!open} inert={!open}>
      <div><p>{answer}</p></div>
    </div>
  </article>
}
