/**
 * Page layout: sections are grouped into rows → columns → stacked sections using each
 * section's `place` flag. The sections array order stays the reading order (and the PDF text
 * order), so every operation here rewrites that order plus the flags.
 */
import type { Placement, Section } from './types'

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

/** Take a section out of the structure; a column or row left empty disappears, nothing else moves. */
function removeFromRows(rows: SRow[], id: string) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const col = rows[r][c]
      const i = col.ids.indexOf(id)
      if (i < 0) continue
      col.ids.splice(i, 1)
      if (!col.ids.length) {
        rows[r].splice(c, 1)
        if (!rows[r].length) rows.splice(r, 1)
      }
      return
    }
  }
}

/**
 * Delete a section. Its neighbours keep their row and column (filtering the array would not:
 * a `column` section after a deleted row start would join the previous row).
 */
export function removeSection(sections: Section[], id: string): Section[] {
  const rows = toStructure(sections)
  removeFromRows(rows, id)
  return fromStructure(sections, rows)
}

/**
 * Reorder from the side-panel list: the section becomes a full-width row at its new place in the
 * list. Moving down puts it after the row of the section it now follows; moving up, before the row
 * of the section it now precedes. Every other section keeps its row and column.
 */
export function reorderSections(sections: Section[], id: string, to: number): Section[] {
  const from = sections.findIndex((s) => s.id === id)
  if (from < 0 || to === from || to < 0 || to >= sections.length) return sections
  const others = sections.filter((s) => s.id !== id) // the list order without it; it goes at index `to`
  const rows = toStructure(sections)
  removeFromRows(rows, id)
  const rowOf = (sid: string) => rows.findIndex((row) => row.some((c) => c.ids.includes(sid)))
  const at = to > from ? rowOf(others[to - 1].id) + 1 : rowOf(others[to].id)
  rows.splice(at, 0, [{ ids: [id], width: 1 }])
  return fromStructure(sections, rows)
}

