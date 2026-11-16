import type { ReactNode } from 'react'
import { Columns2, FileText, Image as ImageIcon, Languages, LayoutTemplate, Palette, Type } from 'lucide-react'
import type { DateFormat, Density, EntryStyle, HeaderStyle, PhotoShape, Resume, ResumeLocale, TitleStyle } from '../../types'
import { FONT_FAMILIES } from '../ResumeDocument'
import { ColorField, Select, Slider, TextField, Toggle } from './fields'
import { defineStrings, useStrings } from '../../i18n'
import { TOUCH, useMediaQuery } from '../../media'
import { DATE_FORMATS, formatDate, formatDateRange, RESUME_LOCALE_CODES, RESUME_LOCALES } from '../../locale'

/**
 * Curated palettes: accent (name, section titles, icon circles) + a near-black text tinted to match.
 * Every accent has ≥ 5.3:1 contrast on white and white icons on it (WCAG AA), text ≥ 13:1.
 */
const PALETTES: { id: string; accent: string; text: string }[] = [
  { id: 'copper', accent: '#a8541c', text: '#1f1d1b' },
  { id: 'terracotta', accent: '#b1442c', text: '#221c1a' },
  { id: 'burgundy', accent: '#8c2638', text: '#211b1d' },
  { id: 'raspberry', accent: '#a8285d', text: '#221a1e' },
  { id: 'plum', accent: '#6d3b9a', text: '#1e1a24' },
  { id: 'indigo', accent: '#3446a8', text: '#1b1e2b' },
  { id: 'navy', accent: '#1d4f7c', text: '#19222c' },
  { id: 'petrol', accent: '#0d6670', text: '#162325' },
  { id: 'forest', accent: '#2b6a3d', text: '#1a231d' },
  { id: 'olive', accent: '#5d6420', text: '#21231a' },
  { id: 'slate', accent: '#3e4c5e', text: '#1d2228' },
  { id: 'graphite', accent: '#2e2e2e', text: '#2e2e2e' },
]

