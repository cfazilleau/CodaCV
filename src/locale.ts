import type { DateFormat, ResumeLocale } from './types'
import { getUiLang, type UiLang } from './i18n'

/**
 * Resume languages (`resume.meta.locale`): the PDF /Lang, date formatting and the word for an
 * ongoing period. Labels are the language's own name, so they read the same in any UI language.
 */
export const RESUME_LOCALES: Record<ResumeLocale, { label: string; present: string }> = {
  fr: { label: 'Français', present: "aujourd'hui" },
  en: { label: 'English (US)', present: 'Present' },
  'en-GB': { label: 'English (UK)', present: 'Present' },
  de: { label: 'Deutsch', present: 'heute' },
  es: { label: 'Español', present: 'actualidad' },
  it: { label: 'Italiano', present: 'oggi' },
  nl: { label: 'Nederlands', present: 'heden' },
  pl: { label: 'Polski', present: 'obecnie' },
  'pt-PT': { label: 'Português (Portugal)', present: 'presente' },
  'pt-BR': { label: 'Português (Brasil)', present: 'atual' },
}

export const RESUME_LOCALE_CODES = Object.keys(RESUME_LOCALES) as ResumeLocale[]

/**
 * Language of the default texts the app writes into a resume (new sections, template): the
 * resume's own language when the app has texts for it, else the UI language.
 */
export function contentLang(locale: ResumeLocale): UiLang {
  const base = locale.slice(0, 2)
  return base === 'fr' || base === 'en' ? base : getUiLang()
}

/*
 * Dates are stored (and exported / imported) as "YYYY/MM/DD", whatever the display format.
 */
const DATE_RE = /^(\d{4})[/-](\d{2})[/-](\d{2})$/

/** "YYYY/MM/DD" for a valid date written with / or -, else ''. */
export function normalizeDate(v: unknown): string {
  if (typeof v !== 'string') return ''
  const m = DATE_RE.exec(v.trim())
  if (!m) return ''
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return ''
  return `${m[1]}/${m[2]}/${m[3]}`
}

/** Stored date → value of an <input type="date"> ("YYYY-MM-DD"). */
export const toInputDate = (d: string) => d.replaceAll('/', '-')
/** <input type="date"> value → stored date ('' when cleared or invalid). */
export const fromInputDate = (v: string) => normalizeDate(v)

const FORMAT_OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  year: { year: 'numeric' },
  'month-numeric': { year: 'numeric', month: '2-digit' },
  'month-short': { year: 'numeric', month: 'short' },
  'month-long': { year: 'numeric', month: 'long' },
  full: { year: 'numeric', month: '2-digit', day: '2-digit' },
}

export const DATE_FORMATS = Object.keys(FORMAT_OPTIONS) as DateFormat[]

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, format: DateFormat): Intl.DateTimeFormat {
  const key = `${locale}|${format}`
  let f = formatters.get(key)
  if (!f) {
    // UTC on both sides: a stored day never shifts with the viewer's time zone
    f = new Intl.DateTimeFormat(locale, { ...FORMAT_OPTIONS[format], timeZone: 'UTC' })
    formatters.set(key, f)
  }
  return f
}

/** One stored date in the resume's language and the chosen precision ('' if empty / invalid). */
export function formatDate(stored: string, locale: string, format: DateFormat): string {
  const d = normalizeDate(stored)
  if (!d) return ''
  const [y, m, day] = d.split('/').map(Number)
  return formatter(locale, format).format(new Date(Date.UTC(y, m - 1, day)))
}

/**
 * "mars 2019 – juin 2022", "2022 – aujourd'hui", "2021" (same period once). A regular space around
 * the en dash: Intl's own range format uses thin spaces in some languages, which parsers handle badly.
 */
export function formatDateRange(range: DateRange, locale: ResumeLocale, format: DateFormat): string {
  return dateRangeParts(range, locale, format).join(' – ')
}

type DateRange = { start: string; end: string; current: boolean }

/** The dates of a range, 0 to 2 parts (the resume keeps each part on one line). */
export function dateRangeParts(range: DateRange, locale: ResumeLocale, format: DateFormat): string[] {
  const a = formatDate(range.start, locale, format)
  const b = range.current ? RESUME_LOCALES[locale].present : formatDate(range.end, locale, format)
  if (!a) return !range.current && b ? [b] : []
  if (!b || a === b) return [a]
  return [a, b]
}

/** Today as a stored date (default for a new entry's start). */
export function today(): string {
  const n = new Date()
  return `${n.getFullYear()}/${String(n.getMonth() + 1).padStart(2, '0')}/${String(n.getDate()).padStart(2, '0')}`
}