export function moveSection(sections: Section[], id: string, drop: SectionDrop): Section[] {
  const anchor = drop.kind === 'row' ? drop.beforeSectionId : drop.sectionId
  if (anchor === id) return sections
  const rows = toStructure(sections)
  removeFromRows(rows, id)

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

/* ------------------------------------------------------------- Side-panel layout controls */

/** Where a section sits, for the side-panel controls (keyboard alternative to the on-page handles). */
export interface PlacementInfo {
  /** First section: always starts a row */
  first: boolean
  place: Placement
  /** First section of its column, in a row of several columns: its column width can be set */
  columnStart: boolean
  /** Normalized width of its column (fraction of the row) */
  width: number
}

export function placementInfo(sections: Section[], id: string): PlacementInfo | null {
  const i = sections.findIndex((s) => s.id === id)
  if (i < 0) return null
  for (const row of toStructure(sections)) {
    const total = row.reduce((a, c) => a + c.width, 0) || 1
    for (const col of row) {
      if (!col.ids.includes(id)) continue
      return { first: i === 0, place: sections[i].place, columnStart: row.length > 1 && col.ids[0] === id, width: col.width / total }
    }
  }
  return null
}

/**
 * Change a section's `place` (relative to the previous section, as on the page). A new column
 * takes an equal share of its row; the other columns keep their proportions.
 */
export function setPlacement(sections: Section[], id: string, place: Placement): Section[] {
  const i = sections.findIndex((s) => s.id === id)
  if (i <= 0 || sections[i].place === place) return sections
  const flagged = sections.map((s, k) => (k === i ? { ...s, place, colWidth: place === 'column' ? undefined : s.colWidth } : s))
  const rows = toStructure(flagged)
  if (place === 'column') {
    const row = rows.find((r) => r.some((c) => c.ids[0] === id))
    if (row && row.length > 1) {
      const share = 1 / row.length
      const others = row.filter((c) => c.ids[0] !== id)
      const sum = others.reduce((a, c) => a + c.width, 0) || 1
      for (const c of row) c.width = c.ids[0] === id ? share : (c.width / sum) * (1 - share)
    }
  }
  return fromStructure(flagged, rows)
}

/** Set the width of the column holding this section (10–90 %); the other columns share the rest in proportion. */
export function setColumnWidth(sections: Section[], id: string, width: number): Section[] {
  const rows = toStructure(sections)
  const row = rows.find((r) => r.some((c) => c.ids.includes(id)))
  if (!row || row.length < 2) return sections
  const w = Math.min(0.9, Math.max(0.1, width))
  const others = row.filter((c) => !c.ids.includes(id))
  const sum = others.reduce((a, c) => a + c.width, 0) || 1
  for (const c of row) c.width = c.ids.includes(id) ? w : (c.width / sum) * (1 - w)
  return fromStructure(sections, rows)
}

/**
 * Apply a layout change to what the page shows. In the "sidebar" header style that is the main
 * column (mainLayout); the array is then rebuilt as main column first, sidebar sections as rows
 * (same as an on-page drag in that style).
 */
export function editPageLayout(sections: Section[], sidebarMode: boolean, fn: (main: Section[]) => Section[]): Section[] {
  if (!sidebarMode) return fn(sections)
  return [...fn(mainLayout(sections)), ...sections.filter(isInSidebar).map(asRow)]
}

type Item = { id: string }

/** Items of any section that has some (timeline entries, list / levels / facts / references / highlights items). */
function itemsOf(s: Section): Item[] | null {
  if (s.kind === 'timeline') return s.entries
  if (s.kind === 'text') return null
  return s.items
}

function withItems(s: Section, items: Item[]): Section {
  if (s.kind === 'timeline') return { ...s, entries: items as typeof s.entries }
  if (s.kind === 'text') return s
  return { ...s, items: items as typeof s.items } as Section
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
export const isInSidebar = (s: Section) => s.sidebar ?? (s.kind === 'list' || s.kind === 'levels' || s.kind === 'facts')

/**
 * The page layout of the main column in the "sidebar" header style: the full layout with the
 * sidebar sections taken out (their row neighbours stay put). The sections array is not reordered
 * when that style is chosen, so switching header styles back and forth keeps the layout. The
 * document order is main column first, sidebar second either way (ResumeDocument renders it so).
 */
export function mainLayout(sections: Section[]): Section[] {
  const rows = toStructure(sections)
  for (const s of sections) if (isInSidebar(s)) removeFromRows(rows, s.id)
  return fromStructure(sections, rows)
}

export type SidebarAwareDrop = SectionDrop | { kind: 'sidebar'; anchorId: string | null; after: boolean }

const asRow = (s: Section): Section => ({ ...s, place: 'row', colWidth: undefined })

/**
 * moveSection, plus moving sections into / out of the sidebar when that header style is on.
 * In that style, drop targets come from the main column as drawn (mainLayout), so the result is
 * rebuilt from it: main column first, then the sidebar sections as plain rows.
 */
export function moveSectionAnywhere(sections: Section[], id: string, drop: SidebarAwareDrop, sidebarMode: boolean): Section[] {
  if (!sidebarMode) return drop.kind === 'sidebar' ? sections : moveSection(sections, id, drop)
  const dragged = sections.find((s) => s.id === id)
  const anchor = drop.kind === 'sidebar' ? drop.anchorId : drop.kind === 'row' ? drop.beforeSectionId : drop.sectionId
  if (!dragged || anchor === id) return sections
  const rest = removeSection(sections, id)
  const main = mainLayout(rest)
  const side = rest.filter(isInSidebar).map(asRow)
  if (drop.kind === 'sidebar') {
    const moved: Section = { ...asRow(dragged), sidebar: true }
    let at = drop.anchorId ? side.findIndex((s) => s.id === drop.anchorId) : side.length
    if (at < 0) at = side.length
    else if (drop.anchorId && drop.after) at++
    return [...main, ...side.slice(0, at), moved, ...side.slice(at)]
  }
  const moved: Section = { ...asRow(dragged), sidebar: false }
  return [...moveSection([...main, moved], id, drop), ...side]
}

/** Column fraction that lines a first column up with the timeline date column. */
export function dateColumnFraction(dateColMm: number, marginXMm: number, columns = 2): number {
  const content = 210 - 2 * marginXMm - COL_GAP_MM * (columns - 1)
  return Math.min(0.9, Math.max(0.05, dateColMm / content))
}
