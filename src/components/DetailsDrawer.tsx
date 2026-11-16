import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { Resume, Selection } from '../types'
import { blockMd, contactHref, inlineMd, STRINGS } from '../utils'
import { ExternalIcon, IconBadge } from './icons'
import { resumeStyle } from './ResumeDocument'

interface Props {
  resume: Resume
  selection: Selection
  onClose: () => void
}

/** Side panel showing the full details of a clicked resume item (web view). */
export function DetailsDrawer({ resume, selection, onClose }: Props) {
  const t = STRINGS[resume.meta.locale]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const content = (() => {
    if (!selection) return null
    if (selection.kind === 'profile') {
      const p = resume.profile
      return (
        <>
          <header className="drawer-head">
            {p.photo && <img className="drawer-photo" src={p.photo} alt="" />}
            <div>
              <h2>{p.name}</h2>
              <p className="drawer-sub">{p.title}</p>
            </div>
          </header>
          <ul className="drawer-contacts">
            {p.contacts.map((c) => {
              const href = contactHref(c)
              return (
                <li key={c.id}>
                  {c.icon === 'none' ? <span className="cv-icon cv-icon--empty" /> : <IconBadge name={c.icon} size={12} />}
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {c.label}
                    </a>
                  ) : (
                    c.label
                  )}
                </li>
              )
            })}
          </ul>
          {p.summary && <p dangerouslySetInnerHTML={{ __html: inlineMd(p.summary) }} />}
          {p.details && <div className="md" dangerouslySetInnerHTML={{ __html: blockMd(p.details) }} />}
        </>
      )
    }
    const section = resume.sections.find((s) => s.id === selection.sectionId)
    if (!section) return null
    if (section.kind === 'timeline') {
      const e = section.entries.find((x) => x.id === selection.itemId)
      if (!e) return null
      return (
        <>
          <p className="drawer-kicker">{section.title}</p>
          <header className="drawer-head">
            <div>
              <h2>{e.title}</h2>
              {e.subtitle && <p className="drawer-sub">{e.subtitle}</p>}
              <p className="drawer-meta">
                {[e.date, e.subDate].filter(Boolean).join(' · ')}
                {(e.location || e.country) && (
                  <span className="drawer-loc">
                    {e.country && <span className={`fi fi-${e.country.toLowerCase()} cv-flag`} />}
                    {e.location}
                  </span>
                )}
              </p>
            </div>
          </header>
          {e.url && (
            <a className="drawer-link" href={e.url} target="_blank" rel="noopener noreferrer">
              <ExternalIcon size={12} /> {t.openLink}
            </a>
          )}
          {e.bullets.some((b) => b.trim()) && (
            <ul className="drawer-bullets">
              {e.bullets.filter((b) => b.trim()).map((b, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(b) }} />
              ))}
            </ul>
          )}
          {e.details.trim() && (
            <>
              <h3 className="drawer-h3">{t.details}</h3>
              <div className="md" dangerouslySetInnerHTML={{ __html: blockMd(e.details) }} />
            </>
          )}
        </>
      )
    }
    if (section.kind === 'list') {
      const it = section.items.find((x) => x.id === selection.itemId)
      if (!it) return null
      return (
        <>
          <p className="drawer-kicker">{section.title}</p>
          <h2 dangerouslySetInnerHTML={{ __html: inlineMd(it.text) }} />
          <div className="md" dangerouslySetInnerHTML={{ __html: blockMd(it.details) }} />
        </>
      )
    }
    return null
  })()

  const open = !!content
  return (
    <div className={`drawer-root${open ? ' is-open' : ''}`} style={resumeStyle(resume)} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <button className="drawer-close" onClick={onClose} aria-label={t.close} title={t.close}>
          <X size={18} />
        </button>
        <div className="drawer-content">{content}</div>
      </aside>
    </div>
  )
}
