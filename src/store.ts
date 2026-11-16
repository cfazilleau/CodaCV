import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultResume } from './defaultResume'
import { dateColumnFraction, normalizeLayout } from './layout'
import type { Contact, IconKey, Resume, Section } from './types'

const STORAGE_KEY = 'codacv.resume.v1'

function migrate(data: unknown): Resume {
  const r = data as Partial<Resume>
  if (!r || typeof r !== 'object' || !r.profile || !Array.isArray(r.sections)) {
    throw new Error('Not a CodaCV resume file')
  }
  const profile = stripDetails({ ...defaultResume.profile, ...r.profile })
  // v1 early format: contacts had a `kind` instead of an `icon`, summaryIcon was a boolean
  const legacy = profile as unknown as { summaryIcon: unknown; contacts: (Contact & { kind?: string })[] }
  if (typeof legacy.summaryIcon === 'boolean') profile.summaryIcon = legacy.summaryIcon ? 'pin' : 'none'
  profile.contacts = legacy.contacts.map(({ kind, ...c }) => ({
    ...c,
    icon: c.icon ?? LEGACY_KIND_ICON[kind ?? ''] ?? 'globe',
  }))
  const theme = { ...defaultResume.theme, ...r.theme }
  return {
    ...defaultResume,
    ...r,
    version: 1,
    meta: { ...defaultResume.meta, ...r.meta },
    profile,
    sections: migrateSections(r.sections as LegacySection[], theme),
    theme,
  } as Resume
}

type LegacySection = Section & { pairWithNext?: boolean; spaceBefore?: number }

/** Early format: `pairWithNext` put a section in a narrow column next to the following one. */
/** Drop the `details` field of the removed web-page feature. */
function stripDetails<T extends object>(o: T): T {
  const { details: _removed, ...rest } = o as T & { details?: unknown }
  return rest as T
}

function migrateSections(sections: LegacySection[], theme: Resume['theme']): Section[] {
  // pairWithNext: early pairing flag; spaceBefore: removed per-section spacing feature
  const out = sections.map(({ pairWithNext: _legacy, spaceBefore: _removed, ...s }) => {
    const base = { ...s, place: s.place ?? 'row' } as Section
    if (base.kind === 'timeline') return { ...base, entries: base.entries.map(stripDetails) }
    if (base.kind === 'list') return { ...base, items: base.items.map(stripDetails) }
    return base
  })
  sections.forEach((s, i) => {
    if (s.place || !s.pairWithNext || !out[i + 1]) return
    const narrow = dateColumnFraction(theme.dateColumn, theme.marginX)
    out[i] = { ...out[i], colWidth: narrow }
    out[i + 1] = { ...out[i + 1], place: 'column', colWidth: 1 - narrow }
  })
  return normalizeLayout(out)
}

const LEGACY_KIND_ICON: Record<string, IconKey> = {
  website: 'link',
  linkedin: 'linkedin',
  github: 'github',
  phone: 'phone',
  email: 'mail',
  location: 'pin',
  other: 'globe',
}

export function loadResume(): Resume {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch (e) {
    console.warn('Could not load saved resume, using default', e)
  }
  return structuredClone(defaultResume)
}

export function parseResume(text: string): Resume {
  return migrate(JSON.parse(text))
}

const HISTORY_LIMIT = 100
/** Edits closer together than this are merged into one undo step (typing). */
const GROUP_MS = 600

/** Resume state persisted in localStorage, with undo / redo. */
export function useResumeStore() {
  const [resume, setResumeState] = useState<Resume>(loadResume)
  const current = useRef(resume)
  const past = useRef<Resume[]>([])
  const future = useRef<Resume[]>([])
  const lastPush = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resume))
      } catch (e) {
        console.warn('Could not save resume', e)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [resume])

  const commit = (next: Resume) => {
    current.current = next
    setResumeState(next)
  }

  const setResume = useCallback((updater: Resume | ((r: Resume) => Resume)) => {
    const prev = current.current
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next === prev) return
    const now = Date.now()
    if (now - lastPush.current > GROUP_MS) {
      past.current.push(prev)
      if (past.current.length > HISTORY_LIMIT) past.current.shift()
    }
    lastPush.current = now
    future.current = []
    commit(next)
  }, [])

  const undo = useCallback(() => {
    const p = past.current.pop()
    if (!p) return
    future.current.push(current.current)
    lastPush.current = 0
    commit(p)
  }, [])

  const redo = useCallback(() => {
    const f = future.current.pop()
    if (!f) return
    past.current.push(current.current)
    lastPush.current = 0
    commit(f)
  }, [])

  return {
    resume,
    setResume,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  }
}
