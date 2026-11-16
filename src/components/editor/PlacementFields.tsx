import type { Placement, Resume, Section } from '../../types'
import { editPageLayout, mainLayout, placementInfo, setColumnWidth, setPlacement } from '../../layout'
import { Select, Slider } from './fields'
import { defineStrings, useStrings } from '../../i18n'

const S = defineStrings(
  {
    placement: 'Placement sur la page',
    row: 'Nouvelle ligne',
    column: 'Colonne à droite de la précédente',
    stack: 'Sous la section précédente',
    firstHint: 'Première section : toujours sur une nouvelle ligne.',
    width: 'Largeur de la colonne',
  },
  {
    placement: 'Position on the page',
    row: 'New row',
    column: 'Column to the right of the previous one',
    stack: 'Under the previous section',
    firstHint: 'First section: always on a new row.',
    width: 'Column width',
  },
)

/** Placement on the page and column width: the keyboard alternative to the on-page handles. */
export function PlacementFields({
  sections,
  section,
  sidebarMode,
  setResume,
}: {
  sections: Section[]
  section: Section
  sidebarMode: boolean
  setResume: (fn: (r: Resume) => Resume) => void
}) {
  const t = useStrings(S)
  // In the sidebar style the page shows the main column only: read and edit that layout
  const page = sidebarMode ? mainLayout(sections) : sections
  const info = placementInfo(page, section.id)
  if (!info) return null
  const edit = (fn: (s: Section[]) => Section[]) =>
    setResume((r) => ({ ...r, sections: editPageLayout(r.sections, r.theme.headerStyle === 'sidebar', fn) }))
  return (
    <div className="grid-2">
      <Select<Placement>
        label={t.placement}
        value={info.first ? 'row' : info.place}
        options={[
          { value: 'row', label: t.row },
          { value: 'column', label: t.column },
          { value: 'stack', label: t.stack },
        ]}
        onChange={(v) => edit((s) => setPlacement(s, section.id, v))}
        hint={info.first ? t.firstHint : undefined}
        disabled={info.first}
      />
      {info.columnStart && (
        <Slider
          label={t.width}
          min={10}
          max={90}
          unit=" %"
          value={Math.round(info.width * 100)}
          onChange={(v) => edit((s) => setColumnWidth(s, section.id, v / 100))}
        />
      )}
    </div>
  )
}
