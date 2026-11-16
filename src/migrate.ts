/**
 * Turns any JSON (saved library, imported file, old formats) into a valid Resume.
 * Every field is checked against its type and falls back to a default, so a bad or partial file
 * can never put a value in the state that crashes rendering later.
 */
import { defaultResume } from './defaultResume'
import { dateColumnFraction, normalizeLayout } from './layout'
import type {
  Contact,
  DateFormat,
  Density,
  EntryStyle,
  FontKey,
  HeaderStyle,
  IconKey,
  LevelMeter,
  ListDisplay,
  Meta,
  PhotoShape,
  Placement,
  Profile,
  Resume,
  Section,
  Theme,
  TitleStyle,
} from './types'
import { uid } from './utils'
import { normalizeDate, RESUME_LOCALE_CODES } from './locale'
import { defineStrings, strings } from './i18n'

const S = defineStrings({ notResume: 'Ce fichier n’est pas un CV CodaCV' }, { notResume: 'This file is not a CodaCV resume' })

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const objs = (v: unknown): Obj[] => arr(v).filter(isObj)
const str = (v: unknown, def = '') => (typeof v === 'string' ? v : def)
const optStr = (v: unknown) => (typeof v === 'string' ? v : undefined)
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
const optBool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const num = (v: unknown, min: number, max: number, def: number) => (isNum(v) ? Math.min(max, Math.max(min, v)) : def)
const oneOf = <T extends string>(v: unknown, options: readonly T[], def: T): T => ((options as readonly unknown[]).includes(v) ? (v as T) : def)
const optOneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined =>
  (options as readonly unknown[]).includes(v) ? (v as T) : undefined
/** Colours are typed freely in the editor (custom colour field), so any short string is kept. */
const color = (v: unknown, def: string) => (typeof v === 'string' && v.trim() && v.length <= 64 ? v : def)

/** Every key of a string union, checked by the compiler (a missing or extra key is an error). */
const keysOf = <K extends string>(o: Record<K, true>) => Object.keys(o) as K[]

const ICON_KEYS = keysOf<IconKey>({
  none: true,
  link: true,
  globe: true,
  mail: true,
  at: true,
  phone: true,
  smartphone: true,
  pin: true,
  house: true,
  linkedin: true,
  github: true,
  x: true,
  youtube: true,
  message: true,
  briefcase: true,
  code: true,
  gamepad: true,
  user: true,
  calendar: true,
  car: true,
  languages: true,
  graduation: true,
  award: true,
  star: true,
  heart: true,
})
const FONTS = keysOf<FontKey>({ 'source-sans': true, inter: true, roboto: true, 'open-sans': true, lora: true })
const SHAPES = keysOf<PhotoShape>({ circle: true, rounded: true, square: true })
const DENSITIES = keysOf<Density>({ compact: true, normal: true, airy: true })
const HEADERS = keysOf<HeaderStyle>({ classic: true, centered: true, band: true, sidebar: true })
const TITLES = keysOf<TitleStyle>({ underline: true, caps: true, bar: true, icon: true })
const ENTRIES = keysOf<EntryStyle>({ left: true, right: true, timeline: true, cards: true })
const PLACES = keysOf<Placement>({ row: true, column: true, stack: true })
const DISPLAYS = keysOf<ListDisplay>({ bullets: true, inline: true, chips: true })
const METERS = keysOf<LevelMeter>({ none: true, dots: true, bar: true })
const DATE_FORMATS = keysOf<DateFormat>({ year: true, 'month-numeric': true, 'month-short': true, 'month-long': true, full: true })

const LEGACY_KIND_ICON: Record<string, IconKey> = {
  website: 'link',
  linkedin: 'linkedin',
  github: 'github',
  phone: 'phone',
  email: 'mail',
  location: 'pin',
  other: 'globe',
}

type IdFn = (v: unknown) => string

/** Ids end up in CSS selectors and data-* attributes: keep them simple, and unique within a resume. */
function idMaker(): IdFn {
  const seen = new Set<string>()
  return (v) => {
    let id = typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : uid()
    while (seen.has(id)) id = uid()
    seen.add(id)
    return id
  }
}

function migrateMeta(m: Obj): Meta {
  return { locale: oneOf(m.locale, RESUME_LOCALE_CODES, defaultResume.meta.locale), fileName: str(m.fileName) }
}

function migrateProfile(p: Obj, id: IdFn): Profile {
  // v1 early format: summaryIcon was a boolean, contacts had a `kind` instead of an `icon`
  const summaryIcon =
    typeof p.summaryIcon === 'boolean' ? (p.summaryIcon ? 'pin' : 'none') : oneOf(p.summaryIcon, ICON_KEYS, defaultResume.profile.summaryIcon)
  const contacts: Contact[] = objs(p.contacts).map((c) => ({
    id: id(c.id),
    icon: c.icon === undefined ? (LEGACY_KIND_ICON[str(c.kind)] ?? 'globe') : oneOf(c.icon, ICON_KEYS, 'globe'),
    label: str(c.label),
    url: str(c.url),
  }))
  return { name: str(p.name), title: str(p.title), photo: str(p.photo), summary: str(p.summary), summaryIcon, contacts }
}

