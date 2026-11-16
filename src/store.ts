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
export type StorageIssue =
  | { kind: 'other-tab' }
  | { kind: 'unreadable' }
  | { kind: 'quarantined'; count: number; key: string }
  /** The last save failed (storage full); the next change tries again */
  | { kind: 'save-failed' }

/* Photos are data URLs of tens of kB, and duplicated versions share them: the saved library keeps
   each distinct photo once, in `photos`, and versions refer to it as "photo:<key>". */
const PHOTO_REF = 'photo:'

function photoKey(data: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data.charCodeAt(i), 0x01000193)
  return `${(h >>> 0).toString(36)}-${data.length.toString(36)}`
}

/** Library as written to storage: photos moved out of the versions, each distinct one once. */
function packLibrary(activeId: string, versions: Version[]) {
  const photos: Record<string, string> = {}
  const packed = versions.map((v) => {
    const photo = v.resume.profile.photo
    if (!photo.startsWith('data:')) return v
    let key = photoKey(photo)
    while (photos[key] !== undefined && photos[key] !== photo) key += '_'
    photos[key] = photo
    return { ...v, resume: { ...v.resume, profile: { ...v.resume.profile, photo: PHOTO_REF + key } } }
  })
  return { activeId, versions: packed, photos }
}

/** Put the shared photos back into the stored versions (before they are migrated or quarantined). */
function unpackPhotos(versions: unknown[], photos: unknown) {
  if (!isObj(photos)) return
  for (const v of versions) {
    const profile = isObj(v) && isObj(v.resume) && isObj(v.resume.profile) ? v.resume.profile : null
    if (profile && typeof profile.photo === 'string' && profile.photo.startsWith(PHOTO_REF)) {
      const data = photos[profile.photo.slice(PHOTO_REF.length)]
      profile.photo = typeof data === 'string' ? data : ''
    }
  }
}

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
    const stored = isObj(parsed) && Array.isArray(parsed.versions) ? parsed.versions : []
    unpackPhotos(stored, isObj(parsed) ? parsed.photos : undefined)
    for (const v of stored) {
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
/** Edits of the same thing closer together than this are merged into one undo step (typing, a drag). */
const GROUP_MS = 600

/**
 * What an edit touched: profile / theme fields, meta, one section, or the sections order. Only
 * consecutive edits with the same key are merged, so typing then dropping a section quickly are
 * two undo steps. (Layout operations rebuild every section, so a drag keeps one key throughout.)
 */
function changeKey(prev: Resume, next: Resume): string {
  const parts: string[] = []
  if (prev.meta !== next.meta) parts.push('meta')
  const fields = <T extends object>(name: string, a: T, b: T) => {
    if (a !== b) for (const k of Object.keys(b) as (keyof T)[]) if (a[k] !== b[k]) parts.push(`${name}.${String(k)}`)
  }
  fields('profile', prev.profile, next.profile)
  fields('theme', prev.theme, next.theme)
  if (prev.sections !== next.sections) {
    if (prev.sections.map((s) => s.id).join() !== next.sections.map((s) => s.id).join()) parts.push('sections')
    else next.sections.forEach((s, i) => s !== prev.sections[i] && parts.push(`section.${s.id}`))
  }
  return parts.join(' ')
}

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
  /** changeKey of the last edit, for undo grouping */
  const lastKey = useRef('')
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

  /** The save waiting for its debounce, run at once when the page is hidden or closed */
  const pendingSave = useRef<(() => void) | null>(null)

  useEffect(() => {
    const s = saved.current
    if (savingBlocked || (s.versions === versions && s.activeId === activeId && s.resume === resume)) return
    let done = false
    const save = () => {
      if (done) return
      done = true
      pendingSave.current = null
      if (readRev() !== rev.current) {
        setIssue({ kind: 'other-tab' })
        return
      }
      try {
        const next = rev.current + 1
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(packLibrary(activeId, liveVersions)))
        localStorage.setItem(REV_KEY, String(next))
        rev.current = next
        saved.current = { versions, activeId, resume }
        setIssue((i) => (i?.kind === 'save-failed' ? null : i))
      } catch (e) {
        // Shown until a save succeeds (no alert: it would pop up after every edit)
        console.warn('Could not save', e)
        setIssue((i) => (i?.kind === 'other-tab' || i?.kind === 'unreadable' ? i : { kind: 'save-failed' }))
      }
    }
    pendingSave.current = save
    const t = setTimeout(save, 300)
    return () => {
      clearTimeout(t)
      if (pendingSave.current === save) pendingSave.current = null
    }
    // liveVersions is derived from these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, activeId, resume, savingBlocked])

  // Closing or hiding the tab within the debounce would lose the last edit: save it now
  useEffect(() => {
    const flush = () => pendingSave.current?.()
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

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
    const key = changeKey(prev, next)
    if (now - lastPush.current > GROUP_MS || key !== lastKey.current) {
      past.current.push(prev)
      if (past.current.length > HISTORY_LIMIT) past.current.shift()
    }
    lastPush.current = now
    lastKey.current = key
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
