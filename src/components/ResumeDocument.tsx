import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type {
  FontKey,
  ListSection,
  Resume,
  Section,
  Selection,
  TextSection,
  TimelineEntry,
  TimelineSection,
} from '../types'
import { blockMd, contactHref, inlineMd } from '../utils'
import { buildRows } from '../layout'
import { ExternalIcon, IconBadge } from './icons'

export const FONT_FAMILIES: Record<FontKey, { label: string; css: string }> = {
  'source-sans': { label: 'Source Sans 3', css: "'Source Sans 3', 'Segoe UI', sans-serif" },
  inter: { label: 'Inter', css: "'Inter', 'Segoe UI', sans-serif" },
  roboto: { label: 'Roboto', css: "'Roboto', 'Segoe UI', sans-serif" },
  'open-sans': { label: 'Open Sans', css: "'Open Sans', 'Segoe UI', sans-serif" },
  lora: { label: 'Lora (serif)', css: "'Lora', Georgia, serif" },
}

const DENSITY = {
  compact: { section: 3.2, entry: 2.2, line: 1.3 },
  normal: { section: 4.6, entry: 3.2, line: 1.38 },
  airy: { section: 6, entry: 4.2, line: 1.48 },
}

export type DocMode = 'edit' | 'view'

interface Props {
  resume: Resume
  mode: DocMode
  selection?: Selection
  onSelect?: (sel: Selection) => void
}

export function resumeStyle(resume: Resume): CSSProperties {
  const t = resume.theme
  const d = DENSITY[t.density]
  return {
    '--accent': t.accent,
    '--text': t.text,
    '--font': FONT_FAMILIES[t.font].css,
    '--fs': `${t.fontSize}pt`,
    '--lh': d.line,
    '--gap-section': `${d.section}mm`,
    '--gap-entry': `${d.entry}mm`,
    '--date-col': `${t.dateColumn}mm`,
    '--photo': `${t.photoSize}mm`,
    '--mx': `${t.marginX}mm`,
    '--my': `${t.marginY}mm`,
  } as CSSProperties
}

