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
}

export interface TimelineSection extends SectionBase {
  kind: 'timeline'
  entries: TimelineEntry[]
}

export interface ListSection extends SectionBase {
  kind: 'list'
  items: ListItem[]
}

export interface TextSection extends SectionBase {
  kind: 'text'
  text: string
}

export type Section = TimelineSection | ListSection | TextSection
export type SectionKind = Section['kind']

export type FontKey = 'source-sans' | 'inter' | 'roboto' | 'open-sans' | 'lora'
export type PhotoShape = 'circle' | 'rounded' | 'square'
export type Density = 'compact' | 'normal' | 'airy'

/** two-column: dates in a left column (template look). single-column: safest for ATS parsers. */
export type Layout = 'two-column' | 'single-column'

export interface Theme {
  layout: Layout
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
}

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
