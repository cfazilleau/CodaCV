import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Download,
  ExternalLink,
  FileUp,
  Globe,
  PenLine,
  Printer,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useResumeStore, parseResume } from './store'
import { defaultResume } from './defaultResume'
import type { Resume, Selection } from './types'
import { ResumeDocument } from './components/ResumeDocument'
import { DetailsDrawer } from './components/DetailsDrawer'
import { LayoutOverlay } from './components/LayoutOverlay'
import { Editor } from './components/editor/Editor'
import { downloadText, STRINGS } from './utils'

type Mode = 'edit' | 'view'

const MM = 96 / 25.4 // CSS px per mm
const A4_W = 210
const A4_H = 297

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

/** Injects @page rules matching the theme margins and sets the PDF file name while printing. */
function usePrintSetup(resume: Resume) {
  useEffect(() => {
    let style = document.getElementById('print-page-style') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'print-page-style'
      document.head.appendChild(style)
    }
    style.textContent = `@page { size: A4; margin: ${resume.theme.marginY}mm ${resume.theme.marginX}mm; }`
  }, [resume.theme.marginX, resume.theme.marginY])

  useEffect(() => {
    const original = document.title
    const before = () => (document.title = resume.meta.fileName || resume.profile.name || 'CV')
    const after = () => (document.title = original)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [resume.meta.fileName, resume.profile.name])
}

export default function App() {
  const store = useResumeStore()
  const { resume, setResume, undo, redo } = store
  const hash = useHashRoute()
  const standalone = hash.startsWith('#/view')
  const [mode, setMode] = useState<Mode>(standalone ? 'view' : 'edit')
  const [selection, setSelection] = useState<Selection>(null)
  const effectiveMode: Mode = standalone ? 'view' : mode

  usePrintSetup(resume)

  // Document language ends up as /Lang in the PDF (used by parsers and screen readers)
  useEffect(() => {
    document.documentElement.lang = resume.meta.locale
  }, [resume.meta.locale])

  useEffect(() => {
    if (standalone) document.title = resume.profile.name ? `${resume.profile.name} — CV` : 'CV'
    else document.title = 'CodaCV'
  }, [standalone, resume.profile.name])

  // Clear selection when switching mode so the drawer doesn't pop open
  useEffect(() => setSelection(null), [effectiveMode])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'p') {
        e.preventDefault()
        window.print()
      } else if (!standalone && k === 'z' && !e.shiftKey) {
        if ((e.target as HTMLElement).closest('input, textarea')) return
        e.preventDefault()
        undo()
      } else if (!standalone && (k === 'y' || (k === 'z' && e.shiftKey))) {
        if ((e.target as HTMLElement).closest('input, textarea')) return
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [standalone, undo, redo])

  const fileInput = useRef<HTMLInputElement>(null)
  const importJson = async (file: File) => {
    try {
      const r = parseResume(await file.text())
      setResume(r)
      setSelection(null)
    } catch (e) {
      alert(`Import impossible : ${(e as Error).message}`)
    }
  }

  const closeDrawer = useCallback(() => setSelection(null), [])

  if (standalone) {
    return (
      <div className="viewer">
        <ViewerToolbar resume={resume} />
        <div className="viewer-page">
          <ResumeDocument resume={resume} mode="view" selection={selection} onSelect={setSelection} />
        </div>
        <DetailsDrawer resume={resume} selection={selection} onClose={closeDrawer} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">CV</span>
          <span>CodaCV</span>
        </div>

        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'is-active' : ''} onClick={() => setMode('edit')}>
            <PenLine size={15} /> Éditer
          </button>
          <button role="tab" aria-selected={mode === 'view'} className={mode === 'view' ? 'is-active' : ''} onClick={() => setMode('view')}>
            <Globe size={15} /> Page web
          </button>
        </div>

        <div className="topbar-actions">
          <button className="tb-btn" title="Annuler (Ctrl+Z)" disabled={!store.canUndo} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button className="tb-btn" title="Rétablir (Ctrl+Y)" disabled={!store.canRedo} onClick={redo}>
            <Redo2 size={16} />
          </button>
          <span className="tb-sep" />
          <button className="tb-btn" title="Importer un fichier JSON" onClick={() => fileInput.current?.click()}>
            <FileUp size={16} /> <span className="tb-label">Importer</span>
          </button>
          <button
            className="tb-btn"
            title="Exporter les données en JSON"
            onClick={() => downloadText(`${resume.meta.fileName || 'cv'}.json`, JSON.stringify(resume, null, 2))}
          >
            <Download size={16} /> <span className="tb-label">Exporter</span>
          </button>
          <button
            className="tb-btn"
            title="Réinitialiser avec le modèle"
            onClick={() => {
              if (confirm('Remplacer toutes les données par le CV modèle ? (Annulable avec Ctrl+Z)')) setResume(structuredClone(defaultResume))
            }}
          >
            <RotateCcw size={16} />
          </button>
          <a className="tb-btn" href="#/view" target="_blank" rel="noopener" title="Ouvrir la page web seule dans un nouvel onglet">
            <ExternalLink size={16} />
          </a>
          <button className="btn btn--primary" onClick={() => window.print()} title="Imprimer ou enregistrer en PDF (Ctrl+P)">
            <Printer size={16} /> PDF
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <main className={`workspace workspace--${mode}`}>
        {mode === 'edit' && (
          <aside className="sidebar">
            <Editor resume={resume} setResume={setResume} selection={selection} onSelect={setSelection} />
          </aside>
        )}
        <PreviewPane resume={resume} setResume={setResume} mode={mode} selection={selection} onSelect={setSelection} />
      </main>

      {mode === 'view' && <DetailsDrawer resume={resume} selection={selection} onClose={closeDrawer} />}
    </div>
  )
}

