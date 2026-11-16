import type { ReactNode } from 'react'
import { Columns2, FileText, Image as ImageIcon, LayoutTemplate, Palette, Type } from 'lucide-react'
import type { EntryStyle, HeaderStyle, Resume, TitleStyle } from '../../types'
import { FONT_FAMILIES } from '../ResumeDocument'
import { ColorField, Select, Slider, TextField, Toggle } from './fields'

/**
 * Curated palettes: accent (name, section titles, icon circles) + a near-black text tinted to match.
 * Every accent has ≥ 5.3:1 contrast on white and white icons on it (WCAG AA), text ≥ 13:1.
 */
const PALETTES: { name: string; accent: string; text: string }[] = [
  { name: 'Cuivre', accent: '#a8541c', text: '#1f1d1b' },
  { name: 'Terracotta', accent: '#b1442c', text: '#221c1a' },
  { name: 'Bordeaux', accent: '#8c2638', text: '#211b1d' },
  { name: 'Framboise', accent: '#a8285d', text: '#221a1e' },
  { name: 'Prune', accent: '#6d3b9a', text: '#1e1a24' },
  { name: 'Indigo', accent: '#3446a8', text: '#1b1e2b' },
  { name: 'Bleu nuit', accent: '#1d4f7c', text: '#19222c' },
  { name: 'Pétrole', accent: '#0d6670', text: '#162325' },
  { name: 'Forêt', accent: '#2b6a3d', text: '#1a231d' },
  { name: 'Olive', accent: '#5d6420', text: '#21231a' },
  { name: 'Ardoise', accent: '#3e4c5e', text: '#1d2228' },
  { name: 'Graphite', accent: '#2e2e2e', text: '#2e2e2e' },
]