const S = defineStrings(
  {
    palettes: {
      copper: 'Cuivre',
      terracotta: 'Terracotta',
      burgundy: 'Bordeaux',
      raspberry: 'Framboise',
      plum: 'Prune',
      indigo: 'Indigo',
      navy: 'Bleu nuit',
      petrol: 'Pétrole',
      forest: 'Forêt',
      olive: 'Olive',
      slate: 'Ardoise',
      graphite: 'Graphite',
    } as Record<string, string>,
    colors: 'Couleurs',
    palette: 'Palette',
    customize: 'Personnaliser',
    accent: "Couleur d'accent",
    text: 'Couleur du texte',
    styles: 'Styles',
    header: 'En-tête',
    headers: { classic: 'Photo à gauche', centered: 'Centré', band: 'Bandeau couleur', sidebar: 'Barre latérale' } as Record<HeaderStyle, string>,
    sidebarHint: 'Les listes vont dans la barre latérale ; réglable par section (Contenu) ou en glissant une section sur la page.',
    titles: 'Titres de section',
    titleStyles: { underline: 'Souligné', caps: 'Petites capitales', bar: 'Barre à gauche', icon: 'Icône' } as Record<TitleStyle, string>,
    entries: 'Entrées',
    entryStyles: { left: 'Dates à gauche', right: 'Dates à droite', timeline: 'Frise', cards: 'Cartes' } as Record<EntryStyle, string>,
    typography: 'Typographie',
    font: 'Police',
    density: 'Densité',
    densities: { compact: 'Compacte', normal: 'Normale', airy: 'Aérée' } as Record<Density, string>,
    fontSize: 'Taille du texte',
    layout: 'Mise en page',
    layoutNote:
      'Sur la page, survolez une section et glissez sa poignée pour la placer en ligne, en colonne ou sous une autre. Glissez le séparateur entre colonnes pour les redimensionner, et les bords de page pour les marges.',
    layoutNoteTouch:
      'Sur la page, touchez une section puis glissez la poignée au bout de son titre pour la placer en ligne, en colonne ou sous une autre. Dans une ligne à plusieurs colonnes, glissez les poignées entre colonnes pour les redimensionner. Les marges se règlent ci-dessous.',
    dateColumn: 'Colonne des dates',
    marginX: 'Marges horizontales',
    marginY: 'Marges verticales',
    linkIcons: 'Icônes de lien sur les entrées',
    photo: 'Photo',
    showPhoto: 'Afficher la photo',
    ring: 'Anneau couleur',
    initials: "Initiales s'il n'y a pas de photo",
    shape: 'Forme',
    shapes: { circle: 'Cercle', rounded: 'Arrondie', square: 'Carrée' } as Record<PhotoShape, string>,
    size: 'Taille',
    langDates: 'Langue et dates',
    locale: 'Langue du CV',
    localeHint: 'Dates écrites dans cette langue ; indiquée dans le PDF pour les logiciels de recrutement.',
    dateFormat: 'Format des dates',
    dateFormats: {
      year: 'Année',
      'month-numeric': 'Mois en chiffres',
      'month-short': 'Mois abrégé',
      'month-long': 'Mois en toutes lettres',
      full: 'Date complète',
    } as Record<DateFormat, string>,
    example: (sample: string) => `Exemple : ${sample}`,
    export: 'Export PDF',
    fileName: 'Nom du fichier PDF',
  },
  {
    palettes: {
      copper: 'Copper',
      terracotta: 'Terracotta',
      burgundy: 'Burgundy',
      raspberry: 'Raspberry',
      plum: 'Plum',
      indigo: 'Indigo',
      navy: 'Navy',
      petrol: 'Petrol',
      forest: 'Forest',
      olive: 'Olive',
      slate: 'Slate',
      graphite: 'Graphite',
    },
    colors: 'Colors',
    palette: 'Palette',
    customize: 'Customize',
    accent: 'Accent color',
    text: 'Text color',
    styles: 'Styles',
    header: 'Header',
    headers: { classic: 'Photo on the left', centered: 'Centered', band: 'Color band', sidebar: 'Sidebar' },
    sidebarHint: 'Lists go in the sidebar; change it per section (Content) or by dragging a section on the page.',
    titles: 'Section titles',
    titleStyles: { underline: 'Underlined', caps: 'Small caps', bar: 'Bar on the left', icon: 'Icon' },
    entries: 'Entries',
    entryStyles: { left: 'Dates on the left', right: 'Dates on the right', timeline: 'Timeline', cards: 'Cards' },
    typography: 'Typography',
    font: 'Font',
    density: 'Density',
    densities: { compact: 'Compact', normal: 'Normal', airy: 'Airy' },
    fontSize: 'Text size',
    layout: 'Layout',
    layoutNote:
      'On the page, hover a section and drag its handle to place it in a row, a column or under another one. Drag the divider between columns to resize them, and the page edges for the margins.',
    layoutNoteTouch:
      'On the page, tap a section, then drag the handle at the end of its title to place it in a row, a column or under another one. In a row with several columns, drag the handles between columns to resize them. Margins are set below.',
    dateColumn: 'Date column',
    marginX: 'Horizontal margins',
    marginY: 'Vertical margins',
    linkIcons: 'Link icons on entries',
    photo: 'Photo',
    showPhoto: 'Show the photo',
    ring: 'Color ring',
    initials: 'Initials when there is no photo',
    shape: 'Shape',
    shapes: { circle: 'Circle', rounded: 'Rounded', square: 'Square' },
    size: 'Size',
    langDates: 'Language and dates',
    locale: 'Resume language',
    localeHint: 'Dates are written in this language; it is set in the PDF for recruiting software.',
    dateFormat: 'Date format',
    dateFormats: {
      year: 'Year',
      'month-numeric': 'Numeric month',
      'month-short': 'Short month',
      'month-long': 'Full month',
      full: 'Full date',
    },
    example: (sample) => `Example: ${sample}`,
    export: 'PDF export',
    fileName: 'PDF file name',
  },
)

// September: short and long month names differ in every offered language ("sept." / "septembre")
const SAMPLE_DATE = '2022/09/15'

