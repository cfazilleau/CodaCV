import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical } from 'lucide-react'
import type { Resume } from '../types'
import { COL_GAP_MM, dateColumnFraction, moveItem, moveSection, setColumnWidths, type SectionDrop } from '../layout'

/**
 * Direct-manipulation layer drawn over the A4 preview (edit mode only, never printed):
 * - grip on each section → drag into a new row, a new column, or under another section
 * - grip on each entry / list item → reorder, also across sections of the same kind
 * - divider between columns → resize (snaps to the date column, ¼ ⅓ ½ ⅔ ¾)
 * - bar above a section → its spacing
 * - page-margin guides → page margins
 * It only reads the DOM of the resume (data-* attributes); the resume itself is untouched,
 * so the PDF text order is unaffected.
 */

const MM = 96 / 25.4
const A4_W_MM = 210
const A4_H_MM = 297

type Rect = { x: number; y: number; w: number; h: number }
type ItemKind = 'entry' | 'list'
type MarginSide = 'left' | 'right' | 'top' | 'bottom'

type Drag =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'item'; sectionId: string; itemId: string; itemKind: ItemKind; label: string }
  | { kind: 'space'; sectionId: string; startY: number; start: number }
  | { kind: 'col'; index: number; colIds: string[]; widths: number[] }
  | { kind: 'margin'; side: MarginSide }

type Drop =
  | { kind: 'section'; drop: SectionDrop }
  | { kind: 'item'; toSectionId: string; anchorId: string; after: boolean }

interface Geometry {
  section?: { id: string; rect: Rect; titleRect: Rect; label: string; space: number }
  item?: { id: string; owner: string; kind: ItemKind; rect: Rect; label: string }
  row?: { rect: Rect; cols: { id: string; rect: Rect }[] }
}

