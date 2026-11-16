/**
 * Page layout: sections are grouped into rows → columns → stacked sections using each
 * section's `place` flag. The sections array order stays the reading order (and the PDF text
 * order), so every operation here rewrites that order plus the flags.
 */
import type { ListItem, Section, TimelineEntry } from './types'

export const COL_GAP_MM = 4

interface SCol {
  ids: string[]
  width: number
}
type SRow = SCol[]

function toStructure(sections: Section[]): SRow[] {
  const rows: SRow[] = []
  for (const s of sections) {
    const row = rows[rows.length - 1]
    const col = row?.[row.length - 1]
    if (!row || !s.place || s.place === 'row') rows.push([{ ids: [s.id], width: s.colWidth ?? 1 }])
    else if (s.place === 'column') row.push({ ids: [s.id], width: s.colWidth ?? 1 })
    else col.ids.push(s.id)
  }
  return rows
}

const round = (n: number) => Math.round(n * 10000) / 10000

function fromStructure(sections: Section[], rows: SRow[]): Section[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  const out: Section[] = []
  for (const row of rows) {
    const total = row.reduce((a, c) => a + c.width, 0) || 1
    row.forEach((col, ci) =>
      col.ids.forEach((id, si) => {
        const s = byId.get(id)
        if (!s) return
        if (row.length === 1) {
          // A single column is the same as full-width rows
          out.push({ ...s, place: 'row', colWidth: undefined })
        } else {
          out.push({
            ...s,
            place: si > 0 ? 'stack' : ci === 0 ? 'row' : 'column',
            colWidth: si === 0 ? round(col.width / total) : undefined,
          })
        }
      }),
    )
  }
  return out
}

/** Re-derive clean flags (e.g. after editing `place` by hand). */
export function normalizeLayout(sections: Section[]): Section[] {
  return fromStructure(sections, toStructure(sections))
}

export interface LayoutColumn {
  key: string
  width: number // fraction of the row
  sections: Section[]
}
export interface LayoutRow {
  key: string
  columns: LayoutColumn[]
}

/** Visible rows/columns for rendering. */
export function buildRows(sections: Section[]): LayoutRow[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  const rows: LayoutRow[] = []
  for (const row of toStructure(sections)) {
    const cols = row
      .map((c) => ({ width: c.width, sections: c.ids.map((id) => byId.get(id)!).filter((s) => s.visible) }))
      .filter((c) => c.sections.length > 0)
    if (!cols.length) continue
    const total = cols.reduce((a, c) => a + c.width, 0) || 1
    rows.push({
      key: cols[0].sections[0].id,
      columns: cols.map((c) => ({ key: c.sections[0].id, width: cols.length === 1 ? 1 : c.width / total, sections: c.sections })),
    })
  }
  return rows
}

export type SectionDrop =
  | { kind: 'row'; beforeSectionId: string | null } // new full-width row before the row holding that section (null = end)
  | { kind: 'stack'; sectionId: string; after: boolean } // in the same column, above/below that section
  | { kind: 'column'; sectionId: string; side: 'left' | 'right' } // new column beside the column holding that section

export function moveSection(sections: Section[], id: string, drop: SectionDrop): Section[] {
  const anchor = drop.kind === 'row' ? drop.beforeSectionId : drop.sectionId
  if (anchor === id) return sections
  const rows = toStructure(sections)

  outer: for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const col = rows[r][c]
      const i = col.ids.indexOf(id)
      if (i < 0) continue
      col.ids.splice(i, 1)
      if (!col.ids.length) {
        rows[r].splice(c, 1)
        if (!rows[r].length) rows.splice(r, 1)
      }
      break outer
    }
  }

  const find = (sid: string) => {
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].length; c++) {
        const i = rows[r][c].ids.indexOf(sid)
        if (i >= 0) return { r, c, i }
      }
    return null
  }

  switch (drop.kind) {
    case 'row': {
      const at = drop.beforeSectionId === null ? rows.length : find(drop.beforeSectionId)?.r
      if (at === undefined) return sections
      rows.splice(at, 0, [{ ids: [id], width: 1 }])
      break
    }
    case 'stack': {
      const p = find(drop.sectionId)
      if (!p) return sections
      rows[p.r][p.c].ids.splice(p.i + (drop.after ? 1 : 0), 0, id)
      break
    }
    case 'column': {
      const p = find(drop.sectionId)
      if (!p) return sections
      const row = rows[p.r]
      const total = row.reduce((a, c) => a + c.width, 0) || 1
      // New column takes an equal share
      row.splice(p.c + (drop.side === 'right' ? 1 : 0), 0, { ids: [id], width: total / row.length })
      break
    }
  }
  return fromStructure(sections, rows)
}

