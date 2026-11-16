import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Contact, FactItem, HighlightItem, LevelItem, ListItem, ReferenceItem, Section, SectionKind, TimelineEntry } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

marked.setOptions({ gfm: true, breaks: true })

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** Inline markdown (bold, italic, links, code) for one-line fields like bullets. */
export function inlineMd(src: string): string {
  return DOMPurify.sanitize(marked.parseInline(src, { async: false }) as string)
}

/** Block markdown (free-text sections). */
export function blockMd(src: string): string {
  return DOMPurify.sanitize(marked.parse(src, { async: false }) as string)
}

export function contactHref(c: Contact): string | undefined {
  if (c.url) return c.url
  const label = c.label.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label)) return `mailto:${label}`
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
