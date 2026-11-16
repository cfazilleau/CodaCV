export type IconKey =
  | 'none'
  | 'link'
  | 'globe'
  | 'mail'
  | 'at'
  | 'phone'
  | 'smartphone'
  | 'pin'
  | 'house'
  | 'linkedin'
  | 'github'
  | 'x'
  | 'youtube'
  | 'message'
  | 'briefcase'
  | 'code'
  | 'gamepad'
  | 'user'
  | 'calendar'
  | 'car'
  | 'languages'
  | 'graduation'
  | 'award'
  | 'star'
  | 'heart'

export interface Contact {
  id: string
  icon: IconKey
  /** Text shown on the resume */
  label: string
  /** Optional link (mailto:/tel: are derived automatically from e-mails / phone numbers) */
  url: string
}

export interface Profile {
  name: string
  title: string
  photo: string // data URL or URL, empty = none
  summary: string
  summaryIcon: IconKey
  contacts: Contact[]
}

/** A dated entry: job, project, school… */
export interface TimelineEntry {
  id: string
  date: string // e.g. "2022 – 2024"
  subDate: string // e.g. "6 mois" (shown under the date)
  country: string // ISO 3166-1 alpha-2 code for the flag, e.g. "fr"
  location: string
  title: string // bold, e.g. company
  subtitle: string // italic, e.g. role
  url: string
  bullets: string[]
  hidden: boolean
}

export interface ListItem {
  id: string
  text: string
  hidden: boolean
}

/**
 * Where a section goes relative to the previous one (array order = reading order):
 * - row: starts a new full-width row
 * - column: starts a new column to the right, in the same row
 * - stack: goes under the previous section, in the same column
 */
export type Placement = 'row' | 'column' | 'stack'

interface SectionBase {
  id: string
  title: string
  visible: boolean
  place: Placement
  /** Width of the column this section starts (fraction of the row), for the first section of a column */
  colWidth?: number
  /** Icon before the title (title style "icon"); a default is picked from the title when unset */
  icon?: IconKey
  /** Header style "sidebar": show this section in the sidebar (default: list sections) */
  sidebar?: boolean
  /** Don't print the section title (e.g. key figures under the header) */
  hideTitle?: boolean
}

export interface TimelineSection extends SectionBase {
  kind: 'timeline'
  entries: TimelineEntry[]
}

/** How a list is drawn: bullet points, inline tags with a separator, or chips. */
export type ListDisplay = 'bullets' | 'inline' | 'chips'

export interface ListSection extends SectionBase {
  kind: 'list'
  items: ListItem[]
  display?: ListDisplay // default: bullets
  separator?: string // inline tags only, default ' · '
}

export interface TextSection extends SectionBase {
  kind: 'text'
  text: string
}

/** Skill or language with a level, always written as text ("C1", "Expert"); the rating only draws dots / a bar */
export interface LevelItem {
  id: string
  name: string
  level: string
  rating: number // 0–5, 0 = no meter
  hidden: boolean
}

export type LevelMeter = 'none' | 'dots' | 'bar'

export interface LevelSection extends SectionBase {
  kind: 'levels'
  items: LevelItem[]
  meter: LevelMeter
}

/** Short fact: "Permis : B", "Disponibilité : immédiate" (value may be empty) */
export interface FactItem {
  id: string
  key: string
  value: string
  hidden: boolean
}

export interface FactSection extends SectionBase {
  kind: 'facts'
  items: FactItem[]
}

export interface ReferenceItem {
  id: string
  name: string
  role: string
  company: string
  contact: string // e-mail or phone, linked automatically
  hidden: boolean
}

export interface ReferenceSection extends SectionBase {
  kind: 'references'
  items: ReferenceItem[]
  /** Show a single line instead of the references */
  onRequest: boolean
  onRequestText: string
}

/** Big figure: value "1 M+", label "téléchargements" */
export interface HighlightItem {
  id: string
  value: string
  label: string
  hidden: boolean
}

export interface HighlightSection extends SectionBase {
  kind: 'highlights'
  items: HighlightItem[]
}

export type Section = TimelineSection | ListSection | TextSection | LevelSection | FactSection | ReferenceSection | HighlightSection
export type SectionKind = Section['kind']

export type FontKey = 'source-sans' | 'inter' | 'roboto' | 'open-sans' | 'lora'
export type PhotoShape = 'circle' | 'rounded' | 'square'
export type Density = 'compact' | 'normal' | 'airy'

export interface Theme {
  accent: string
  text: string
  font: FontKey
  fontSize: number // pt
  density: Density
  showPhoto: boolean
  photoShape: PhotoShape
  photoSize: number // mm
  dateColumn: number // mm
  marginX: number // mm
  marginY: number // mm
  showLinkIcons: boolean
  headerStyle: HeaderStyle
  titleStyle: TitleStyle
  entryStyle: EntryStyle
  /** Accent-coloured ring around the photo */
  photoRing: boolean
  /** Show initials in place of the photo when there is none */
  photoInitials: boolean
}

/** classic: photo left · centered · band: full-width accent band · sidebar: coloured left column */
export type HeaderStyle = 'classic' | 'centered' | 'band' | 'sidebar'
/** underline · caps: small spaced capitals + thin rule · bar: accent bar on the left · icon: tinted icon square */
export type TitleStyle = 'underline' | 'caps' | 'bar' | 'icon'
/** left: dates in a left column · right: dates on the title line · timeline: line with dots · cards: tinted blocks */
export type EntryStyle = 'left' | 'right' | 'timeline' | 'cards'

export interface Meta {
  locale: 'fr' | 'en'
  fileName: string
}

export interface Resume {
  version: 1
  meta: Meta
  profile: Profile
  sections: Section[]
  theme: Theme
}

export type Selection =
  | { kind: 'profile' }
  | { kind: 'section'; sectionId: string; itemId?: string }
  | null