export function ResumeDocument({ resume, mode, selection, onSelect }: Props) {
  const { profile, theme } = resume

  const isSel = (sectionId: string, itemId?: string) =>
    selection?.kind === 'section' && selection.sectionId === sectionId && selection.itemId === itemId

  // Clickable wrapper props. In view mode, only things with something to reveal are clickable.
  const clickable = (sel: Selection, active: boolean, enabled = true) => {
    if (!onSelect || !enabled) return {}
    return {
      'data-clickable': true,
      'data-selected': active || undefined,
      // No role="button": it would flatten headings/lists in the tagged PDF that ATS read.
      tabIndex: 0,
      onClick: (e: MouseEvent) => {
        // Let real links work in view mode
        if (mode === 'view' && (e.target as HTMLElement).closest('a')) return
        e.preventDefault()
        e.stopPropagation()
        onSelect(sel)
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onSelect(sel)
        }
      },
    }
  }

  const rows = buildRows(resume.sections, theme.layout === 'single-column')

  const renderSection = (s: Section) => {
    // The whole section is the click / highlight target (items inside handle their own clicks)
    const sectionSel = clickable({ kind: 'section', sectionId: s.id }, isSel(s.id), mode === 'edit')
    return (
      <section
        key={s.id}
        className={`cv-section cv-section--${s.kind}`}
        data-section-id={s.id}
        style={{ '--space-before': `${s.spaceBefore ?? 0}mm` } as CSSProperties}
        {...sectionSel}
      >
        <h2 className="cv-section-title">
          {s.title}
        </h2>
        {s.kind === 'timeline' && renderTimeline(s)}
        {s.kind === 'list' && renderList(s)}
        {s.kind === 'text' && renderText(s)}
      </section>
    )
  }

  const renderTimeline = (s: TimelineSection) => (
    <div className="cv-timeline">
      {s.entries
        .filter((e) => !e.hidden)
        .map((e) => (
          <EntryView
            key={e.id}
            entry={e}
            showLinkIcon={theme.showLinkIcons}
            single={theme.layout === 'single-column'}
            hasMore={mode === 'view' && !!e.details.trim()}
            data-item-id={e.id}
            data-item-kind="entry"
            data-owner={s.id}
            {...clickable({ kind: 'section', sectionId: s.id, itemId: e.id }, isSel(s.id, e.id))}
          />
        ))}
    </div>
  )

  const renderList = (s: ListSection) => (
    <ul className="cv-list">
      {s.items
        .filter((it) => !it.hidden)
        .map((it) => {
          const hasMore = !!it.details.trim()
          return (
            <li
              key={it.id}
              className={mode === 'view' && hasMore ? 'has-more' : undefined}
              data-item-id={it.id}
              data-item-kind="list"
              data-owner={s.id}
              {...clickable({ kind: 'section', sectionId: s.id, itemId: it.id }, isSel(s.id, it.id), mode === 'edit' || hasMore)}
            >
              <span dangerouslySetInnerHTML={{ __html: inlineMd(it.text) }} />
            </li>
          )
        })}
    </ul>
  )

  const renderText = (s: TextSection) => (
    <div
      className="cv-text md"
      {...clickable({ kind: 'section', sectionId: s.id, itemId: 'text' }, isSel(s.id, 'text'), mode === 'edit')}
      dangerouslySetInnerHTML={{ __html: blockMd(s.text) }}
    />
  )

  const headerSel = clickable(
    { kind: 'profile' },
    selection?.kind === 'profile',
    mode === 'edit' || !!profile.details.trim(),
  )

  return (
    <article className={`cv cv--${mode} cv--${theme.layout}`} style={resumeStyle(resume)}>
      <header className={`cv-header${theme.showPhoto && profile.photo ? '' : ' cv-header--nophoto'}`} {...headerSel}>
        {theme.showPhoto && profile.photo && (
          <img className={`cv-photo cv-photo--${theme.photoShape}`} src={profile.photo} alt="" />
        )}
        <div className="cv-header-body">
          <h1 className="cv-name">
            <span>{profile.name}</span>
            {profile.title && <em className="cv-title">{profile.title}</em>}
          </h1>
          {profile.contacts.length > 0 && (
            <ul className="cv-contacts">
              {profile.contacts.map((c) => {
                const href = contactHref(c)
                const inner: ReactNode = (
                  <>
                    <IconBadge name={c.icon} />
                    <span>{c.label}</span>
                  </>
                )
                return (
                  <li key={c.id}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {profile.summary && (
            <div className="cv-summary">
              <IconBadge name={profile.summaryIcon} />
              <p dangerouslySetInnerHTML={{ __html: inlineMd(profile.summary) }} />
            </div>
          )}
        </div>
      </header>

      {rows.map((row) => (
        <div
          key={row.key}
          className="cv-row"
          data-row-key={row.key}
          style={{ gridTemplateColumns: row.columns.map((c) => `minmax(0, ${c.width}fr)`).join(' ') }}
        >
          {row.columns.map((col) => (
            <div key={col.key} className={`cv-col${row.columns.length > 1 && col.width < 0.3 ? ' cv-col--narrow' : ''}`} data-col-key={col.key}>
              {col.sections.map(renderSection)}
            </div>
          ))}
        </div>
      ))}
    </article>
  )
}

interface EntryProps extends HTMLAttributes<HTMLDivElement> {
  entry: TimelineEntry
  showLinkIcon: boolean
  hasMore: boolean
  single: boolean
}

function EntryView({ entry: e, showLinkIcon, hasMore, single, ...rest }: EntryProps) {
  const location = (e.location || e.country) && (
    <span className="cv-entry-loc">
      {e.country && <span className={`fi fi-${e.country.toLowerCase()} cv-flag`} />}
      {e.location}
    </span>
  )
  // Single column: "date · duration · place" on the right of the title line, read in order by every parser
  const singleMeta = single && (e.date || e.subDate || location) && (
    <span className="cv-entry-metaline">
      {[e.date, e.subDate].filter(Boolean).join(' · ')}
      {(e.date || e.subDate) && location ? ' · ' : ''}
      {location}
    </span>
  )
  return (
    <div className={`cv-entry${hasMore ? ' has-more' : ''}`} {...rest}>
      {!single && (
        <div className="cv-entry-meta">
          {e.date && <div>{e.date}</div>}
          {location && <div>{location}</div>}
          {e.subDate && <div>{e.subDate}</div>}
        </div>
      )}
      <div className="cv-entry-body">
        <div className="cv-entry-head">
          <strong>
            {e.title}
            {e.subtitle ? ',' : ''}
          </strong>{' '}
          {e.subtitle && <em>{e.subtitle}</em>}
          {e.url && showLinkIcon && (
            <a className="cv-entry-link" href={e.url} target="_blank" rel="noopener noreferrer" title={e.url}>
              <ExternalIcon size={9} />
            </a>
          )}
          {hasMore && <span className="cv-more-badge">+</span>}
          {singleMeta}
        </div>
        {e.bullets.some((b) => b.trim()) && (
          <ul className="cv-bullets">
            {e.bullets.filter((b) => b.trim()).map((b, i) => (
              <li key={i}>
                <span dangerouslySetInnerHTML={{ __html: inlineMd(b) }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
