import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical } from 'lucide-react'
import type { Resume, Selection } from '../types'
import { defineStrings, useStrings } from '../i18n'
import { A4_H_MM, A4_W_MM, COL_GAP_MM, MM, dateColumnFraction, moveItem, moveSectionAnywhere, setColumnWidths, type SidebarAwareDrop } from '../layout'
import { TOUCH, useMediaQuery } from '../media'

const S = defineStrings(
  {
    marginX: 'Marge gauche / droite',
    marginY: 'Marge haut / bas',
    moveSection: 'Glisser pour déplacer la section (ligne, colonne, dessous)',
    reorder: 'Glisser pour réordonner',
    resizeColumns: 'Glisser pour redimensionner les colonnes',
    percent: (n: number) => `${n} %`,
    margin: (mm: number) => `Marge : ${mm} mm`,
  },
  {
    marginX: 'Left / right margin',
    marginY: 'Top / bottom margin',
    moveSection: 'Drag to move the section (row, column, below)',
    reorder: 'Drag to reorder',
    resizeColumns: 'Drag to resize the columns',
    percent: (n) => `${n}%`,
    margin: (mm) => `Margin: ${mm} mm`,
  },
)

/**
 * Direct-manipulation layer drawn over the A4 preview (edit mode only, never printed):
 * - grip on each section → drag into a new row, a new column, or under another section
 * - grip on each entry / list item → reorder, also across sections of the same kind
 * - divider between columns → resize (snaps to the date column, ¼ ⅓ ½ ⅔ ¾)
 * - page-margin guides → page margins
 * With a mouse the tools follow the pointer. On touch screens (no hover) they follow the
 * selected section: its grip and its row's dividers only (items and margins: editor / sliders).
 * It only reads the DOM of the resume (data-* attributes); the resume itself is untouched,
 * so the PDF text order is unaffected.
 */


type Rect = { x: number; y: number; w: number; h: number }
/** data-item-kind: 'entry' (timeline), 'list', or the section kind for levels / facts / references / highlights */
type ItemKind = string
type MarginSide = 'left' | 'right' | 'top' | 'bottom'

type Drag =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'item'; sectionId: string; itemId: string; itemKind: ItemKind; label: string }
  | { kind: 'col'; index: number; colIds: string[]; widths: number[] }
  | { kind: 'margin'; side: MarginSide }

type Drop =
  | { kind: 'section'; drop: SidebarAwareDrop }
  | { kind: 'item'; toSectionId: string; anchorId: string; after: boolean }

interface Geometry {
  section?: { id: string; rect: Rect; titleRect: Rect; label: string; selected: boolean }
  item?: { id: string; owner: string; kind: ItemKind; rect: Rect; label: string; inline: boolean }
  row?: { rect: Rect; cols: { id: string; rect: Rect }[] }
}

