import type { Placement, Resume, Section } from '../../types'
import { editPageLayout, mainLayout, placementInfo, setColumnWidth, setPlacement } from '../../layout'
import { Select, Slider } from './fields'

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
  // In the sidebar style the page shows the main column only: read and edit that layout
  const page = sidebarMode ? mainLayout(sections) : sections
  const info = placementInfo(page, section.id)
  if (!info) return null
  const edit = (fn: (s: Section[]) => Section[]) =>
    setResume((r) => ({ ...r, sections: editPageLayout(r.sections, r.theme.headerStyle === 'sidebar', fn) }))
  return (
    <div className="grid-2">
      <Select<Placement>
        label="Placement sur la page"
        value={info.first ? 'row' : info.place}
        options={[
          { value: 'row', label: 'Nouvelle ligne' },
          { value: 'column', label: 'Colonne à droite de la précédente' },
          { value: 'stack', label: 'Sous la section précédente' },
        ]}
        onChange={(v) => edit((s) => setPlacement(s, section.id, v))}
        hint={info.first ? 'Première section : toujours sur une nouvelle ligne.' : undefined}
        disabled={info.first}
      />
      {info.columnStart && (
        <Slider
          label="Largeur de la colonne"
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
