import { Fragment, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type {
  DateFormat,
  EntryStyle,
  FactSection,
  HighlightSection,
  FontKey,
  IconKey,
  LevelSection,
  ListSection,
  ReferenceSection,
  Resume,
  ResumeLocale,
  Section,
  Selection,
  TextSection,
  TimelineEntry,
  TimelineSection,
} from '../types'
import { autoHref, blockMd, contactHref, inlineMd, normalizeHref } from '../utils'
import { buildRows, isInSidebar, mainLayout } from '../layout'
import { ExternalIcon, Icon, IconBadge } from './icons'
import { FLAGS } from '../flags'
import { dateRangeParts } from '../locale'

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

/** Width of the coloured column in the "sidebar" header style */
export const SIDEBAR_MM = 62

interface Props {
  resume: Resume
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
    '--side-w': `${SIDEBAR_MM}mm`,
  } as CSSProperties
}

/** Icon shown before a section title (title style "icon"): the section's own, else guessed from its title. */
export function sectionIcon(s: Section): IconKey {
  if (s.icon) return s.icon
  const t = s.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  if (/exp|emploi|work|job|career|parcours/.test(t)) return 'briefcase'
  if (/form|educ|etude|dipl|school|ecole/.test(t)) return 'graduation'
  if (/proj/.test(t)) return 'code'
  if (/lang/.test(t)) return 'languages'
  if (/cert|award|prix|recomp|distinc/.test(t)) return 'award'
  if (/inter|hobb|loisir|benevol|volunt/.test(t)) return 'heart'
  if (/profil|propos|about|summary|resume/.test(t)) return 'user'
  if (/contact/.test(t)) return 'mail'
  if (/jeu|game/.test(t)) return 'gamepad'
  return s.kind === 'timeline' ? 'briefcase' : s.kind === 'references' ? 'user' : s.kind === 'highlights' ? 'award' : 'star'
}

const initialsCache = new Map<string, string>()

/**
 * Initials rendered to a PNG (not SVG: Chrome keeps SVG <text> as real PDF text, and parsers
 * would read "AM" before the name).
 */