export function ThemeEditor({ resume, setResume }: { resume: Resume; setResume: (fn: (r: Resume) => Resume) => void }) {
  const s = useStrings(S)
  const touch = useMediaQuery(TOUCH)
  const t = resume.theme
  const locale = resume.meta.locale
  const setTheme = (p: Partial<typeof t>) => setResume((r) => ({ ...r, theme: { ...r.theme, ...p } }))
  const setMeta = (p: Partial<Resume['meta']>) => setResume((r) => ({ ...r, meta: { ...r.meta, ...p } }))
  const options = <K extends string>(labels: Record<K, string>) => (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))

  return (
    <div className="style-panel">
      <StyleGroup icon={<Palette size={15} />} title={s.colors}>
        <div className="palettes" role="radiogroup" aria-label={s.palette}>
          {PALETTES.map((p) => {
            const active = t.accent.toLowerCase() === p.accent && t.text.toLowerCase() === p.text
            const name = s.palettes[p.id]
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`palette${active ? ' is-active' : ''}`}
                onClick={() => setTheme({ accent: p.accent, text: p.text })}
                title={`${name} — ${p.accent}`}
              >
                <span className="palette-preview">
                  <span className="palette-dot" style={{ background: p.accent }} />
                  <span className="palette-lines">
                    <span style={{ background: p.accent }} />
                    <span style={{ background: p.text }} />
                    <span style={{ background: p.text }} />
                  </span>
                </span>
                <span className="palette-name">{name}</span>
              </button>
            )
          })}
        </div>
        <div className="field-label">{s.customize}</div>
        <div className="grid-2">
          <ColorField label={s.accent} value={t.accent} onChange={(v) => setTheme({ accent: v })} />
          <ColorField label={s.text} value={t.text} onChange={(v) => setTheme({ text: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<LayoutTemplate size={15} />} title={s.styles}>
        <Select<HeaderStyle>
          label={s.header}
          value={t.headerStyle}
          options={options(s.headers)}
          // The sections are not reordered: the sidebar style only draws them differently (see mainLayout)
          onChange={(v) => setTheme({ headerStyle: v })}
          hint={t.headerStyle === 'sidebar' ? s.sidebarHint : undefined}
        />
        <div className="grid-2">
          <Select<TitleStyle> label={s.titles} value={t.titleStyle} options={options(s.titleStyles)} onChange={(v) => setTheme({ titleStyle: v })} />
          <Select<EntryStyle> label={s.entries} value={t.entryStyle} options={options(s.entryStyles)} onChange={(v) => setTheme({ entryStyle: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<Type size={15} />} title={s.typography}>
        <div className="grid-2">
          <Select
            label={s.font}
            value={t.font}
            options={Object.entries(FONT_FAMILIES).map(([value, f]) => ({ value: value as typeof t.font, label: f.label }))}
            onChange={(v) => setTheme({ font: v })}
          />
          <Select<Density> label={s.density} value={t.density} options={options(s.densities)} onChange={(v) => setTheme({ density: v })} />
        </div>
        <Slider label={s.fontSize} min={8} max={13} step={0.5} unit=" pt" value={t.fontSize} onChange={(v) => setTheme({ fontSize: v })} />
      </StyleGroup>

      <StyleGroup icon={<Columns2 size={15} />} title={s.layout}>
        <p className="note">{touch ? s.layoutNoteTouch : s.layoutNote}</p>
        <Slider label={s.dateColumn} min={18} max={45} unit=" mm" value={t.dateColumn} onChange={(v) => setTheme({ dateColumn: v })} />
        <div className="grid-2">
          <Slider label={s.marginX} min={5} max={25} unit=" mm" value={t.marginX} onChange={(v) => setTheme({ marginX: v })} />
          <Slider label={s.marginY} min={5} max={25} unit=" mm" value={t.marginY} onChange={(v) => setTheme({ marginY: v })} />
        </div>
        <Toggle label={s.linkIcons} checked={t.showLinkIcons} onChange={(v) => setTheme({ showLinkIcons: v })} />
      </StyleGroup>

      <StyleGroup icon={<ImageIcon size={15} />} title={s.photo}>
        <Toggle label={s.showPhoto} checked={t.showPhoto} onChange={(v) => setTheme({ showPhoto: v })} />
        <Toggle label={s.ring} checked={t.photoRing} onChange={(v) => setTheme({ photoRing: v })} />
        <Toggle label={s.initials} checked={t.photoInitials} onChange={(v) => setTheme({ photoInitials: v })} />
        <div className="grid-2">
          <Select<PhotoShape> label={s.shape} value={t.photoShape} options={options(s.shapes)} onChange={(v) => setTheme({ photoShape: v })} />
          <Slider label={s.size} min={15} max={45} unit=" mm" value={t.photoSize} onChange={(v) => setTheme({ photoSize: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<Languages size={15} />} title={s.langDates}>
        <div className="grid-2">
          <Select<ResumeLocale>
            label={s.locale}
            value={locale}
            options={RESUME_LOCALE_CODES.map((value) => ({ value, label: RESUME_LOCALES[value].label }))}
            onChange={(v) => setMeta({ locale: v })}
          />
          <Select<DateFormat>
            label={s.dateFormat}
            value={t.dateFormat}
            // Each option shows a sample in the resume's language
            options={DATE_FORMATS.map((value) => ({ value, label: `${s.dateFormats[value]} — ${formatDate(SAMPLE_DATE, locale, value)}` }))}
            onChange={(v) => setTheme({ dateFormat: v })}
          />
        </div>
        <p className="field-hint">
          {s.example(formatDateRange({ start: '2019/03/01', end: '', current: true }, locale, t.dateFormat))} · {s.localeHint}
        </p>
      </StyleGroup>

      <StyleGroup icon={<FileText size={15} />} title={s.export}>
        <TextField label={s.fileName} value={resume.meta.fileName} onChange={(v) => setMeta({ fileName: v })} />
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