export function ThemeEditor({ resume, setResume }: { resume: Resume; setResume: (fn: (r: Resume) => Resume) => void }) {
  const t = resume.theme
  const setTheme = (p: Partial<typeof t>) => setResume((r) => ({ ...r, theme: { ...r.theme, ...p } }))
  const setMeta = (p: Partial<Resume['meta']>) => setResume((r) => ({ ...r, meta: { ...r.meta, ...p } }))

  return (
    <div className="style-panel">
      <StyleGroup icon={<Palette size={15} />} title="Couleurs">
        <div className="palettes" role="radiogroup" aria-label="Palette">
          {PALETTES.map((p) => {
            const active = t.accent.toLowerCase() === p.accent && t.text.toLowerCase() === p.text
            return (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={active}
                className={`palette${active ? ' is-active' : ''}`}
                onClick={() => setTheme({ accent: p.accent, text: p.text })}
                title={`${p.name} — ${p.accent}`}
              >
                <span className="palette-preview">
                  <span className="palette-dot" style={{ background: p.accent }} />
                  <span className="palette-lines">
                    <span style={{ background: p.accent }} />
                    <span style={{ background: p.text }} />
                    <span style={{ background: p.text }} />
                  </span>
                </span>
                <span className="palette-name">{p.name}</span>
              </button>
            )
          })}
        </div>
        <div className="field-label">Personnaliser</div>
        <div className="grid-2">
          <ColorField label="Couleur d'accent" value={t.accent} onChange={(v) => setTheme({ accent: v })} />
          <ColorField label="Couleur du texte" value={t.text} onChange={(v) => setTheme({ text: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<LayoutTemplate size={15} />} title="Styles">
        <Select<HeaderStyle>
          label="En-tête"
          value={t.headerStyle}
          options={[
            { value: 'classic', label: 'Photo à gauche' },
            { value: 'centered', label: 'Centré' },
            { value: 'band', label: 'Bandeau couleur' },
            { value: 'sidebar', label: 'Barre latérale' },
          ]}
          // The sections are not reordered: the sidebar style only draws them differently (see mainLayout)
          onChange={(v) => setTheme({ headerStyle: v })}
          hint={
            t.headerStyle === 'sidebar'
              ? 'Les listes vont dans la barre latérale ; réglable par section (Contenu) ou en glissant une section sur la page.'
              : undefined
          }
        />
        <div className="grid-2">
          <Select<TitleStyle>
            label="Titres de section"
            value={t.titleStyle}
            options={[
              { value: 'underline', label: 'Souligné' },
              { value: 'caps', label: 'Petites capitales' },
              { value: 'bar', label: 'Barre à gauche' },
              { value: 'icon', label: 'Icône' },
            ]}
            onChange={(v) => setTheme({ titleStyle: v })}
          />
          <Select<EntryStyle>
            label="Entrées"
            value={t.entryStyle}
            options={[
              { value: 'left', label: 'Dates à gauche' },
              { value: 'right', label: 'Dates à droite' },
              { value: 'timeline', label: 'Frise' },
              { value: 'cards', label: 'Cartes' },
            ]}
            onChange={(v) => setTheme({ entryStyle: v })}
          />
        </div>
      </StyleGroup>

      <StyleGroup icon={<Type size={15} />} title="Typographie">
        <div className="grid-2">
          <Select
            label="Police"
            value={t.font}
            options={Object.entries(FONT_FAMILIES).map(([value, f]) => ({ value: value as typeof t.font, label: f.label }))}
            onChange={(v) => setTheme({ font: v })}
          />
          <Select
            label="Densité"
            value={t.density}
            options={[
              { value: 'compact', label: 'Compacte' },
              { value: 'normal', label: 'Normale' },
              { value: 'airy', label: 'Aérée' },
            ]}
            onChange={(v) => setTheme({ density: v })}
          />
        </div>
        <Slider
          label="Taille du texte"
          min={8}
          max={13}
          step={0.5}
          unit=" pt"
          value={t.fontSize}
          onChange={(v) => setTheme({ fontSize: v })}
        />
      </StyleGroup>

      <StyleGroup icon={<Columns2 size={15} />} title="Mise en page">
        <p className="note">
          Sur la page, survolez une section et glissez sa poignée pour la placer en ligne, en colonne ou sous une autre. Glissez le
          séparateur entre colonnes pour les redimensionner, et les bords de page pour les marges.
        </p>
        <Slider label="Colonne des dates" min={18} max={45} unit=" mm" value={t.dateColumn} onChange={(v) => setTheme({ dateColumn: v })} />
        <div className="grid-2">
          <Slider label="Marges horizontales" min={5} max={25} unit=" mm" value={t.marginX} onChange={(v) => setTheme({ marginX: v })} />
          <Slider label="Marges verticales" min={5} max={25} unit=" mm" value={t.marginY} onChange={(v) => setTheme({ marginY: v })} />
        </div>
        <Toggle label="Icônes de lien sur les entrées" checked={t.showLinkIcons} onChange={(v) => setTheme({ showLinkIcons: v })} />
      </StyleGroup>

      <StyleGroup icon={<ImageIcon size={15} />} title="Photo">
        <Toggle label="Afficher la photo" checked={t.showPhoto} onChange={(v) => setTheme({ showPhoto: v })} />
        <Toggle label="Anneau couleur" checked={t.photoRing} onChange={(v) => setTheme({ photoRing: v })} />
        <Toggle label="Initiales s'il n'y a pas de photo" checked={t.photoInitials} onChange={(v) => setTheme({ photoInitials: v })} />
        <div className="grid-2">
          <Select
            label="Forme"
            value={t.photoShape}
            options={[
              { value: 'circle', label: 'Cercle' },
              { value: 'rounded', label: 'Arrondie' },
              { value: 'square', label: 'Carrée' },
            ]}
            onChange={(v) => setTheme({ photoShape: v })}
          />
          <Slider label="Taille" min={15} max={45} unit=" mm" value={t.photoSize} onChange={(v) => setTheme({ photoSize: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<FileText size={15} />} title="Export PDF">
        <div className="grid-2">
          <TextField label="Nom du fichier PDF" value={resume.meta.fileName} onChange={(v) => setMeta({ fileName: v })} />
          <Select
            label="Langue du CV"
            value={resume.meta.locale}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
            onChange={(v) => setMeta({ locale: v })}
            hint="Indiquée dans le PDF pour les logiciels de recrutement."
          />
        </div>
      </StyleGroup>
    </div>
  )
}

function StyleGroup({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="style-group">
      <h3 className="style-group-title">
        <span className="card-icon">{icon}</span>
        {title}
      </h3>
      <div className="style-group-body">{children}</div>
    </section>
  )
}