function initialsImage(name: string, accent: string, font: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
  const key = `${letters}|${accent}|${font}`
  const cached = initialsCache.get(key)
  if (cached) return cached
  const size = 320
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) return ''
  g.fillStyle = mix(accent, '#ffffff', 0.86)
  g.fillRect(0, 0, size, size)
  g.fillStyle = accent
  g.font = `600 ${size * 0.4}px ${font}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(letters, size / 2, size / 2 + size * 0.02)
  const url = canvas.toDataURL('image/png')
  initialsCache.set(key, url)
  return url
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** The resume page. With `onSelect`, its parts are clickable to edit them (preview); without, it is static. */
export function ResumeDocument({ resume, selection, onSelect }: Props) {
  const { profile, theme } = resume
  const sidebarMode = theme.headerStyle === 'sidebar'

  const isSel = (sectionId: string, itemId?: string) =>
    selection?.kind === 'section' && selection.sectionId === sectionId && selection.itemId === itemId

  // Clickable wrapper props (click to edit)
  const clickable = (sel: Selection, active: boolean) => {
    if (!onSelect) return {}
    const isItem = sel?.kind === 'section' && !!sel.itemId
    return {
      'data-clickable': true,
      'data-selected': active || undefined,
      // No role="button": it would flatten headings/lists in the tagged PDF that ATS read.
      // Tab stops on the header and sections only; arrow keys go through every entry / item.
      tabIndex: isItem ? -1 : 0,
      onClick: (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect(sel)
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onSelect(sel)
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const all = [...(e.currentTarget.closest('.cv')?.querySelectorAll<HTMLElement>('[data-clickable]') ?? [])]
          const next = all[all.indexOf(e.currentTarget as HTMLElement) + (e.key === 'ArrowDown' ? 1 : -1)]
          if (!next) return
          e.preventDefault()
          e.stopPropagation()
          next.focus()
        }
      },
    }
  }

  const sideSections = sidebarMode ? resume.sections.filter((s) => s.visible && isInSidebar(s)) : []
  const rows = buildRows(sidebarMode ? mainLayout(resume.sections) : resume.sections)

  const renderSection = (s: Section) => {
    // The whole section is the click / highlight target (items inside handle their own clicks)
    const sectionSel = clickable({ kind: 'section', sectionId: s.id }, isSel(s.id))
    return (
      <section key={s.id} className={`cv-section cv-section--${s.kind}`} data-section-id={s.id} {...sectionSel}>
        {!s.hideTitle && (
          <h2 className="cv-section-title">
            {theme.titleStyle === 'icon' && (
              <span className="cv-title-icon">
                <Icon name={sectionIcon(s)} size={12} />
              </span>
            )}
            <span>{s.title}</span>
          </h2>
        )}
        {s.kind === 'timeline' && renderTimeline(s)}
        {s.kind === 'list' && renderList(s)}
        {s.kind === 'text' && renderText(s)}
        {s.kind === 'levels' && renderLevels(s)}
        {s.kind === 'facts' && renderFacts(s)}
        {s.kind === 'references' && renderReferences(s)}
        {s.kind === 'highlights' && renderHighlights(s)}
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
            entryStyle={theme.entryStyle}
            locale={resume.meta.locale}
            dateFormat={theme.dateFormat}
            showLinkIcon={theme.showLinkIcons}
            data-item-id={e.id}
            data-item-kind="entry"
            data-owner={s.id}
            {...clickable({ kind: 'section', sectionId: s.id, itemId: e.id }, isSel(s.id, e.id))}
          />
        ))}
    </div>
  )

  const renderList = (s: ListSection) => {
    const display = s.display ?? 'bullets'
    // The inline separator is generated content (CSS ::after) so it is real text in the PDF
    const style = display === 'inline' ? ({ '--sep': JSON.stringify(s.separator ?? ' · ') } as CSSProperties) : undefined
    return (
      <ul className={`cv-list cv-list--${display}`} style={style}>
        {s.items
          .filter((it) => !it.hidden)
          .map((it) => (
            <li
              key={it.id}
              data-item-id={it.id}
              data-item-kind="list"
              data-item-flow={display === 'bullets' ? undefined : 'inline'}
              data-owner={s.id}
              {...clickable({ kind: 'section', sectionId: s.id, itemId: it.id }, isSel(s.id, it.id))}
            >
              <span dangerouslySetInnerHTML={{ __html: inlineMd(it.text) }} />
            </li>
          ))}
      </ul>
    )
  }

  const renderText = (s: TextSection) => (
    <div
      className="cv-text md"
      {...clickable({ kind: 'section', sectionId: s.id, itemId: 'text' }, isSel(s.id, 'text'))}
      dangerouslySetInnerHTML={{ __html: blockMd(s.text) }}
    />
  )

  /** Props shared by every item of the simple item sections (click to edit + on-page drag) */
  const itemProps = (s: Section, id: string, flow?: 'inline') => ({
    'data-item-id': id,
    'data-item-kind': s.kind,
    'data-item-flow': flow,
    'data-owner': s.id,
    ...clickable({ kind: 'section', sectionId: s.id, itemId: id }, isSel(s.id, id)),
  })

  // Skills / languages with a level: read as "Anglais — C1" (the dash is invisible, the meter has no text)
  const renderLevels = (s: LevelSection) => (
    <ul className={`cv-levels cv-levels--${s.meter}`}>
      {s.items
        .filter((it) => !it.hidden)
        .map((it) => (
          <li key={it.id} {...itemProps(s, it.id)}>
            {/* Name and level stay together on the left, so layout-based readers keep them on one line */}
            <span className="cv-level-label">
              <span className="cv-level-name">{it.name}</span>
              {it.level && (
                <span className="cv-level-text">
                  <span className="cv-level-sep"> — </span>
                  {it.level}
                </span>
              )}
            </span>
            {s.meter !== 'none' && it.rating > 0 && (
              <span className={`cv-meter cv-meter--${s.meter}`} aria-hidden="true" style={{ '--v': it.rating / 5 } as CSSProperties}>
                {s.meter === 'dots' && [1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= it.rating ? 'on' : undefined} />)}
              </span>
            )}
          </li>
        ))}
    </ul>
  )

  // Key / value facts: "Permis : B"; a fact without value takes the whole line
  const renderFacts = (s: FactSection) => (
    <dl className="cv-facts">
      {s.items
        .filter((it) => !it.hidden)
        .map((it) => (
          <div key={it.id} className={`cv-fact${it.value ? '' : ' cv-fact--single'}`} {...itemProps(s, it.id)}>
            <dt>{it.key}</dt>
            {it.value && <dd>{it.value}</dd>}
          </div>
        ))}
    </dl>
  )

  const renderReferences = (s: ReferenceSection) =>
    s.onRequest ? (
      <p className="cv-ref-request">{s.onRequestText}</p>
    ) : (
      <div className="cv-refs">
        {s.items
          .filter((it) => !it.hidden)
          .map((it) => {
            const href = it.contact ? autoHref(it.contact.trim()) : undefined
            return (
              <div key={it.id} className="cv-ref" {...itemProps(s, it.id, 'inline')}>
                <strong>{it.name}</strong>
                {(it.role || it.company) && <div className="cv-ref-role">{[it.role, it.company].filter(Boolean).join(', ')}</div>}
                {it.contact && <div className="cv-ref-contact">{href ? <a href={href}>{it.contact}</a> : it.contact}</div>}
              </div>
            )
          })}
      </div>
    )

  // Key figures in a row; an invisible comma separates them for parsers
  const renderHighlights = (s: HighlightSection) => (
    <ul className="cv-highlights">
      {s.items
        .filter((it) => !it.hidden)
        .map((it) => (
          <li key={it.id} {...itemProps(s, it.id, 'inline')}>
            <span className="cv-highlight-value">{it.value}</span> <span className="cv-highlight-label">{it.label}</span>
          </li>
        ))}
    </ul>
  )

  const renderRows = () =>
    rows.map((row) => (
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
    ))

  const headerSel = clickable({ kind: 'profile' }, selection?.kind === 'profile')

  const photoSrc = theme.showPhoto ? profile.photo || (theme.photoInitials ? initialsImage(profile.name, theme.accent, FONT_FAMILIES[theme.font].css) : '') : ''
  const photo = photoSrc ? (
    <img className={`cv-photo cv-photo--${theme.photoShape}${theme.photoRing ? ' cv-photo--ring' : ''}`} src={photoSrc} alt="" />
  ) : null

  // The H1 holds the name only (parsers take it as the candidate's name); the job title follows on
  // the same line after a real space, so text extraction reads "Name Title", not "NameTitle"
  const name = (
    <div className="cv-name-line">
      <h1 className="cv-name">{profile.name}</h1>
      {profile.title && (
        <>
          {' '}
          <em className="cv-title">{profile.title}</em>
        </>
      )}
    </div>
  )

  const contacts = profile.contacts.length > 0 && (
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
  )

  const summary = profile.summary && (
    <div className="cv-summary">
      <IconBadge name={profile.summaryIcon} />
      <p dangerouslySetInnerHTML={{ __html: inlineMd(profile.summary) }} />
    </div>
  )

  const classes = [
    'cv',
    onSelect ? 'cv--edit' : '',
    `cv--header-${theme.headerStyle}`,
    `cv--title-${theme.titleStyle}`,
    `cv--entry-${theme.entryStyle}`,
  ]
    .filter(Boolean)
    .join(' ')

  if (sidebarMode) {
    // Main column first in the document (name first for parsers); the grid puts the sidebar on the left.
    return (
      <article className={classes} lang={resume.meta.locale} style={resumeStyle(resume)}>
        <div className="cv-main">
          <header className="cv-header" {...headerSel}>
            <div className="cv-header-body">
              {name}
              {summary}
            </div>
          </header>
          {renderRows()}
        </div>
        <aside className="cv-aside">
          <div className="cv-aside-profile" {...headerSel}>
            {photo}
            {contacts}
          </div>
          {sideSections.map(renderSection)}
        </aside>
      </article>
    )
  }

  const header = (
    <header className={`cv-header${photo ? '' : ' cv-header--nophoto'}`} {...headerSel}>
      {photo}
      <div className="cv-header-body">
        {name}
        {contacts}
        {summary}
      </div>
    </header>
  )

  return (
    <article className={classes} lang={resume.meta.locale} style={resumeStyle(resume)}>
      {/* The band is a plain wrapper, so the clickable header keeps its own highlight */}
      {theme.headerStyle === 'band' ? <div className="cv-band">{header}</div> : header}
      {renderRows()}
    </article>
  )
}

interface EntryProps extends HTMLAttributes<HTMLDivElement> {
  entry: TimelineEntry
  entryStyle: EntryStyle
  locale: ResumeLocale
  dateFormat: DateFormat
  showLinkIcon: boolean
}

function EntryView({ entry: e, entryStyle, locale, dateFormat, showLinkIcon, ...rest }: EntryProps) {
  // Written in the resume's language: "mars 2019 – juin 2022", "Mar 2019 – Present"…
  // Each date stays on one line, so a narrow date column breaks the range at the dash
  const parts = dateRangeParts(e, locale, dateFormat)
  const date = parts.length > 0 && (
    <span className="cv-date">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' – '}
          <span className="cv-date-part">{p}</span>
        </Fragment>
      ))}
    </span>
  )
  const flag = FLAGS[e.country]
  const location = (e.location || flag) && (
    <span className="cv-entry-loc">
      {flag && <span className="cv-flag" style={{ backgroundImage: `url("${flag}")` }} />}
      {e.location}
    </span>
  )
  const inline = entryStyle === 'right'
  const href = normalizeHref(e.url)
  return (
    <div className="cv-entry" {...rest}>
      {!inline && (
        <div className="cv-entry-meta">
          {date && <div>{date}</div>}
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
          {href && showLinkIcon && (
            <a className="cv-entry-link" href={href} target="_blank" rel="noopener noreferrer" title={href}>
              <ExternalIcon size={9} />
            </a>
          )}
          {/* "Dates on the right": date · duration · place on the title line, read right after the title */}
          {inline && (date || e.subDate || location) && (
            <span className="cv-entry-metaline">
              {/* One flex item, so the spaces around the dot stay real text */}
              {(date || e.subDate) && (
                <span>
                  {date}
                  {date && e.subDate ? ' · ' : ''}
                  {e.subDate}
                </span>
              )}
              {(date || e.subDate) && location ? ' · ' : ''}
              {location}
            </span>
          )}
        </div>
        {e.bullets.some((b) => b.trim()) && (
          <ul className="cv-bullets">
            {e.bullets
              .filter((b) => b.trim())
              .map((b, i) => (
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