interface Props {
  shellRef: RefObject<HTMLDivElement | null>
  resume: Resume
  setResume: (fn: (r: Resume) => Resume) => void
  zoom: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const halfMm = (v: number) => Math.round(v * 2) / 2

export function LayoutOverlay({ shellRef, resume, setResume, zoom }: Props) {
  const [hover, setHover] = useState<{ sectionId?: string; itemId?: string }>({})
  const itemBand = useRef<DOMRect | null>(null)
  const sectionBand = useRef<DOMRect | null>(null)
  const [geo, setGeo] = useState<Geometry>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const [indicator, setIndicator] = useState<{ line: Rect; vertical: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; text: string } | null>(null)
  const dropRef = useRef<Drop | null>(null)
  const single = resume.theme.layout === 'single-column'

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

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const onMove = (e: PointerEvent) => {
      if (drag) return
      const t = e.target as HTMLElement
      if (t.closest('.layout-overlay')) return // keep hover while on our handles
      const sec = t.closest<HTMLElement>('[data-section-id]')
      const item = t.closest<HTMLElement>('[data-item-id]')
      if (item) itemBand.current = item.getBoundingClientRect()
      if (sec) sectionBand.current = sec.getBoundingClientRect()
      const scale = frame()?.scale ?? 1
      const { clientX: x, clientY: y } = e
      setHover((h) => {
        let itemId = item?.dataset.itemId
        // Keep the item while the pointer travels left from it to its grip
        const ib = itemBand.current
        if (!itemId && h.itemId && ib && y >= ib.top && y <= ib.bottom && x >= ib.left - 40 * scale && x <= ib.left + 4 * scale) {
          itemId = h.itemId
        }
        let sectionId = sec?.dataset.sectionId
        // Keep the section only just around it: grip on the left, spacing bar on top, column gap on the right
        const sb = sectionBand.current
        if (!sectionId && h.sectionId && sb && x >= sb.left - 34 * scale && x <= sb.right + 18 * scale && y >= sb.top - 12 * scale && y <= sb.bottom) {
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
  }, [shellRef, drag, frame])

  /* ------------------------------------------------------------- measure */

  useLayoutEffect(() => {
    const f = frame()
    if (!f) return
    const next: Geometry = {}
    const secEl = hover.sectionId ? f.shell.querySelector<HTMLElement>(`[data-section-id="${hover.sectionId}"]`) : null
    const section = resume.sections.find((s) => s.id === hover.sectionId)
    if (secEl && section) {
      const title = secEl.querySelector('.cv-section-title') ?? secEl
      next.section = {
        id: section.id,
        rect: f.rel(secEl.getBoundingClientRect()),
        titleRect: f.rel(title.getBoundingClientRect()),
        label: section.title,
        space: section.spaceBefore ?? 0,
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
    const itemEl = hover.itemId ? f.shell.querySelector<HTMLElement>(`[data-item-id="${hover.itemId}"]`) : null
    if (itemEl) {
      const owner = resume.sections.find((s) => s.id === itemEl.dataset.owner)
      let label = ''
      if (owner?.kind === 'timeline') label = owner.entries.find((e) => e.id === hover.itemId)?.title ?? ''
      if (owner?.kind === 'list') label = owner.items.find((i) => i.id === hover.itemId)?.text ?? ''
      next.item = {
        id: hover.itemId!,
        owner: itemEl.dataset.owner!,
        kind: itemEl.dataset.itemKind as ItemKind,
        rect: f.rel(itemEl.getBoundingClientRect()),
        label,
      }
    }
    setGeo(next)
  }, [hover, resume, zoom, frame])

  /* ------------------------------------------------------------- hit testing */

  const gapPx = () => {
    const d = getComputedStyle(shellRef.current!.querySelector('.cv')!).getPropertyValue('--gap-section')
    return (parseFloat(d) || 4.6) * MM
  }

  const sectionTarget = (x: number, y: number, draggedId: string): { drop: Drop; line: Rect; vertical: boolean } | null => {
    const f = frame()
    if (!f) return null
    const rows = [...f.shell.querySelectorAll<HTMLElement>('.cv > .cv-row')]
    if (!rows.length) return null
    const g = gapPx() * f.scale // client px
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

      if (!single && (relX < 0.2 || relX > 0.8)) {
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
    void draggedId
    return rowDrop(null, last.bottom + g / 2)
  }

  const itemTarget = (x: number, y: number, kind: ItemKind, draggedId: string): { drop: Drop; line: Rect; vertical: boolean } | null => {
    const f = frame()
    if (!f) return null
    const items = [...f.shell.querySelectorAll<HTMLElement>(`[data-item-kind="${kind}"]`)].filter((el) => el.dataset.itemId !== draggedId)
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
    const after = y > r.top + r.height / 2
    const lineY = after ? r.bottom + 1 : r.top - 1
    return {
      drop: { kind: 'item', toSectionId: best.dataset.owner!, anchorId: best.dataset.itemId!, after },
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

    const onMove = (e: PointerEvent) => {
      const f = frame()!
      const { clientX: x, clientY: y } = e
      switch (drag.kind) {
        case 'section':
        case 'item': {
          const t = drag.kind === 'section' ? sectionTarget(x, y, drag.id) : itemTarget(x, y, drag.itemKind, drag.itemId)
          dropRef.current = t?.drop ?? null
          setIndicator(t ? { line: t.line, vertical: t.vertical } : null)
          setGhost({ x, y, text: drag.label })
          break
        }
        case 'space': {
          const delta = (y - drag.startY) / f.scale / MM
          const v = clamp(halfMm(drag.start + delta), -10, 40)
          setResume((r) => ({ ...r, sections: r.sections.map((s) => (s.id === drag.sectionId ? { ...s, spaceBefore: v } : s)) }))
          setGhost({ x, y, text: `Espace : ${v > 0 ? '+' : ''}${v} mm` })
          break
        }
        case 'col': {
          const rowEl = f.shell.querySelector<HTMLElement>(`[data-col-key="${drag.colIds[0]}"]`)?.parentElement
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
          setGhost({ x, y, text: widths.map((w) => `${Math.round(w * 100)} %`).join(' · ') + (snap !== undefined ? '  ⟂' : '') })
          break
        }
        case 'margin': {
          const px = drag.side === 'left' ? x - f.s.left : drag.side === 'right' ? f.s.right - x : drag.side === 'top' ? y - f.s.top : f.s.top + A4_H_MM * MM * f.scale - y
          const v = clamp(halfMm(px / f.scale / MM), 4, 35)
          const key = drag.side === 'left' || drag.side === 'right' ? 'marginX' : 'marginY'
          setResume((r) => ({ ...r, theme: { ...r.theme, [key]: v } }))
          setGhost({ x, y, text: `Marge : ${v} mm` })
          break
        }
      }
    }

    const onUp = () => {
      const d = dropRef.current
      if (d && drag.kind === 'section' && d.kind === 'section') {
        setResume((r) => ({ ...r, sections: moveSection(r.sections, drag.id, d.drop) }))
      } else if (d && drag.kind === 'item' && d.kind === 'item') {
        setResume((r) => ({ ...r, sections: moveItem(r.sections, drag.sectionId, drag.itemId, d.toSectionId, d.anchorId, d.after) }))
      }
      dropRef.current = null
      setDrag(null)
      setIndicator(null)
      setGhost(null)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      dropRef.current = null
      onUp()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('is-layout-dragging')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className={`layout-overlay${drag ? ' is-dragging' : ''}`} aria-hidden="true">
      {/* Page margins */}
      <div className="margin-guides">
        <div className={`margin-guide margin-guide--v margin-guide--left${xActive ? ' is-active' : ''}`} style={{ left: mx, top: 0, height: '100%' }} onPointerDown={start({ kind: 'margin', side: 'left' })} title="Marge gauche / droite" />
        <div className={`margin-guide margin-guide--v margin-guide--right${xActive ? ' is-active' : ''}`} style={{ left: pageW - mx, top: 0, height: '100%' }} onPointerDown={start({ kind: 'margin', side: 'right' })} title="Marge gauche / droite" />
        <div className={`margin-guide margin-guide--h margin-guide--top${yActive ? ' is-active' : ''}`} style={{ top: my, left: 0, width: pageW }} onPointerDown={start({ kind: 'margin', side: 'top' })} title="Marge haut / bas" />
        <div className={`margin-guide margin-guide--h margin-guide--bottom${yActive ? ' is-active' : ''}`} style={{ top: pageH - my, left: 0, width: pageW }} onPointerDown={start({ kind: 'margin', side: 'bottom' })} title="Marge haut / bas" />
      </div>

      {/* Hovered section: outline, grip, spacing bar */}
      {showSectionTools && geo.section && (
        <>
          <div className="lo-outline" style={box(geo.section.rect, 3)} />
          <button
            className="lo-grip lo-grip--section"
            style={{ left: geo.section.rect.x - 26, top: geo.section.titleRect.y + geo.section.titleRect.h / 2 - 11 }}
            onPointerDown={start({ kind: 'section', id: geo.section.id, label: geo.section.label })}
            title="Glisser pour déplacer la section (ligne, colonne, dessous)"
          >
            <GripVertical size={14} />
          </button>
          <div
            className="lo-space"
            style={{ left: geo.section.rect.x + geo.section.rect.w / 2 - 22, top: geo.section.rect.y - 7 }}
            onPointerDown={(e) => start({ kind: 'space', sectionId: geo.section!.id, startY: e.clientY, start: geo.section!.space })(e)}
            title="Glisser pour ajuster l'espace au-dessus"
          >
            {geo.section.space !== 0 && <span>{geo.section.space > 0 ? '+' : ''}{geo.section.space}</span>}
          </div>
        </>
      )}

      {/* Hovered entry / list item grip */}
      {!drag && geo.item && (
        <button
          className="lo-grip lo-grip--item"
          style={{ left: geo.item.rect.x - 17, top: geo.item.rect.y + (geo.item.kind === 'entry' ? 0 : geo.item.rect.h / 2 - 9) }}
          onPointerDown={start({ kind: 'item', sectionId: geo.item.owner, itemId: geo.item.id, itemKind: geo.item.kind, label: geo.item.label })}
          title="Glisser pour réordonner"
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
              style={{ left: x - 5, top: geo.row!.rect.y, height: geo.row!.rect.h }}
              onPointerDown={start({ kind: 'col', index: i, colIds: geo.row!.cols.map((cc) => cc.id), widths: colWidths(geo.row!.cols.map((cc) => cc.rect.w)) })}
              title="Glisser pour redimensionner les colonnes"
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
