import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultResume } from './defaultResume'
import { dateColumnFraction, normalizeLayout } from './layout'
import type { Contact, IconKey, Resume, Section } from './types'


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
  // `layout` was the removed one-column option
  const { layout: _removedLayout, ...savedTheme } = (r.theme ?? {}) as Resume['theme'] & { layout?: unknown }
  const theme = { ...defaultResume.theme, ...savedTheme }
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

export function parseResume(text: string): Resume {
  return migrate(JSON.parse(text))
}

/* ------------------------------------------------------------------ Versions library */

/** Before versions: a single resume. Kept untouched as a backup, read once to seed the library. */
const LEGACY_KEY = 'codacv.resume.v1'
const LIBRARY_KEY = 'codacv.library.v1'

export interface Version {
  id: string
  name: string
  updatedAt: number
  resume: Resume
}

interface Library {
  activeId: string
  versions: Version[]
}

const newId = () => Math.random().toString(36).slice(2, 10)

function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (raw) {
      const lib = JSON.parse(raw) as Library
      const versions = lib.versions.map((v) => ({ ...v, resume: migrate(v.resume) }))
      if (versions.length) return { activeId: versions.some((v) => v.id === lib.activeId) ? lib.activeId : versions[0].id, versions }
    }
  } catch (e) {
    console.warn('Could not load the versions library', e)
  }
  let resume = structuredClone(defaultResume)
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) resume = migrate(JSON.parse(legacy))
  } catch (e) {
    console.warn('Could not load the saved resume, using the example', e)
  }
  const id = newId()
  return { activeId: id, versions: [{ id, name: 'Principal', updatedAt: Date.now(), resume }] }
}

const HISTORY_LIMIT = 100
/** Edits closer together than this are merged into one undo step (typing). */
const GROUP_MS = 600

/**
 * Resume versions persisted in localStorage. `resume` is the active version; undo / redo work on it
 * (history resets when switching versions).
 */
export function useResumeStore() {
  const [initial] = useState(loadLibrary)
  const [versions, setVersions] = useState<Version[]>(initial.versions)
  const [activeId, setActiveId] = useState(initial.activeId)
  const [resume, setResumeState] = useState<Resume>(() => initial.versions.find((v) => v.id === initial.activeId)!.resume)
  const current = useRef(resume)
  const past = useRef<Resume[]>([])
  const future = useRef<Resume[]>([])
  const lastPush = useRef(0)
  const [, forceRender] = useState(0)

  const lastEdit = useRef(Date.now())

  // The active version always reflects the live resume. Memoized: a new array on every render
  // would make the drag-and-drop list of versions update itself in a loop.
  const liveVersions = useMemo(
    () => versions.map((v) => (v.id === activeId && v.resume !== resume ? { ...v, resume, updatedAt: lastEdit.current } : v)),
    [versions, activeId, resume],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify({ activeId, versions: liveVersions }))
      } catch (e) {
        console.warn('Could not save', e)
        alert("Impossible d'enregistrer : l'espace de stockage du navigateur est plein (photos trop lourdes ?).")
      }
    }, 300)
    return () => clearTimeout(t)
    // liveVersions is derived from these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, activeId, resume])

  const commit = (next: Resume) => {
    lastEdit.current = Date.now()
    current.current = next
    setResumeState(next)
  }

  const resetHistory = () => {
    past.current = []
    future.current = []
    lastPush.current = 0
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

  /** Freeze the live resume into the versions list (before switching / copying). */
  const snapshot = () => versions.map((v) => (v.id === activeId ? { ...v, resume: current.current, updatedAt: v.resume === current.current ? v.updatedAt : Date.now() } : v))

  const activate = (list: Version[], id: string) => {
    const target = list.find((v) => v.id === id)
    if (!target) return
    setVersions(list)
    setActiveId(id)
    commit(target.resume)
    resetHistory()
    forceRender((n) => n + 1)
  }

  const switchVersion = (id: string) => {
    if (id === activeId) return
    activate(snapshot(), id)
  }

  /** New version from the active one (copy) or from the example template; it becomes active. */
  const createVersion = (from: 'copy' | 'template', name?: string, resumeOverride?: Resume) => {
    const list = snapshot()
    const source = list.find((v) => v.id === activeId)!
    const id = newId()
    const resumeCopy = resumeOverride ?? (from === 'copy' ? structuredClone(source.resume) : structuredClone(defaultResume))
    const version: Version = { id, name: name ?? (from === 'copy' ? `${source.name} (copie)` : 'Nouveau CV'), updatedAt: Date.now(), resume: resumeCopy }
    const at = list.findIndex((v) => v.id === activeId) + 1
    activate([...list.slice(0, at), version, ...list.slice(at)], id)
  }

  const renameVersion = (id: string, name: string) => setVersions((vs) => vs.map((v) => (v.id === id ? { ...v, name } : v)))

  const deleteVersion = (id: string) => {
    const list = snapshot()
    if (list.length < 2) return
    const rest = list.filter((v) => v.id !== id)
    if (id === activeId) activate(rest, rest[Math.max(0, list.findIndex((v) => v.id === id) - 1)].id)
    else setVersions(rest)
  }

  const moveVersions = (next: Version[]) => setVersions(next.map((v) => versions.find((x) => x.id === v.id) ?? v))

  return {
    resume,
    setResume,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    versions: liveVersions,
    activeId,
    switchVersion,
    createVersion,
    renameVersion,
    deleteVersion,
    moveVersions,
  }
}

export type ResumeStore = ReturnType<typeof useResumeStore>
