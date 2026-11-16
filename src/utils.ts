import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Contact, ListItem, Section, SectionKind, TimelineEntry } from './types'

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
  }
}

/** Downscale an uploaded image to keep localStorage small. */
export function readImageFile(file: File, maxSize = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Invalid image'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function downloadText(fileName: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