function migrateTheme(t: Obj): Theme {
  const d = defaultResume.theme
  return {
    accent: color(t.accent, d.accent),
    text: color(t.text, d.text),
    font: oneOf(t.font, FONTS, d.font),
    fontSize: num(t.fontSize, 6, 24, d.fontSize),
    density: oneOf(t.density, DENSITIES, d.density),
    showPhoto: bool(t.showPhoto, d.showPhoto),
    photoShape: oneOf(t.photoShape, SHAPES, d.photoShape),
    photoSize: num(t.photoSize, 5, 80, d.photoSize),
    dateColumn: num(t.dateColumn, 5, 80, d.dateColumn),
    marginX: num(t.marginX, 0, 50, d.marginX),
    marginY: num(t.marginY, 0, 50, d.marginY),
    showLinkIcons: bool(t.showLinkIcons, d.showLinkIcons),
    headerStyle: oneOf(t.headerStyle, HEADERS, d.headerStyle),
    titleStyle: oneOf(t.titleStyle, TITLES, d.titleStyle),
    entryStyle: oneOf(t.entryStyle, ENTRIES, d.entryStyle),
    photoRing: bool(t.photoRing, d.photoRing),
    photoInitials: bool(t.photoInitials, d.photoInitials),
    dateFormat: oneOf(t.dateFormat, DATE_FORMATS, d.dateFormat),
  }
}

/** flag-icons class suffix: "fr", "gb-eng"… (it ends up in a class name) */
const country = (v: unknown) => {
  const c = str(v).toLowerCase()
  return /^[a-z]{2}(-[a-z]{2,3})?$/.test(c) ? c : ''
}

/** One section, or null for an unknown kind (e.g. written by a newer version of the app). */
function migrateSection(s: Obj, id: IdFn): Section | null {
  const base = {
    id: id(s.id),
    title: str(s.title),
    visible: bool(s.visible, true),
    place: oneOf(s.place, PLACES, 'row'),
    colWidth: isNum(s.colWidth) && s.colWidth > 0 && s.colWidth <= 1 ? s.colWidth : undefined,
    icon: optOneOf(s.icon, ICON_KEYS),
    sidebar: optBool(s.sidebar),
    hideTitle: optBool(s.hideTitle),
  }
  const item = (o: Obj) => ({ id: id(o.id), hidden: bool(o.hidden, false) })
  switch (s.kind) {
    case 'timeline':
      return {
        ...base,
        kind: 'timeline',
        entries: objs(s.entries).map((e) => ({
          ...item(e),
          // Dates are "YYYY/MM/DD" (also accepted with dashes). The old free-text `date` ("2019 – 2022")
          // is dropped on purpose: dates are now entered as start / end and written in the resume's language.
          start: normalizeDate(e.start),
          end: normalizeDate(e.end),
          current: bool(e.current, false),
          subDate: str(e.subDate),
          country: country(e.country),
          location: str(e.location),
          title: str(e.title),
          subtitle: str(e.subtitle),
          url: str(e.url),
          bullets: arr(e.bullets).filter((b): b is string => typeof b === 'string'),
        })),
      }
    case 'list':
      return {
        ...base,
        kind: 'list',
        items: objs(s.items).map((it) => ({ ...item(it), text: str(it.text) })),
        display: optOneOf(s.display, DISPLAYS),
        separator: optStr(s.separator),
      }
    case 'text':
      return { ...base, kind: 'text', text: str(s.text) }
    case 'levels':
      return {
        ...base,
        kind: 'levels',
        meter: oneOf(s.meter, METERS, 'dots'),
        items: objs(s.items).map((it) => ({
          ...item(it),
          name: str(it.name),
          level: str(it.level),
          rating: Math.round(num(it.rating, 0, 5, 0)),
        })),
      }
    case 'facts':
      return { ...base, kind: 'facts', items: objs(s.items).map((it) => ({ ...item(it), key: str(it.key), value: str(it.value) })) }
    case 'references':
      return {
        ...base,
        kind: 'references',
        onRequest: bool(s.onRequest, false),
        onRequestText: str(s.onRequestText, 'Références disponibles sur demande'),
        items: objs(s.items).map((it) => ({
          ...item(it),
          name: str(it.name),
          role: str(it.role),
          company: str(it.company),
          contact: str(it.contact),
        })),
      }
    case 'highlights':
      return { ...base, kind: 'highlights', items: objs(s.items).map((it) => ({ ...item(it), value: str(it.value), label: str(it.label) })) }
    default:
      console.warn('Unknown section kind, section skipped', s.kind)
      return null
  }
}

function migrateSections(raw: Obj[], theme: Theme, id: IdFn): Section[] {
  const kept: { section: Section; raw: Obj }[] = []
  for (const r of raw) {
    const section = migrateSection(r, id)
    if (section) kept.push({ section, raw: r })
  }
  const out = kept.map((k) => k.section)
  // Early format: `pairWithNext` put a section in a narrow column next to the following one
  kept.forEach(({ raw: r }, i) => {
    if (r.place || !r.pairWithNext || !out[i + 1]) return
    const narrow = dateColumnFraction(theme.dateColumn, theme.marginX)
    out[i] = { ...out[i], colWidth: narrow }
    out[i + 1] = { ...out[i + 1], place: 'column', colWidth: 1 - narrow }
  })
  return normalizeLayout(out)
}

export function migrate(data: unknown): Resume {
  if (!isObj(data) || !isObj(data.profile) || !Array.isArray(data.sections)) {
    throw new Error(strings(S).notResume)
  }
  const id = idMaker()
  const theme = migrateTheme(isObj(data.theme) ? data.theme : {})
  return {
    version: 1,
    meta: migrateMeta(isObj(data.meta) ? data.meta : {}),
    profile: migrateProfile(data.profile, id),
    sections: migrateSections(objs(data.sections), theme, id),
    theme,
  }
}

/** Largest JSON file accepted by the import (the browser storage holds about 5 MB in all). */
export const MAX_IMPORT_BYTES = 5_000_000

export function parseResume(text: string): Resume {
  return migrate(JSON.parse(text))
}
