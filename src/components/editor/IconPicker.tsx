import { useEffect, useRef, useState } from 'react'
import { Ban, ChevronDown } from 'lucide-react'
import type { IconKey } from '../../types'
import { defineStrings, useStrings } from '../../i18n'
import { ICONS, ICON_LABELS, Icon } from '../icons'

const S = defineStrings(
  { current: (name: string) => `Icône : ${name}`, choose: 'Choisir une icône', none: 'Aucune icône' },
  { current: (name) => `Icon: ${name}`, choose: 'Choose an icon', none: 'No icon' },
)

interface Props {
  value: IconKey
  onChange: (v: IconKey) => void
  /** Accent color of the resume, so the preview matches */
  accent: string
}

/** Button showing the current icon; opens a grid of all available icons. */
export function IconPicker({ value, onChange, accent }: Props) {
  const t = useStrings(S)
  const labels = useStrings(ICON_LABELS)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (k: IconKey) => {
    onChange(k)
    setOpen(false)
  }

  return (
    <div className="icon-picker" ref={root} style={{ ['--pick-accent' as string]: accent }}>
      <button
        type="button"
        className="icon-picker-btn"
        title={t.current(labels[value] ?? value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`icon-picker-badge${value === 'none' ? ' is-none' : ''}`}>
          {value === 'none' ? <Ban size={13} /> : <Icon name={value} size={12} />}
        </span>
        <ChevronDown size={13} className="icon-picker-caret" />
      </button>

      {open && (
        <div className="icon-picker-pop" role="listbox" aria-label={t.choose}>
          <div className="icon-picker-grid">
            {ICONS.map((i) => (
              <button
                key={i.key}
                type="button"
                role="option"
                aria-selected={value === i.key}
                className={`icon-picker-opt${value === i.key ? ' is-active' : ''}`}
                title={labels[i.key]}
                onClick={() => pick(i.key)}
              >
                {i.render(16)}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="option"
            aria-selected={value === 'none'}
            className={`icon-picker-none${value === 'none' ? ' is-active' : ''}`}
            onClick={() => pick('none')}
          >
            <Ban size={14} /> {t.none}
          </button>
        </div>
      )}
    </div>
  )
}
