import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface CardProps {
  icon: ReactNode
  title: string
  open: boolean
  selected?: boolean
  muted?: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
  ref?: (el: HTMLElement | null) => void
  /** Drag grip, for cards that can be reordered */
  handle?: ReactNode
}

export function Card({ icon, title, open, selected, muted, onToggle, actions, children, ref, handle }: CardProps) {
  return (
    <section
      ref={ref}
      className={`card${open ? ' is-open' : ''}${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}${handle ? ' has-handle' : ''}`}
    >
      <header className="card-head">
        {handle}
        {/* A real button: the card opens with Enter / Space too */}
        <h3>
          <button type="button" className="card-toggle" aria-expanded={open} onClick={onToggle}>
            <ChevronRight size={16} className="card-chevron" />
            <span className="card-icon">{icon}</span>
            <span className="card-title">{title}</span>
          </button>
        </h3>
        <div className="card-actions">{actions}</div>
      </header>
      {open && <div className="card-body">{children}</div>}
    </section>
  )
}
