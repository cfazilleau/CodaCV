import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Contact, FactItem, HighlightItem, LevelItem, ListItem, ReferenceItem, Section, SectionKind, TimelineEntry } from './types'
import { defineStrings, strings, type UiLang } from './i18n'

export const uid = () => Math.random().toString(36).slice(2, 10)

marked.setOptions({ gfm: true, breaks: true })
// The resume has one H1 (the name) and H2 section titles: markdown headings start at H3
marked.use({
  walkTokens(token) {
    if (token.type === 'heading') token.depth = Math.max(3, token.depth)
  },
})

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Link target as written in the PDF: http(s), mailto and tel are kept; an address without a scheme
 * ("linkedin.com/in/x") gets https:// (it would otherwise resolve against the app's own URL); an
 * e-mail gets mailto:; any other scheme (javascript:, data:, file:…) gives no link.
 */
export function normalizeHref(raw: string): string | undefined {
  const url = raw.trim()
  if (!url) return undefined
  if (/^tel:/i.test(url)) return `tel:${url.slice(4).replace(/[^\d+]/g, '')}`
  if (/^(https?|mailto):/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (EMAIL.test(url)) return `mailto:${url}`
  // A scheme, unless it is a host:port ("localhost:3000")
  if (/^[a-z][a-z\d+-]*:(?!\d)/i.test(url)) return undefined
  return `https://${url}`
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = normalizeHref(node.getAttribute('href') ?? '')
    if (href) node.setAttribute('href', href)
    else node.removeAttribute('href')
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/*
 * Markdown may contain raw HTML (typed, pasted, or from an imported file). Only plain text
 * formatting is kept: no style / class / id (positioned elements break the PDF reading order, and
 * app class names would restyle the page), no forms, media or embeds. Images written in a free-text
 * section are allowed on purpose (the owner's choice): they are the only content that can load
 * something from another site.
 */
const INLINE_TAGS = ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'sub', 'sup', 'span', 'br']
const BLOCK_TAGS = [...INLINE_TAGS, 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src']

/**
 * The photo is shown only when it is embedded in the data (uploads are stored as JPEG data URLs).
 * A web address (possible in an imported file) is kept but never loaded.
 */
export const isEmbeddedImage = (src: string) => /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src)

/**
 * A colour as it may be written into a CSS variable: hex, a colour name, rgb() / hsl(). Anything
 * else (e.g. "url(https://…)" from an imported theme, which `background: var(--accent)` would
 * fetch) gives the fallback.
 */
export function cssColor(value: string, fallback: string): string {
  const v = value.trim()
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^[a-z]{3,30}$/i.test(v) || /^(rgb|hsl)a?\([\d\s.,%/+-]*\)$/i.test(v) ? v : fallback
}

/**
 * The whole resume re-renders on every keystroke: parsing + sanitizing every bullet each time is
 * the costly part, so results are cached by source text (output only depends on it).
 */
function cached(fn: (src: string) => string): (src: string) => string {
  const cache = new Map<string, string>()
  return (src) => {
    let html = cache.get(src)
    if (html === undefined) {
      if (cache.size > 2000) cache.clear() // old texts pile up while typing
      html = fn(src)
      cache.set(src, html)
    }
    return html
  }
}

/** Inline markdown (bold, italic, links, code) for one-line fields like bullets. */
export const inlineMd = cached((src) =>
  DOMPurify.sanitize(marked.parseInline(src, { async: false }) as string, { ALLOWED_TAGS: INLINE_TAGS, ALLOWED_ATTR }),
)

/** Block markdown (free-text sections). Images are allowed here (documented in the editor hint). */
export const blockMd = cached((src) =>
  DOMPurify.sanitize(marked.parse(src, { async: false }) as string, { ALLOWED_TAGS: BLOCK_TAGS, ALLOWED_ATTR }),
)

export function contactHref(c: Contact): string | undefined {
  if (c.url.trim()) return normalizeHref(c.url)
  const label = c.label.trim()
  if (EMAIL.test(label)) return `mailto:${label}`
  if (isPhone(label)) return `tel:${label.replace(/[^\d+]/g, '')}`
  return undefined
}

/** A phone number: digits with spaces / dots / dashes / brackets, 8 to 15 digits, not a year range ("2015-2024"). */
function isPhone(text: string): boolean {
  if (!/^\+?[\d\s().-]+$/.test(text)) return false
  const digits = text.replace(/\D/g, '').length
  return digits >= 8 && digits <= 15 && !/^\d{4}\s*[-–]\s*\d{4}$/.test(text)
}

/**
 * Default texts written into a new section / item. They become resume content, so they follow the
 * resume's language (see `contentLang()` in locale.ts), not necessarily the UI language.
 */
const C = defineStrings(
  {
    newEntry: 'Nouvelle entrée',
    newItem: 'Nouvel élément',
    keywords: 'Mots-clés',
    newSection: 'Nouvelle section',
    newList: 'Nouvelle liste',
    newText: 'Nouveau texte',
    languages: 'Langues',
    languageItems: [
      ['Français', 'Langue maternelle', 5],
      ['Anglais', 'C1', 4],
    ] as [string, string, number][],
    facts: 'Informations',
    factItems: [
      ['Permis', 'B'],
      ['Disponibilité', 'Immédiate'],
      ['Mobilité', 'France, Canada'],
    ] as [string, string][],
    references: 'Références',
    onRequest: 'Références disponibles sur demande',
    reference: { name: 'Prénom Nom', role: 'Poste', company: 'Entreprise' },
    highlights: 'Chiffres clés',
    highlightItems: [
      ['8 ans', "d'expérience"],
      ['25+', 'projets livrés'],
      ['400 k€', 'de budget géré'],
    ] as [string, string][],
  },
  {
    newEntry: 'New entry',
    newItem: 'New item',
    keywords: 'Keywords',
    newSection: 'New section',
    newList: 'New list',
    newText: 'New text',
    languages: 'Languages',
    languageItems: [
      ['English', 'Native', 5],
      ['French', 'C1', 4],
    ],
    facts: 'Details',
    factItems: [
      ['Driving licence', 'B'],
      ['Availability', 'Immediate'],
      ['Mobility', 'UK, Canada'],
    ],
    references: 'References',
    onRequest: 'References available on request',
    reference: { name: 'First Last', role: 'Position', company: 'Company' },
    highlights: 'Key figures',
    highlightItems: [
      ['8 years', 'of experience'],
      ['25+', 'projects delivered'],
      ['€400k', 'budget managed'],
    ],
  },
)

/** Default texts in a given language (`strings(C)` would use the UI language). */
const content = (lang: UiLang) => C[lang]

export function newEntry(lang: UiLang): TimelineEntry {
  return {
    id: uid(),
    start: '',
    end: '',
    current: false,
    subDate: '',
    country: '',
    location: '',
    title: content(lang).newEntry,
    subtitle: '',
    url: '',
    bullets: [],
    hidden: false,
  }
}

export function newListItem(text: string): ListItem {
  return { id: uid(), text, hidden: false }
}

/** 'tags' is a list section drawn as chips. */
export function newSection(kind: SectionKind | 'tags', lang: UiLang): Section {
  const t = content(lang)
  const base = { id: uid(), visible: true, place: 'row' as const }
  switch (kind) {
    case 'tags':
      return {
        ...base,
        kind: 'list',
        display: 'chips',
        title: t.keywords,
        items: ['Tag 1', 'Tag 2', 'Tag 3'].map((x) => newListItem(x)),
      }
    case 'timeline':
      return { ...base, kind, title: t.newSection, entries: [newEntry(lang)] }
    case 'list':
      return { ...base, kind, title: t.newList, items: [newListItem(t.newItem)] }
    case 'text':
      return { ...base, kind, title: t.newText, text: '' }
    case 'levels':
      return {
        ...base,
        kind,
        title: t.languages,
        meter: 'dots',
        items: t.languageItems.map(([name, level, rating]) => newLevelItem(name, level, rating)),
      }
    case 'facts':
      return { ...base, kind, title: t.facts, items: t.factItems.map(([k, v]) => newFactItem(k, v)) }
    case 'references':
      return { ...base, kind, title: t.references, onRequest: false, onRequestText: t.onRequest, items: [newReferenceItem(lang)] }
    case 'highlights':
      return {
        ...base,
        kind,
        title: t.highlights,
        hideTitle: true,
        items: t.highlightItems.map(([v, l]) => newHighlightItem(v, l)),
      }
  }
}

export function newLevelItem(name = '', level = '', rating = 0): LevelItem {
  return { id: uid(), name, level, rating, hidden: false }
}

export function newFactItem(key = '', value = ''): FactItem {
  return { id: uid(), key, value, hidden: false }
}

export function newReferenceItem(lang: UiLang): ReferenceItem {
  return { id: uid(), ...content(lang).reference, contact: 'contact@example.com', hidden: false }
}

export function newHighlightItem(value = '', label = ''): HighlightItem {
  return { id: uid(), value, label, hidden: false }
}

/** mailto: / tel: link for a free-text contact (references) */
export function autoHref(text: string): string | undefined {
  return contactHref({ id: '', icon: 'none', label: text, url: '' })
}

const E = defineStrings({ badImage: 'Image illisible' }, { badImage: 'Unreadable image' })

/** Largest side of a stored photo, in pixels (about 45 mm at 270 dpi: plenty for print). */
const PHOTO_MAX_PX = 480

/** Downscale an image (any URL the browser can load) to a JPEG data URL, to keep localStorage small. */
export function downscaleImage(src: string, maxSize = PHOTO_MAX_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error(strings(E).badImage))
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const g = canvas.getContext('2d')!
        // JPEG has no transparency: paint white first, or transparent areas come out black
        g.fillStyle = '#fff'
        g.fillRect(0, 0, canvas.width, canvas.height)
        g.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      } catch (e) {
        reject(e)
      }
    }
    img.src = src
  })
}

/** Read an uploaded image file, downscaled. */
export function readImageFile(file: File, maxSize = PHOTO_MAX_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => downscaleImage(reader.result as string, maxSize).then(resolve, reject)
    reader.readAsDataURL(file)
  })
}

/** Imported photos above this size (characters of data URL) are downscaled like uploads. */
export const PHOTO_MAX_CHARS = 150_000

export function downloadText(fileName: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
