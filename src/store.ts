import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultResume } from './defaultResume'
import { migrate } from './migrate'
import type { Resume } from './types'
import { uid } from './utils'

export { parseResume } from './migrate'

/* ------------------------------------------------------------------ Versions library */

/** Before versions: a single resume. Kept untouched as a backup, read once to seed the library. */
const LEGACY_KEY = 'codacv.resume.v1'
export const LIBRARY_KEY = 'codacv.library.v1'
/** Bumped on every save, so a tab can tell that another tab saved in between. */
const REV_KEY = 'codacv.library.rev'
/** Side panel tab (per-browser convenience) */
export const TAB_KEY = 'codacv.sidebarTab'
/** Versions that could not be read are copied here (one key per occurrence) instead of being dropped. */
const QUARANTINE_PREFIX = 'codacv.quarantine'

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

/**
 * Something the user must know about the saved data:
 * - other-tab: another tab saved the library; this tab stops saving until the user decides
 * - unreadable: the saved library could not be read nor copied aside; saving would erase it
 * - quarantined: some versions could not be read; they were copied to `key` and left out
 */
export type StorageIssue = { kind: 'other-tab' } | { kind: 'unreadable' } | { kind: 'quarantined'; count: number; key: string }

interface Loaded {
  library: Library
  rev: number
  issue: StorageIssue | null
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readRev(): number {
  try {
    return Number(localStorage.getItem(REV_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Copy data aside under a new key (or the key that already holds the same data: the library is not
 * rewritten until the next edit, so every load in between finds the same bad data).
 * Returns the key, or null when the storage refused it (full).
 */
function quarantine(data: string): string | null {
  const key = `${QUARANTINE_PREFIX}.${new Date().toISOString()}`
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(`${QUARANTINE_PREFIX}.`) && localStorage.getItem(k) === data) return k
    }
    localStorage.setItem(key, data)
    return key
  } catch {
    return null
  }
}

function loadLibrary(): Loaded {
  const rev = readRev()
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LIBRARY_KEY)
  } catch (e) {
    console.warn('Could not read the browser storage', e)
  }

  let issue: StorageIssue | null = null
  if (raw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      console.warn('The versions library is not valid JSON', e)
    }
    // Each version is read on its own: one bad version must not take the others with it
    const versions: Version[] = []
    const bad: unknown[] = []
    const ids = new Set<string>()
    for (const v of isObj(parsed) && Array.isArray(parsed.versions) ? parsed.versions : []) {
      try {
        if (!isObj(v)) throw new Error('Not a version')
        let id = typeof v.id === 'string' && v.id ? v.id : uid()
        while (ids.has(id)) id = uid()
        ids.add(id)
        versions.push({
          id,
          name: typeof v.name === 'string' ? v.name : 'Sans nom',
          updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
          resume: migrate(v.resume),
        })
      } catch (e) {
        console.warn('Could not read a version, it is kept aside', e)
        bad.push(v)
      }
    }
    if (bad.length || !versions.length) {
      // Keep what could not be read before anything can overwrite it
      const key = quarantine(versions.length ? JSON.stringify(bad) : raw)
      issue = key ? { kind: 'quarantined', count: Math.max(1, bad.length), key } : { kind: 'unreadable' }
    }
    if (versions.length) {
      const activeId = isObj(parsed) && versions.some((v) => v.id === parsed.activeId) ? (parsed.activeId as string) : versions[0].id
      return { library: { activeId, versions }, rev, issue }
    }
  }

  let resume = structuredClone(defaultResume)
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) resume = migrate(JSON.parse(legacy))
  } catch (e) {
    console.warn('Could not load the saved resume, using the example', e)
  }
  const id = uid()
  return { library: { activeId: id, versions: [{ id, name: 'Principal', updatedAt: Date.now(), resume }] }, rev, issue }
}

/** Loading copies unreadable data aside: do it once, even though StrictMode runs state initializers twice. */
let loaded: Loaded | undefined
const loadOnce = () => (loaded ??= loadLibrary())

const HISTORY_LIMIT = 100
/** Edits closer together than this are merged into one undo step (typing). */
const GROUP_MS = 600

/**
 * Resume versions persisted in localStorage. `resume` is the active version; undo / redo work on it
 * (history resets when switching versions).
 *
 * Saving: nothing is written until something changes, and never over a library that another tab
 * saved in the meantime (revision check + `storage` events): the user is asked instead.
 */
export function useResumeStore() {
  const [initial] = useState(loadOnce)
  const [versions, setVersions] = useState<Version[]>(initial.library.versions)
  const [activeId, setActiveId] = useState(initial.library.activeId)
  const [resume, setResumeState] = useState<Resume>(() => initial.library.versions.find((v) => v.id === initial.library.activeId)!.resume)
  const [issue, setIssue] = useState<StorageIssue | null>(initial.issue)
  const current = useRef(resume)
  const past = useRef<Resume[]>([])
  const future = useRef<Resume[]>([])
  const lastPush = useRef(0)
  /** Revision of the library this tab last loaded or saved */
  const rev = useRef(initial.rev)
  /** State last loaded or saved: no write while it is unchanged */
  const saved = useRef({ versions, activeId, resume })

  const lastEdit = useRef(Date.now())

  // The active version always reflects the live resume. Memoized: a new array on every render
  // would make the drag-and-drop list of versions update itself in a loop.
  const liveVersions = useMemo(
    () => versions.map((v) => (v.id === activeId && v.resume !== resume ? { ...v, resume, updatedAt: lastEdit.current } : v)),
    [versions, activeId, resume],
  )

  const savingBlocked = issue?.kind === 'other-tab' || issue?.kind === 'unreadable'

  useEffect(() => {
    const s = saved.current
    if (savingBlocked || (s.versions === versions && s.activeId === activeId && s.resume === resume)) return
    const t = setTimeout(() => {
      if (readRev() !== rev.current) {
        setIssue({ kind: 'other-tab' })
        return
      }
      try {
        const next = rev.current + 1
        localStorage.setItem(LIBRARY_KEY, JSON.stringify({ activeId, versions: liveVersions }))
        localStorage.setItem(REV_KEY, String(next))
        rev.current = next
        saved.current = { versions, activeId, resume }
      } catch (e) {
        console.warn('Could not save', e)
        alert("Impossible d'enregistrer : l'espace de stockage du navigateur est plein (photos trop lourdes ?).")
      }
    }, 300)
    return () => clearTimeout(t)
    // liveVersions is derived from these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, activeId, resume, savingBlocked])

  // Another tab saved (storage events only reach the other tabs): stop saving here
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LIBRARY_KEY || e.key === REV_KEY) setIssue({ kind: 'other-tab' })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** Save this tab's library over whatever is stored (after an other-tab / unreadable warning). */
  const overwriteStorage = useCallback(() => {
    rev.current = readRev()
    saved.current = { versions: [], activeId: '', resume: current.current }
    setIssue(null)
  }, [])

  const dismissIssue = useCallback(() => setIssue((i) => (i?.kind === 'quarantined' ? null : i)), [])

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
  }

  const switchVersion = (id: string) => {
    if (id === activeId) return
    activate(snapshot(), id)
  }

  /** New version from the active one (copy) or from the example template; it becomes active. */
  const createVersion = (from: 'copy' | 'template', name?: string, resumeOverride?: Resume) => {
    const list = snapshot()
    const source = list.find((v) => v.id === activeId)!
    const id = uid()
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
    storageIssue: issue,
    overwriteStorage,
    dismissIssue,
  }
}

export type ResumeStore = ReturnType<typeof useResumeStore>