function ViewerToolbar({ resume }: { resume: Resume }) {
  const t = STRINGS[resume.meta.locale]
  return (
    <div className="viewer-toolbar">
      <span className="viewer-hint">{t.clickHint}</span>
      <button className="btn btn--primary" onClick={() => window.print()}>
        <Printer size={16} /> {t.print}
      </button>
    </div>
  )
}

function PreviewPane({
  resume,
  mode,
  selection,
  onSelect,
  setResume,
}: {
  resume: Resume
  mode: Mode
  selection: Selection
  onSelect: (s: Selection) => void
  setResume: (fn: (r: Resume) => Resume) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  const [zoomOverride, setZoomOverride] = useState<number | null>(null)
  const [pages, setPages] = useState(1)
  const zoom = zoomOverride ?? fit

  // Fit the A4 page to the available width
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const avail = el.clientWidth - 48
      setFit(Math.max(0.3, Math.min(1.25, avail / (A4_W * MM))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Count pages to draw page-break guides
  useLayoutEffect(() => {
    const el = page.current?.firstElementChild as HTMLElement | null
    if (!el) return
    const ro = new ResizeObserver(() => {
      const contentH = el.scrollHeight / MM - 2 * resume.theme.marginY
      const perPage = A4_H - 2 * resume.theme.marginY
      setPages(Math.max(1, Math.ceil((contentH - 0.5) / perPage)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [resume.theme.marginY])

  const perPage = A4_H - 2 * resume.theme.marginY

  return (
    <div className="preview" ref={scroller}>
      <div className="preview-toolbar">
        <button className="tb-btn" title="Dézoomer" onClick={() => setZoomOverride(Math.max(0.3, +(zoom - 0.1).toFixed(2)))}>
          <ZoomOut size={15} />
        </button>
        <button className="tb-btn zoom-label" title="Ajuster à la largeur" onClick={() => setZoomOverride(null)}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="tb-btn" title="Zoomer" onClick={() => setZoomOverride(Math.min(2, +(zoom + 0.1).toFixed(2)))}>
          <ZoomIn size={15} />
        </button>
        <span className="tb-sep" />
        <span className="page-count">
          {pages} page{pages > 1 ? 's' : ''}
        </span>
      </div>
      <div className="preview-stage" style={{ zoom }}>
        <div className="page-shell" ref={page} style={{ minHeight: `${pages * A4_H}mm` }}>
          <ResumeDocument resume={resume} mode={mode} selection={selection} onSelect={onSelect} />
          {mode === 'edit' && <LayoutOverlay shellRef={page} resume={resume} setResume={setResume} zoom={zoom} />}
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} className="page-break" style={{ top: `${resume.theme.marginY + (i + 1) * perPage}mm` }}>
              <span>Page {i + 2}</span>
            </div>
          ))}
        </div>
      </div>
      {mode === 'view' && <p className="preview-hint">{STRINGS[resume.meta.locale].clickHint}</p>}
    </div>
  )
}