/** Set column widths (fractions) for the columns starting with / containing these sections. */
export function setColumnWidths(sections: Section[], widths: { sectionId: string; width: number }[]): Section[] {
  const rows = toStructure(sections)
  for (const { sectionId, width } of widths) {
    for (const row of rows) for (const col of row) if (col.ids.includes(sectionId)) col.width = width
  }
  return fromStructure(sections, rows)
}

type Item = TimelineEntry | ListItem

function itemsOf(s: Section): Item[] | null {
  return s.kind === 'timeline' ? s.entries : s.kind === 'list' ? s.items : null
}

function withItems(s: Section, items: Item[]): Section {
  if (s.kind === 'timeline') return { ...s, entries: items as TimelineEntry[] }
  if (s.kind === 'list') return { ...s, items: items as ListItem[] }
  return s
}

/** Move an entry / list item before or after another one, possibly into another section of the same kind. */
export function moveItem(
  sections: Section[],
  fromSectionId: string,
  itemId: string,
  toSectionId: string,
  anchorId: string,
  after: boolean,
): Section[] {
  if (anchorId === itemId) return sections
  const from = sections.find((s) => s.id === fromSectionId)
  const to = sections.find((s) => s.id === toSectionId)
  if (!from || !to || from.kind !== to.kind) return sections
  const item = itemsOf(from)?.find((i) => i.id === itemId)
  if (!item) return sections
  return sections.map((s) => {
    let list = itemsOf(s)
    if (!list || (s.id !== fromSectionId && s.id !== toSectionId)) return s
    if (s.id === fromSectionId) list = list.filter((i) => i.id !== itemId)
    if (s.id === toSectionId) {
      const at = list.findIndex((i) => i.id === anchorId)
      if (at < 0) return s
      list = [...list.slice(0, at + (after ? 1 : 0)), item, ...list.slice(at + (after ? 1 : 0))]
    }
    return withItems(s, list)
  })
}

/* ------------------------------------------------------------- Sidebar header style */

/** In the "sidebar" header style: does this section go in the coloured column? (default: lists) */
export const isInSidebar = (s: Section) => s.sidebar ?? s.kind === 'list'

/** Keep main sections first and sidebar sections last: that is the document (and PDF text) order. */
export function orderForSidebar(sections: Section[]): Section[] {
  return [...normalizeLayout(sections.filter((s) => !isInSidebar(s))), ...sections.filter(isInSidebar)]
}

export type SidebarAwareDrop = SectionDrop | { kind: 'sidebar'; anchorId: string | null; after: boolean }

/** moveSection, plus moving sections into / out of the sidebar when that header style is on. */
export function moveSectionAnywhere(sections: Section[], id: string, drop: SidebarAwareDrop, sidebarMode: boolean): Section[] {
  if (!sidebarMode) return drop.kind === 'sidebar' ? sections : moveSection(sections, id, drop)
  const dragged = sections.find((s) => s.id === id)
  if (!dragged) return sections
  const main = sections.filter((s) => s.id !== id && !isInSidebar(s))
  const side = sections.filter((s) => s.id !== id && isInSidebar(s))
  if (drop.kind === 'sidebar') {
    const moved: Section = { ...dragged, sidebar: true, place: 'row', colWidth: undefined }
    let at = drop.anchorId ? side.findIndex((s) => s.id === drop.anchorId) : side.length
    if (at < 0) at = side.length
    else if (drop.anchorId && drop.after) at++
    return [...normalizeLayout(main), ...side.slice(0, at), moved, ...side.slice(at)]
  }
  const moved: Section = { ...dragged, sidebar: false }
  return [...moveSection([...main, moved], id, drop), ...side]
}

/** Column fraction that lines a first column up with the timeline date column. */
export function dateColumnFraction(dateColMm: number, marginXMm: number, columns = 2): number {
  const content = 210 - 2 * marginXMm - COL_GAP_MM * (columns - 1)
  return Math.min(0.9, Math.max(0.05, dateColMm / content))
}