interface Props {
  shellRef: RefObject<HTMLDivElement | null>
  resume: Resume
  setResume: (fn: (r: Resume) => Resume) => void
  zoom: number
  /** Current selection, so the hover outline can step aside for a selected section */
  selection: Selection
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const halfMm = (v: number) => Math.round(v * 2) / 2

export function LayoutOverlay({ shellRef, resume, setResume, zoom, selection }: Props) {
  const str = useStrings(S)
  const [hover, setHover] = useState<{ sectionId?: string; itemId?: string }>({})
  const itemBand = useRef<DOMRect | null>(null)
  const itemInline = useRef(false)
  const sectionBand = useRef<DOMRect | null>(null)
  const [geo, setGeo] = useState<Geometry>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const [indicator, setIndicator] = useState<{ line: Rect; vertical: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; text: string } | null>(null)
  const dropRef = useRef<Drop | null>(null)

  /** Shell-relative, un-zoomed coordinates helpers */
  const frame = useCallback(() => {
    const shell = shellRef.current
    if (!shell) return null
    const s = shell.getBoundingClientRect()
    const scale = s.width / (A4_W_MM * MM)
    const rel = (r: DOMRect): Rect => ({ x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale })
    return { shell, s, scale, rel }
  }, [shellRef])

  /* ------------------------------------------------------------- hover tracking */

  // Touch screens have no hover: the tools follow the selected section (tap it on the page),
  // and only sections and columns are handled there (items and margins: editor / sliders)
  const touch = useMediaQuery(TOUCH)
  useEffect(() => {
    if (!touch || drag) return
    const sectionId = selection?.kind === 'section' ? selection.sectionId : undefined
    setHover((h) => (h.sectionId === sectionId && !h.itemId ? h : { sectionId }))
  }, [touch, selection, drag])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || touch) return
    const onMove = (e: PointerEvent) => {
      if (drag) return
      const t = e.target as HTMLElement
      if (t.closest('.layout-overlay')) return // keep hover while on our handles
      const sec = t.closest<HTMLElement>('[data-section-id]')
      const item = t.closest<HTMLElement>('[data-item-id]')
      if (item) {
        itemBand.current = item.getBoundingClientRect()
        itemInline.current = item.dataset.itemFlow === 'inline'
      }
      if (sec) sectionBand.current = sec.getBoundingClientRect()
      const scale = frame()?.scale ?? 1
      const { clientX: x, clientY: y } = e
      setHover((h) => {
        let itemId = item?.dataset.itemId
        // Keep the item while the pointer travels left from it to its grip
        const ib = itemBand.current
        if (!itemId && h.itemId && ib) {
          // Keep the item while the pointer travels to its grip: left of a row, above a tag
          const towardRowGrip = y >= ib.top && y <= ib.bottom && x >= ib.left - 40 * scale && x <= ib.left + 4 * scale
          const towardTagGrip = itemInline.current && x >= ib.left && x <= ib.right && y >= ib.top - 22 * scale && y <= ib.top + 2 * scale
          if (towardRowGrip || towardTagGrip) itemId = h.itemId
        }
        let sectionId = sec?.dataset.sectionId
        // Keep the section only just around it: grip on the left, column gap on the right
        const sb = sectionBand.current
        if (!sectionId && h.sectionId && sb && x >= sb.left - 34 * scale && x <= sb.right + 18 * scale && y >= sb.top && y <= sb.bottom) {
          sectionId = h.sectionId
        }
        const next = { sectionId, itemId }
        return next.sectionId === h.sectionId && next.itemId === h.itemId ? h : next
      })
    }
    const onLeave = () => {
      if (drag) return
      setHover({})
    }
    shell.addEventListener('pointermove', onMove)
    shell.addEventListener('pointerleave', onLeave)
    return () => {
      shell.removeEventListener('pointermove', onMove)
      shell.removeEventListener('pointerleave', onLeave)
    }
  }, [shellRef, drag, frame, touch])

  /* ------------------------------------------------------------- measure */

  useLayoutEffect(() => {
    const f = frame()
    if (!f) return
    const next: Geometry = {}
    const secEl = hover.sectionId ? f.shell.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(hover.sectionId)}"]`) : null
    const section = resume.sections.find((s) => s.id === hover.sectionId)
    if (secEl && section) {
      const title = secEl.querySelector('.cv-section-title') ?? secEl
      next.section = {
        id: section.id,
        rect: f.rel(secEl.getBoundingClientRect()),
        titleRect: f.rel(title.getBoundingClientRect()),
        label: section.title,
        selected: secEl.hasAttribute('data-selected'),
      }
      const rowEl = secEl.closest<HTMLElement>('.cv-row')
      const cols = rowEl ? [...rowEl.querySelectorAll<HTMLElement>(':scope > .cv-col')] : []
      if (rowEl && cols.length > 1) {
        next.row = {
          rect: f.rel(rowEl.getBoundingClientRect()),
          cols: cols.map((c) => ({ id: c.dataset.colKey!, rect: f.rel(c.getBoundingClientRect()) })),
        }
      }
    }
    const itemEl = hover.itemId ? f.shell.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(hover.itemId)}"]`) : null
    if (itemEl) {
      const owner = resume.sections.find((s) => s.id === itemEl.dataset.owner)
      let label = ''
      if (owner?.kind === 'timeline') label = owner.entries.find((e) => e.id === hover.itemId)?.title ?? ''
      if (owner?.kind === 'list') label = owner.items.find((i) => i.id === hover.itemId)?.text ?? ''
      if (owner && owner.kind !== 'timeline' && owner.kind !== 'list' && owner.kind !== 'text') {
        const it = (owner.items as { id: string }[]).find((i) => i.id === hover.itemId) as Record<string, unknown> | undefined
        label = String(it?.name ?? it?.key ?? it?.value ?? '')
      }
      next.item = {
        id: hover.itemId!,
        owner: itemEl.dataset.owner!,
        kind: itemEl.dataset.itemKind as ItemKind,
        inline: itemEl.dataset.itemFlow === 'inline',
        rect: f.rel(itemEl.getBoundingClientRect()),
        label,
      }
    }
    // Measured after every edit: only re-render the overlay when something actually moved
    setGeo((g) => (JSON.stringify(g) === JSON.stringify(next) ? g : next))
  }, [hover, resume, zoom, frame, selection])

  /* ------------------------------------------------------------- hit testing */

  const gapPx = () => {
    const d = getComputedStyle(shellRef.current!.querySelector('.cv')!).getPropertyValue('--gap-section')
    return (parseFloat(d) || 4.6) * MM
  }

  const sectionTarget = (x: number, y: number, draggedId: string): { drop: Drop; line: Rect; vertical: boolean } | null => {
    const f = frame()
    if (!f) return null
    const g = gapPx() * f.scale // client px

    // Sidebar header style: dropping inside the coloured column moves the section into it
    const aside = f.shell.querySelector<HTMLElement>('.cv-aside')
    if (aside) {
      const ar = aside.getBoundingClientRect()
      if (x >= ar.left && x <= ar.right && y >= ar.top && y <= ar.bottom) {
        const secs = [...aside.querySelectorAll<HTMLElement>(':scope > [data-section-id]')].filter((s) => s.dataset.sectionId !== draggedId)
        const sec = secs.find((s) => y <= s.getBoundingClientRect().bottom) ?? secs[secs.length - 1]
        const sr = sec?.getBoundingClientRect()
        const after = sr ? y > sr.top + sr.height / 2 : false
        const lineY = sr ? (after ? sr.bottom + g / 2 : sr.top - g / 2) : ar.bottom - g
        return {
          drop: { kind: 'section', drop: { kind: 'sidebar', anchorId: sec?.dataset.sectionId ?? null, after } },
          line: { x: (ar.left - f.s.left) / f.scale + 8, y: (lineY - f.s.top) / f.scale - 1.5, w: ar.width / f.scale - 16, h: 3 },
          vertical: false,
        }
      }
    }

    const rows = [...f.shell.querySelectorAll<HTMLElement>(':is(.cv, .cv-main) > .cv-row')]
    if (!rows.length) return null
    const content = f.rel(rows[0].getBoundingClientRect())
    const hline = (clientY: number, left = content.x, width = content.w): Rect => ({ x: left, y: (clientY - f.s.top) / f.scale - 1.5, w: width, h: 3 })
    const rowDrop = (beforeId: string | null, clientY: number) => ({
      drop: { kind: 'section', drop: { kind: 'row', beforeSectionId: beforeId } } as Drop,
      line: hline(clientY),
      vertical: false,
    })

    for (let i = 0; i < rows.length; i++) {
      const rr = rows[i].getBoundingClientRect()
      if (y < rr.top) {
        const prevBottom = i ? rows[i - 1].getBoundingClientRect().bottom : rr.top - g
        return rowDrop(rows[i].dataset.rowKey!, (prevBottom + rr.top) / 2)
      }
      if (y > rr.bottom) continue

      const cols = [...rows[i].querySelectorAll<HTMLElement>(':scope > .cv-col')]
      const col =
        cols.find((c) => {
          const r = c.getBoundingClientRect()
          return x >= r.left - g / 2 && x <= r.right + g / 2
        }) ?? (x < cols[0].getBoundingClientRect().left ? cols[0] : cols[cols.length - 1])
      const cr = col.getBoundingClientRect()
      const secs = [...col.querySelectorAll<HTMLElement>(':scope > [data-section-id]')]
      const sec =
        secs.find((s) => y <= s.getBoundingClientRect().bottom + g / 2) ?? secs[secs.length - 1]
      const sr = sec.getBoundingClientRect()
      const sid = sec.dataset.sectionId!
      const relX = (x - cr.left) / cr.width

      if (relX < 0.2 || relX > 0.8) {
        const side = relX < 0.2 ? 'left' : 'right'
        const lineX = side === 'left' ? cr.left - g / 4 : cr.right + g / 4
        return {
          drop: { kind: 'section', drop: { kind: 'column', sectionId: sid, side } },
          line: { x: (lineX - f.s.left) / f.scale - 1.5, y: (rr.top - f.s.top) / f.scale, w: 3, h: rr.height / f.scale },
          vertical: true,
        }
      }
      const after = y > sr.top + sr.height / 2
      if (cols.length > 1) {
        const lineY = after ? sr.bottom + g / 2 : sr.top - g / 2
        return {
          drop: { kind: 'section', drop: { kind: 'stack', sectionId: sid, after } },
          line: hline(lineY, (cr.left - f.s.left) / f.scale, cr.width / f.scale),
          vertical: false,
        }
      }
      if (after) return rowDrop(rows[i + 1]?.dataset.rowKey ?? null, sr.bottom + g / 2)
      return rowDrop(rows[i].dataset.rowKey!, sr.top - g / 2)
    }
    const last = rows[rows.length - 1].getBoundingClientRect()
    return rowDrop(null, last.bottom + g / 2)
  }

  const itemTarget = (x: number, y: number, kind: ItemKind, draggedId: string): { drop: Drop; line: Rect; vertical: boolean } | null => {
    const f = frame()
    if (!f) return null
    const items = [...f.shell.querySelectorAll<HTMLElement>(`[data-item-kind="${CSS.escape(kind)}"]`)].filter((el) => el.dataset.itemId !== draggedId)
    if (!items.length) return null
    let best: HTMLElement | null = null
    let bestD = Infinity
    for (const el of items) {
      const r = el.getBoundingClientRect()
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      const d = dx * 3 + dy // prefer the same column
      if (d < bestD) {
        bestD = d
        best = el
      }
    }
    if (!best) return null
    const r = best.getBoundingClientRect()
    const drop = (after: boolean): Drop => ({ kind: 'item', toSectionId: best.dataset.owner!, anchorId: best.dataset.itemId!, after })
    // Tags sit side by side: drop before / after by x, with a vertical marker
    if (best.dataset.itemFlow === 'inline') {
      const after = x > r.left + r.width / 2
      const lineX = after ? r.right + 2 : r.left - 2
      return {
        drop: drop(after),
        line: { x: (lineX - f.s.left) / f.scale - 1.5, y: (r.top - f.s.top) / f.scale, w: 3, h: r.height / f.scale },
        vertical: true,
      }
    }
    const after = y > r.top + r.height / 2
    const lineY = after ? r.bottom + 1 : r.top - 1
    return {
      drop: drop(after),
      line: { x: (r.left - f.s.left) / f.scale, y: (lineY - f.s.top) / f.scale - 1.5, w: r.width / f.scale, h: 3 },
      vertical: false,
    }
  }

  /* ------------------------------------------------------------- drag lifecycle */

  useEffect(() => {
    if (!drag) return
    const f0 = frame()
    if (!f0) return
    document.body.classList.add('is-layout-dragging')

    // Edge autoscroll: while a section / item is held near the top or bottom of the preview,
    // keep scrolling it (the page is taller than the screen, more so on phones)
    const scroller = f0.shell.closest<HTMLElement>('.preview')
    let last: { x: number; y: number } | null = null
    let raf = 0
    const autoscroll = () => {
      raf = 0
      if (!scroller || !last || (drag.kind !== 'section' && drag.kind !== 'item')) return
      const r = scroller.getBoundingClientRect()
      const edge = 56
      const dy = last.y < r.top + edge ? last.y - (r.top + edge) : last.y > r.bottom - edge ? last.y - (r.bottom - edge) : 0
      if (!dy) return
      const before = scroller.scrollTop
      scroller.scrollTop += Math.round(clamp(dy / 3, -18, 18))
      if (scroller.scrollTop === before) return
      move(last.x, last.y) // the page moved under the pointer: aim again
      raf = requestAnimationFrame(autoscroll)
    }

    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY }
      move(e.clientX, e.clientY)
      if (!raf) raf = requestAnimationFrame(autoscroll)
    }

    const move = (x: number, y: number) => {
      const f = frame()!
      switch (drag.kind) {
        case 'section':
        case 'item': {
          const t = drag.kind === 'section' ? sectionTarget(x, y, drag.id) : itemTarget(x, y, drag.itemKind, drag.itemId)
          dropRef.current = t?.drop ?? null
          setIndicator(t ? { line: t.line, vertical: t.vertical } : null)
          setGhost({ x, y, text: drag.label })
          break
        }
        case 'col': {
          const rowEl = f.shell.querySelector<HTMLElement>(`[data-col-key="${CSS.escape(drag.colIds[0])}"]`)?.parentElement
          if (!rowEl) break
          const rr = rowEl.getBoundingClientRect()
          const n = drag.widths.length
          const g = COL_GAP_MM * MM * f.scale
          const usable = rr.width - g * (n - 1)
          const prev = drag.widths.slice(0, drag.index).reduce((a, b) => a + b, 0)
          const next = prev + drag.widths[drag.index] + drag.widths[drag.index + 1]
          let cum = (x - rr.left - g / 2 - drag.index * g) / usable
          cum = clamp(cum, prev + 0.08, next - 0.08)
          // Snap to the date column and simple fractions
          const snaps = [dateColumnFraction(resume.theme.dateColumn, resume.theme.marginX, n), 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4]
          const snap = snaps.find((sv) => Math.abs(sv - cum) < 0.015 && sv > prev + 0.05 && sv < next - 0.05)
          if (snap !== undefined) cum = snap
          const widths = drag.widths.slice()
          widths[drag.index] = cum - prev
          widths[drag.index + 1] = next - cum
          setResume((r) => ({ ...r, sections: setColumnWidths(r.sections, drag.colIds.map((id, i) => ({ sectionId: id, width: widths[i] }))) }))
          setGhost({ x, y, text: widths.map((w) => str.percent(Math.round(w * 100))).join(' · ') + (snap !== undefined ? '  ⟂' : '') })
          break
        }
        case 'margin': {
          const px = drag.side === 'left' ? x - f.s.left : drag.side === 'right' ? f.s.right - x : drag.side === 'top' ? y - f.s.top : f.s.top + A4_H_MM * MM * f.scale - y
          const v = clamp(halfMm(px / f.scale / MM), 4, 35)
          const key = drag.side === 'left' || drag.side === 'right' ? 'marginX' : 'marginY'
          setResume((r) => ({ ...r, theme: { ...r.theme, [key]: v } }))
          setGhost({ x, y, text: str.margin(v) })
          break
        }
      }
    }

    const onUp = () => {
      const d = dropRef.current
      if (d && drag.kind === 'section' && d.kind === 'section') {
        setResume((r) => ({ ...r, sections: moveSectionAnywhere(r.sections, drag.id, d.drop, r.theme.headerStyle === 'sidebar') }))
      } else if (d && drag.kind === 'item' && d.kind === 'item') {
        setResume((r) => ({ ...r, sections: moveItem(r.sections, drag.sectionId, drag.itemId, d.toSectionId, d.anchorId, d.after) }))
      }
      dropRef.current = null
      setDrag(null)
      setIndicator(null)
      setGhost(null)
    }

    // Cancel (Esc, pointer cancelled, window left): no drop, and column / margin drags, which
    // apply live, go back to how they were when the drag started (`resume` is that state here)
    const cancel = () => {
      const start = resume
      if (drag.kind === 'col') setResume((r) => (r.sections === start.sections ? r : { ...r, sections: start.sections }))
      if (drag.kind === 'margin') {
        const { marginX, marginY } = start.theme
        setResume((r) => (r.theme.marginX === marginX && r.theme.marginY === marginY ? r : { ...r, theme: { ...r.theme, marginX, marginY } }))
      }
      dropRef.current = null
      onUp()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.body.classList.remove('is-layout-dragging')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', onKey)
    }
    // Runs once per drag: the handlers read the state of the render that started it
  }, [drag])

  const start = (d: Drag) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setDrag(d)
  }

  /* ------------------------------------------------------------- render */

  const { theme } = resume
  const mx = theme.marginX * MM
  const my = theme.marginY * MM
  const pageW = A4_W_MM * MM
  const pageH = A4_H_MM * MM
  // Only show the tools for what is under the pointer: an item, or else its section
  const showSectionTools = !drag && geo.section && !geo.item
  const showDividers = (!drag && !geo.item) || drag?.kind === 'col'
  // Margin guides appear only on hover of their own edge, or (both of a pair) while dragging
  const marginDrag = drag?.kind === 'margin' ? drag.side : null
  const xActive = marginDrag === 'left' || marginDrag === 'right'
  const yActive = marginDrag === 'top' || marginDrag === 'bottom'
  // Touch: finger-sized handles whatever the zoom (the overlay is inside the zoomed stage)
  const inv = 1 / zoom
  const grip = touch ? 40 * inv : 22
  const gripPos = (s: NonNullable<Geometry['section']>) =>
    touch
      ? // Inside the selected section, at the end of its title row (no room left of the page margin)
        { left: s.rect.x + s.rect.w - grip, top: s.titleRect.y + s.titleRect.h / 2 - grip / 2 }
      : { left: s.rect.x - 26, top: s.titleRect.y + s.titleRect.h / 2 - 11 }
  const dividerW = touch ? 28 * inv : 10

  return (
    <div
      className={`layout-overlay${drag ? ' is-dragging' : ''}${touch ? ' is-touch' : ''}`}
      style={{ '--lo-inv': inv } as CSSProperties}
      aria-hidden="true"
    >
      {/* Page margins (mouse only: touch screens use the sliders in Apparence) */}
      <div className="margin-guides" hidden={touch}>
        <div className={`margin-guide margin-guide--v margin-guide--left${xActive ? ' is-active' : ''}`} style={{ left: mx, top: 0, height: '100%' }} onPointerDown={start({ kind: 'margin', side: 'left' })} title={str.marginX} />
        <div className={`margin-guide margin-guide--v margin-guide--right${xActive ? ' is-active' : ''}`} style={{ left: pageW - mx, top: 0, height: '100%' }} onPointerDown={start({ kind: 'margin', side: 'right' })} title={str.marginX} />
        <div className={`margin-guide margin-guide--h margin-guide--top${yActive ? ' is-active' : ''}`} style={{ top: my, left: 0, width: pageW }} onPointerDown={start({ kind: 'margin', side: 'top' })} title={str.marginY} />
        <div className={`margin-guide margin-guide--h margin-guide--bottom${yActive ? ' is-active' : ''}`} style={{ top: pageH - my, left: 0, width: pageW }} onPointerDown={start({ kind: 'margin', side: 'bottom' })} title={str.marginY} />
      </div>

      {/* Hovered section: outline and grip */}
      {showSectionTools && geo.section && (
        <>
          {!geo.section.selected && <div className="lo-outline" style={box(geo.section.rect, 1.2 * MM)} />}
          {/* Pointer only (the overlay is aria-hidden): the keyboard reorders in the side-panel list */}
          <button
            tabIndex={-1}
            className="lo-grip lo-grip--section"
            style={gripPos(geo.section)}
            onPointerDown={start({ kind: 'section', id: geo.section.id, label: geo.section.label })}
            title={str.moveSection}
          >
            <GripVertical size={touch ? 22 * inv : 14} />
          </button>
        </>
      )}

      {/* Hovered entry / list item grip */}
      {!drag && !touch && geo.item && (
        <button
          tabIndex={-1}
          className="lo-grip lo-grip--item"
          style={
            geo.item.inline
              ? // Tags: grip centered above the tag, so it doesn't cover the previous one
                { left: geo.item.rect.x + geo.item.rect.w / 2 - 8, top: geo.item.rect.y - 19 }
              : { left: geo.item.rect.x - 17, top: geo.item.rect.y + (geo.item.kind === 'entry' ? 0 : geo.item.rect.h / 2 - 9) }
          }
          onPointerDown={start({ kind: 'item', sectionId: geo.item.owner, itemId: geo.item.id, itemKind: geo.item.kind, label: geo.item.label })}
          title={str.reorder}
        >
          <GripVertical size={12} />
        </button>
      )}

      {/* Column dividers of the hovered row */}
      {showDividers &&
        geo.row?.cols.slice(0, -1).map((c, i) => {
          const nextCol = geo.row!.cols[i + 1]
          const x = (c.rect.x + c.rect.w + nextCol.rect.x) / 2
          return (
            <div
              key={c.id}
              className={`lo-divider${drag?.kind === 'col' && drag.index === i ? ' is-active' : ''}`}
              style={{ left: x - dividerW / 2, width: dividerW, top: geo.row!.rect.y, height: geo.row!.rect.h }}
              onPointerDown={start({ kind: 'col', index: i, colIds: geo.row!.cols.map((cc) => cc.id), widths: colWidths(geo.row!.cols.map((cc) => cc.rect.w)) })}
              title={str.resizeColumns}
            />
          )
        })}

      {indicator && <div className={`lo-indicator${indicator.vertical ? ' is-vertical' : ''}`} style={box(indicator.line)} />}

      {ghost && createPortal(<div className="lo-ghost" style={{ left: ghost.x + 14, top: ghost.y + 12 }}>{ghost.text}</div>, document.body)}
    </div>
  )
}

function box(r: Rect, pad = 0) {
  return { left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 }
}

/** Current column widths as fractions of the usable row width (rendered sizes). */
function colWidths(px: number[]) {
  const total = px.reduce((a, b) => a + b, 0) || 1
  return px.map((w) => w / total)
}
