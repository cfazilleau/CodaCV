import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Download, FileUp, Printer, Redo2, RotateCcw, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useResumeStore, parseResume } from './store'
import { defaultResume } from './defaultResume'
import type { Resume, Selection } from './types'
import { ResumeDocument } from './components/ResumeDocument'
import { LayoutOverlay } from './components/LayoutOverlay'
import { Editor } from './components/editor/Editor'
import { downloadText } from './utils'

const MM = 96 / 25.4 // CSS px per mm
const A4_W = 210
const A4_H = 297

/** Injects @page rules matching the theme margins and sets the PDF file name while printing. */
function usePrintSetup(resume: Resume) {
  useEffect(() => {
    let style = document.getElementById('print-page-style') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'print-page-style'
      document.head.appendChild(style)
    }
    const { marginX: mx, marginY: my, headerStyle } = resume.theme
    // Band / sidebar bleed to the paper edges: no side margins on the page (the resume pads
    // itself), and no top margin on the first page (the band / sidebar paints it).
    style.textContent =
      headerStyle === 'band'
        ? `@page { size: A4; margin: ${my}mm 0; } @page :first { margin-top: 0; }`
        : headerStyle === 'sidebar'
          ? `@page { size: A4; margin: ${my}mm 0; } @page :first { margin-top: 0; margin-bottom: 0; }`
          : `@page { size: A4; margin: ${my}mm ${mx}mm; }`
  }, [resume.theme.marginX, resume.theme.marginY, resume.theme.headerStyle])

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
  const [selection, setSelection] = useState<Selection>(null)

  usePrintSetup(resume)

  // Document language ends up as /Lang in the PDF (used by parsers and screen readers)
  useEffect(() => {
    document.documentElement.lang = resume.meta.locale
  }, [resume.meta.locale])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'p') {
        e.preventDefault()
        window.print()
      } else if (k === 'z' && !e.shiftKey) {
        if ((e.target as HTMLElement).closest('input, textarea')) return
        e.preventDefault()
        undo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        if ((e.target as HTMLElement).closest('input, textarea')) return
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const fileInput = useRef<HTMLInputElement>(null)
  const importJson = async (file: File) => {
    try {
      const r = parseResume(await file.text())
      // Imported files become a new version (named after the file), the current one is kept
      store.createVersion('copy', file.name.replace(/\.json$/i, ''), r)
      setSelection(null)
    } catch (e) {
      alert(`Import impossible : ${(e as Error).message}`)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">CV</span>
          <span>CodaCV</span>
          <span className="brand-version" title="Version active (onglet Versions)">
            {store.versions.find((v) => v.id === store.activeId)?.name}
          </span>
        </div>

        <div className="topbar-actions">
          <button className="tb-btn" title="Annuler (Ctrl+Z)" disabled={!store.canUndo} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button className="tb-btn" title="Rétablir (Ctrl+Y)" disabled={!store.canRedo} onClick={redo}>
            <Redo2 size={16} />
          </button>
          <span className="tb-sep" />
          <button className="tb-btn" title="Importer un fichier JSON (ajouté comme nouvelle version)" onClick={() => fileInput.current?.click()}>
            <FileUp size={16} /> <span className="tb-label">Importer</span>
          </button>
          <button
            className="tb-btn"
            title="Exporter la version active en JSON"
            onClick={() => downloadText(`${resume.meta.fileName || 'cv'}.json`, JSON.stringify(resume, null, 2))}
          >
            <Download size={16} /> <span className="tb-label">Exporter</span>
          </button>
          <button
            className="tb-btn"
            title="Réinitialiser la version active avec le modèle"
            onClick={() => {
              if (confirm('Remplacer toutes les données par le CV modèle ? (Annulable avec Ctrl+Z)')) setResume(structuredClone(defaultResume))
            }}
          >
            <RotateCcw size={16} />
          </button>
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

      <main className="workspace">
        <aside className="sidebar">
          <Editor resume={resume} setResume={setResume} selection={selection} onSelect={setSelection} store={store} />
        </aside>
        <PreviewPane resume={resume} setResume={setResume} selection={selection} onSelect={setSelection} />
      </main>
    </div>
  )
}

function PreviewPane({
  resume,
  selection,
  onSelect,
  setResume,
}: {
  resume: Resume
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
          <ResumeDocument resume={resume} selection={selection} onSelect={onSelect} />
          <LayoutOverlay shellRef={page} resume={resume} setResume={setResume} zoom={zoom} selection={selection} />
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} className="page-break" style={{ top: `${resume.theme.marginY + (i + 1) * perPage}mm` }}>
              <span>Page {i + 2}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
