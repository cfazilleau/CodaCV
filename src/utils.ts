import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Contact, FactItem, HighlightItem, LevelItem, ListItem, ReferenceItem, Section, SectionKind, TimelineEntry } from './types'

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
 * app class names would restyle the page), no forms, media or embeds.
 */
const INLINE_TAGS = ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'sub', 'sup', 'span', 'br']
const BLOCK_TAGS = [...INLINE_TAGS, 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src']

/** Inline markdown (bold, italic, links, code) for one-line fields like bullets. */
export function inlineMd(src: string): string {
  return DOMPurify.sanitize(marked.parseInline(src, { async: false }) as string, { ALLOWED_TAGS: INLINE_TAGS, ALLOWED_ATTR })
}

/** Block markdown (free-text sections). Images are allowed here (documented in the editor hint). */
export function blockMd(src: string): string {
  return DOMPurify.sanitize(marked.parse(src, { async: false }) as string, { ALLOWED_TAGS: BLOCK_TAGS, ALLOWED_ATTR })
}

export function contactHref(c: Contact): string | undefined {
  if (c.url.trim()) return normalizeHref(c.url)
  const label = c.label.trim()
  if (EMAIL.test(label)) return `mailto:${label}`
  if (/^\+?[\d\s().-]{6,}$/.test(label)) return `tel:${label.replace(/[^\d+]/g, '')}`
  return undefined
}

export function newEntry(): TimelineEntry {
  return {
    id: uid(),
    date: '',
    subDate: '',
    country: '',
    location: '',
    title: 'Nouvelle entrée',
    subtitle: '',
    url: '',
    bullets: [],
    hidden: false,
  }
}

export function newListItem(text = 'Nouvel élément'): ListItem {
  return { id: uid(), text, hidden: false }
}

/** 'tags' is a list section drawn as chips. */
export function newSection(kind: SectionKind | 'tags'): Section {
  const base = { id: uid(), visible: true, place: 'row' as const }
  switch (kind) {
    case 'tags':
      return {
        ...base,
        kind: 'list',
        display: 'chips',
        title: 'Mots-clés',
        items: ['Tag 1', 'Tag 2', 'Tag 3'].map((t) => newListItem(t)),
      }
    case 'timeline':
      return { ...base, kind, title: 'Nouvelle section', entries: [newEntry()] }
    case 'list':
      return { ...base, kind, title: 'Nouvelle liste', items: [newListItem()] }
    case 'text':
      return { ...base, kind, title: 'Nouveau texte', text: '' }
    case 'levels':
      return {
        ...base,
        kind,
        title: 'Langues',
        meter: 'dots',
        items: [newLevelItem('Français', 'Langue maternelle', 5), newLevelItem('Anglais', 'C1', 4)],
      }
    case 'facts':
      return {
        ...base,
        kind,
        title: 'Informations',
        items: [newFactItem('Permis', 'B'), newFactItem('Disponibilité', 'Immédiate'), newFactItem('Mobilité', 'France, Canada')],
      }
    case 'references':
      return {
        ...base,
        kind,
        title: 'Références',
        onRequest: false,
        onRequestText: 'Références disponibles sur demande',
        items: [newReferenceItem()],
      }
    case 'highlights':
      return {
        ...base,
        kind,
        title: 'Chiffres clés',
        hideTitle: true,
        items: [newHighlightItem('8 ans', "d'expérience"), newHighlightItem('25+', 'projets livrés'), newHighlightItem('400 k€', 'de budget géré')],
      }
  }
}

export function newLevelItem(name = '', level = '', rating = 0): LevelItem {
  return { id: uid(), name, level, rating, hidden: false }
}

export function newFactItem(key = '', value = ''): FactItem {
  return { id: uid(), key, value, hidden: false }
}

export function newReferenceItem(): ReferenceItem {
  return { id: uid(), name: 'Prénom Nom', role: 'Poste', company: 'Entreprise', contact: 'contact@example.com', hidden: false }
}

export function newHighlightItem(value = '', label = ''): HighlightItem {
  return { id: uid(), value, label, hidden: false }
}

/** mailto: / tel: link for a free-text contact (references) */
export function autoHref(text: string): string | undefined {
  return contactHref({ id: '', icon: 'none', label: text, url: '' })
}

/** Largest side of a stored photo, in pixels (about 45 mm at 270 dpi: plenty for print). */
const PHOTO_MAX_PX = 480

/** Downscale an image (any URL the browser can load) to a JPEG data URL, to keep localStorage small. */
export function downscaleImage(src: string, maxSize = PHOTO_MAX_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Image illisible'))
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
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
