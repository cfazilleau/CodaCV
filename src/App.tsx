import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Download, FileUp, Info, Printer, Redo2, RotateCcw, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useResumeStore, parseResume } from './store'
import { MAX_IMPORT_BYTES } from './validate'
import { templateResume } from './defaultResume'
import { defineStrings, setUiLang, strings, UI_LANGS, useStrings, useUiLang } from './i18n'
import type { Resume, Selection } from './types'
import { ResumeDocument } from './components/ResumeDocument'
import { LayoutOverlay } from './components/LayoutOverlay'
import { Editor } from './components/editor/Editor'
import { StorageBanner } from './components/StorageBanner'
import { WelcomeDialog, welcomeSeen } from './components/WelcomeDialog'
import { downloadText, downscaleImage, PHOTO_MAX_CHARS } from './utils'
import { A4_H_MM, A4_W_MM, MM } from './layout'

const S = defineStrings(
  {
    tooBig: (mb: number) => `fichier trop volumineux (${mb} Mo maximum)`,
    importFailed: (msg: string) => `Import impossible : ${msg}`,
    activeVersion: 'Version active (onglet Versions)',
    undo: 'Annuler (Ctrl+Z)',
    redo: 'Rétablir (Ctrl+Y)',
    importTitle: 'Importer un fichier JSON (ajouté comme nouvelle version)',
    import: 'Importer',
    exportTitle: 'Exporter la version active en JSON',
    export: 'Exporter',
    resetTitle: 'Réinitialiser la version active avec le modèle',
    resetConfirm: 'Remplacer toutes les données par le CV modèle ? (Annulable avec Ctrl+Z)',
    print: 'Imprimer ou enregistrer en PDF (Ctrl+P)',
    uiLang: "Langue de l'interface",
    about: 'À propos de CodaCV : gratuit, open source, vos données restent chez vous',
    zoomOut: 'Dézoomer',
    fit: 'Ajuster à la largeur',
    zoomIn: 'Zoomer',
    pages: (n: number) => (n > 1 ? `${n} pages` : `${n} page`),
    page: (n: number) => `Page ${n}`,
  },
  {
    tooBig: (mb) => `file too large (${mb} MB maximum)`,
    importFailed: (msg) => `Import failed: ${msg}`,
    activeVersion: 'Active version (Versions tab)',
    undo: 'Undo (Ctrl+Z)',
    redo: 'Redo (Ctrl+Y)',
    importTitle: 'Import a JSON file (added as a new version)',
    import: 'Import',
    exportTitle: 'Export the active version as JSON',
    export: 'Export',
    resetTitle: 'Reset the active version to the template',
    resetConfirm: 'Replace all the data with the template resume? (Ctrl+Z to undo)',
    print: 'Print or save as PDF (Ctrl+P)',
    uiLang: 'Interface language',
    about: 'About CodaCV: free, open source, your data stays with you',
    zoomOut: 'Zoom out',
    fit: 'Fit to width',
    zoomIn: 'Zoom in',
    pages: (n) => (n === 1 ? '1 page' : `${n} pages`),
    page: (n) => `Page ${n}`,
  },
)


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
  const t = useStrings(S)
  const uiLang = useUiLang()
  // Welcome screen: on the first visit, then from the info button
  const [welcome, setWelcome] = useState(() => !welcomeSeen())

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
      if (file.size > MAX_IMPORT_BYTES) throw new Error(strings(S).tooBig(MAX_IMPORT_BYTES / 1e6))
      let r = parseResume(await file.text())
      // A photo from another tool can weigh megabytes: shrink it like an uploaded one
      if (r.profile.photo.startsWith('data:image/') && r.profile.photo.length > PHOTO_MAX_CHARS) {
        const photo = await downscaleImage(r.profile.photo).catch(() => '')
        r = { ...r, profile: { ...r.profile, photo } }
      }
      // Imported files become a new version (named after the file), the current one is kept
      store.createVersion('copy', file.name.replace(/\.json$/i, ''), r)
      setSelection(null)
    } catch (e) {
      alert(strings(S).importFailed((e as Error).message))
    }
  }

  return (
    <div className="app" lang={uiLang}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">CV</span>
          <span>CodaCV</span>
          <span className="brand-version" title={t.activeVersion}>
            {store.versions.find((v) => v.id === store.activeId)?.name}
          </span>
        </div>

        <div className="topbar-actions">
          <button className="tb-btn" title={t.undo} disabled={!store.canUndo} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button className="tb-btn" title={t.redo} disabled={!store.canRedo} onClick={redo}>
            <Redo2 size={16} />
          </button>
          <span className="tb-sep" />
          <button className="tb-btn" title={t.importTitle} onClick={() => fileInput.current?.click()}>
            <FileUp size={16} /> <span className="tb-label">{t.import}</span>
          </button>
          <button
            className="tb-btn"
            title={t.exportTitle}
            onClick={() => downloadText(`${resume.meta.fileName || 'cv'}.json`, JSON.stringify(resume, null, 2))}
          >
            <Download size={16} /> <span className="tb-label">{t.export}</span>
          </button>
          <button
            className="tb-btn"
            title={t.resetTitle}
            onClick={() => {
              if (confirm(t.resetConfirm)) setResume(templateResume())
            }}
          >
            <RotateCcw size={16} />
          </button>
          <select
            className="tb-lang"
            aria-label={t.uiLang}
            title={t.uiLang}
            value={uiLang}
            onChange={(e) => setUiLang(e.target.value as typeof uiLang)}
          >
            {UI_LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.value.toUpperCase()} · {l.label}
              </option>
            ))}
          </select>
          <button className="tb-btn" title={t.about} aria-label={t.about} onClick={() => setWelcome(true)}>
            <Info size={16} />
          </button>
          <button className="btn btn--primary" onClick={() => window.print()} title={t.print}>
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

      <WelcomeDialog open={welcome} onClose={() => setWelcome(false)} />

      <StorageBanner issue={store.storageIssue} onOverwrite={store.overwriteStorage} onDismiss={store.dismissIssue} />

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
  const t = useStrings(S)
  const zoom = zoomOverride ?? fit

  // Fit the A4 page to the available width
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const avail = el.clientWidth - 48
      setFit(Math.max(0.3, Math.min(1.25, avail / (A4_W_MM * MM))))
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
      const perPage = A4_H_MM - 2 * resume.theme.marginY
      setPages(Math.max(1, Math.ceil((contentH - 0.5) / perPage)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [resume.theme.marginY])

  const perPage = A4_H_MM - 2 * resume.theme.marginY

  return (
    <div className="preview" ref={scroller}>
      <div className="preview-toolbar">
        <button className="tb-btn" title={t.zoomOut} onClick={() => setZoomOverride(Math.max(0.3, +(zoom - 0.1).toFixed(2)))}>
          <ZoomOut size={15} />
        </button>
        <button className="tb-btn zoom-label" title={t.fit} onClick={() => setZoomOverride(null)}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="tb-btn" title={t.zoomIn} onClick={() => setZoomOverride(Math.min(2, +(zoom + 0.1).toFixed(2)))}>
          <ZoomIn size={15} />
        </button>
        <span className="tb-sep" />
        <span className="page-count">
          {t.pages(pages)}
        </span>
      </div>
      <div className="preview-stage" style={{ zoom }}>
        <div className="page-shell" ref={page} style={{ minHeight: `${pages * A4_H_MM}mm` }}>
          <ResumeDocument resume={resume} selection={selection} onSelect={onSelect} />
          <LayoutOverlay shellRef={page} resume={resume} setResume={setResume} zoom={zoom} selection={selection} />
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} className="page-break" style={{ top: `${resume.theme.marginY + (i + 1) * perPage}mm` }}>
              <span>{t.page(i + 2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
