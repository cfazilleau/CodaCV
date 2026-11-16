import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Contact2, Eye, EyeOff, Gauge, Layers, List, ListTree, Palette, PenLine, Rows3, Sparkles, Tags, Text, Trash2, User } from 'lucide-react'
import type { FactItem, HighlightItem, LevelItem, LevelMeter, Profile, ReferenceItem, Resume, Section, SectionKind, Selection } from '../../types'
import { newFactItem, newHighlightItem, newLevelItem, newReferenceItem, newSection } from '../../utils'
import { sectionIcon } from '../ResumeDocument'
import { isInSidebar, removeSection, reorderSections } from '../../layout'
import { IconButton, Select, TextArea, TextField, Toggle } from './fields'
import { IconPicker } from './IconPicker'
import { SortableList } from './Sortable'
import { VersionsPanel } from './VersionsPanel'
import { Card } from './Card'
import { ListEditor, RecordListEditor, TimelineEditor, type ItemSel } from './ItemEditors'
import { PlacementFields } from './PlacementFields'
import { ProfileEditor } from './ProfileEditor'
import { ThemeEditor } from './ThemeEditor'
import { TAB_KEY, type ResumeStore } from '../../store'

interface Props {
  resume: Resume
  setResume: (fn: (r: Resume) => Resume) => void
  selection: Selection
  onSelect: (sel: Selection) => void
  store: ResumeStore
}

const MD_HINT = 'Markdown : **gras**, *italique*, [lien](https://…), listes, ![image](https://…)'

type SectionOf<K extends SectionKind> = Extract<Section, { kind: K }>

type Tab = 'content' | 'style' | 'versions'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'content', label: 'Contenu', icon: <PenLine size={15} /> },
  { id: 'style', label: 'Apparence', icon: <Palette size={15} /> },
  { id: 'versions', label: 'Versions', icon: <Layers size={15} /> },
]

function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return t === 'style' || t === 'versions' ? t : 'content'
  } catch {
    return 'content'
  }
}

export function Editor({ resume, setResume, selection, onSelect, store }: Props) {
  const [tab, setTab] = useState<Tab>(loadTab)
  const [openCard, setOpenCard] = useState<string | null>('profile')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const itemRefs = useRef(new Map<string, HTMLElement>())

  // Remembered once the tab has rendered: a tab that fails to render is not reopened on the next load
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab)
    } catch {
      /* per-browser convenience only */
    }
  }, [tab])

  /**
   * Tab buttons: Apparence clears the highlight on the page (the Contenu panel keeps its open
   * card / item); coming back to Contenu highlights that card / item on the page again.
   */
  const switchTab = (t: Tab) => {
    if (t === tab) return
    setTab(t)
    if (t !== 'content') onSelect(null)
    else if (openCard === 'profile') onSelect({ kind: 'profile' })
    else if (openCard) onSelect({ kind: 'section', sectionId: openCard, itemId: openItem ?? undefined })
  }

  // Follow clicks made on the resume preview
  useEffect(() => {
    if (!selection) return
    const card = selection.kind === 'profile' ? 'profile' : selection.sectionId
    const item = selection.kind === 'section' ? (selection.itemId ?? null) : null
    setTab('content')
    setOpenCard(card)
    setOpenItem(item)
    requestAnimationFrame(() => {
      const el = (item && itemRefs.current.get(item)) || cardRefs.current.get(card)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [selection])

  const toggleCard = (id: string) => {
    const next = openCard === id ? null : id
    setOpenCard(next)
    setOpenItem(null)
    if (next === 'profile') onSelect({ kind: 'profile' })
    else if (next) onSelect({ kind: 'section', sectionId: next })
    else onSelect(null)
  }

  const toggleItem = (sectionId: string, itemId: string) => {
    const next = openItem === itemId ? null : itemId
    setOpenItem(next)
    onSelect({ kind: 'section', sectionId, itemId: next ?? undefined })
  }

  const setProfile = (patch: Partial<Profile>) => setResume((r) => ({ ...r, profile: { ...r.profile, ...patch } }))

  const setSection = (id: string, fn: (s: Section) => Section) =>
    setResume((r) => ({ ...r, sections: r.sections.map((s) => (s.id === id ? fn(s) : s)) }))

  /** Update a section of a known kind (each card only shows the fields of its own kind) */
  const setSectionOf = <K extends SectionKind>(id: string, kind: K, fn: (s: SectionOf<K>) => SectionOf<K>) =>
    setSection(id, (x) => (x.kind === kind ? fn(x as SectionOf<K>) : x))

  const addSection = (kind: SectionKind | 'tags') => {
    const s = newSection(kind)
    // Key figures belong right under the header; everything else goes at the end
    setResume((r) => ({ ...r, sections: s.kind === 'highlights' ? [s, ...r.sections] : [...r.sections, s] }))
    setOpenCard(s.id)
    onSelect({ kind: 'section', sectionId: s.id })
    requestAnimationFrame(() => cardRefs.current.get(s.id)?.scrollIntoView({ behavior: 'smooth' }))
  }

  const itemSel = (sectionId: string): ItemSel => ({
    openItem,
    focusItem: (id) => openItem !== id && toggleItem(sectionId, id),
    registerItem,
  })

  const registerCard = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }
  const registerItem = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  return (
    <div className="editor">
      {/* Tabs pattern: one tab stop, arrow keys / Home / End move between tabs */}
      <div
        className="editor-tabs"
        role="tablist"
        aria-label="Panneaux"
        onKeyDown={(e) => {
          const i = TABS.findIndex((t) => t.id === tab)
          const next =
            e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
          if (next < 0) return
          e.preventDefault()
          switchTab(TABS[next].id)
          document.getElementById(`editor-tab-${TABS[next].id}`)?.focus()
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`editor-tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="editor-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => switchTab(t.id)}
          >
            {t.icon} {t.label}
            {t.id === 'versions' && <span className="tab-count">{store.versions.length}</span>}
          </button>
        ))}
      </div>

      <div className="editor-panel" role="tabpanel" id="editor-panel" aria-labelledby={`editor-tab-${tab}`}>
      {tab === 'versions' ? (
        <VersionsPanel
          versions={store.versions}
          activeId={store.activeId}
          onSwitch={(id) => {
            onSelect(null)
            setOpenCard('profile')
            setOpenItem(null)
            store.switchVersion(id)
          }}
          onCreate={(from) => store.createVersion(from)}
          onRename={store.renameVersion}
          onDelete={store.deleteVersion}
          onReorder={store.moveVersions}
        />
      ) : tab === 'style' ? (
        <ThemeEditor resume={resume} setResume={setResume} />
      ) : (
        <>
          <Card
            ref={registerCard('profile')}
            icon={<User size={16} />}
            title="Informations personnelles"
            open={openCard === 'profile'}
            selected={selection?.kind === 'profile'}
            onToggle={() => toggleCard('profile')}
          >
            <ProfileEditor profile={resume.profile} setProfile={setProfile} accent={resume.theme.accent} />
          </Card>

          <h2 className="editor-heading">
            Sections <span>{resume.sections.length}</span>
          </h2>
          <SortableList
            items={resume.sections}
            className="sortable-list--cards"
            // Layout-aware: the moved section becomes a row, the others keep their rows and columns
            onReorder={(_, moved) => setResume((r) => ({ ...r, sections: reorderSections(r.sections, moved.id, moved.to) }))}
          >
            {(s, handle) => (
              <Card
                handle={handle}
                ref={registerCard(s.id)}
                icon={kindIcon(s)}
                title={s.title || 'Sans titre'}
                muted={!s.visible}
                open={openCard === s.id}
                selected={selection?.kind === 'section' && selection.sectionId === s.id}
                onToggle={() => toggleCard(s.id)}
                actions={
                  <>
                    <IconButton
                      title={s.visible ? 'Masquer la section' : 'Afficher la section'}
                      onClick={() => setSection(s.id, (x) => ({ ...x, visible: !x.visible }))}
                    >
                      {s.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </IconButton>
                    <IconButton
                      title="Supprimer la section"
                      danger
                      onClick={() => {
                        if (confirm(`Supprimer la section « ${s.title} » ?`))
                          setResume((r) => ({ ...r, sections: removeSection(r.sections, s.id) }))
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </>
                }
              >
                {resume.theme.titleStyle === 'icon' ? (
                  <div className="field">
                    <span className="field-label">Titre de la section</span>
                    <div className="with-icon">
                      <IconPicker
                        value={sectionIcon(s)}
                        accent={resume.theme.accent}
                        onChange={(v) => setSection(s.id, (x) => ({ ...x, icon: v }))}
                      />
                      <TextField value={s.title} onChange={(v) => setSection(s.id, (x) => ({ ...x, title: v }))} />
                    </div>
                  </div>
                ) : (
                  <TextField label="Titre de la section" value={s.title} onChange={(v) => setSection(s.id, (x) => ({ ...x, title: v }))} />
                )}
                {!(resume.theme.headerStyle === 'sidebar' && isInSidebar(s)) && (
                  <PlacementFields sections={resume.sections} section={s} sidebarMode={resume.theme.headerStyle === 'sidebar'} setResume={setResume} />
                )}
                {resume.theme.headerStyle === 'sidebar' && (
                  <Toggle
                    label="Dans la barre latérale"
                    checked={isInSidebar(s)}
                    onChange={(v) => setSection(s.id, (x) => ({ ...x, sidebar: v }))}
                  />
                )}
                {s.kind === 'timeline' && (
                  <TimelineEditor
                    section={s}
                    update={(fn) => setSectionOf(s.id, 'timeline', fn)}
                    openItem={openItem}
                    toggleItem={(id) => toggleItem(s.id, id)}
                    registerItem={registerItem}
                  />
                )}
                {s.kind === 'list' && (
                  <ListEditor
                    section={s}
                    update={(fn) => setSectionOf(s.id, 'list', fn)}
                    openItem={openItem}
                    toggleItem={(id) => toggleItem(s.id, id)}
                    registerItem={registerItem}
                  />
                )}
                {s.kind === 'text' && (
                  <TextArea
                    label="Contenu"
                    hint={MD_HINT}
                    minRows={4}
                    value={s.text}
                    onChange={(v) => setSection(s.id, (x) => ({ ...x, text: v }))}
                  />
                )}
                {s.kind === 'levels' && (
                  <>
                    <Select<LevelMeter>
                      label="Indicateur"
                      value={s.meter}
                      options={[
                        { value: 'dots', label: 'Points' },
                        { value: 'bar', label: 'Barre' },
                        { value: 'none', label: 'Texte seul' },
                      ]}
                      onChange={(v) => setSectionOf(s.id, 'levels', (x) => ({ ...x, meter: v }))}
                      hint="Le niveau est toujours écrit en texte : les logiciels de recrutement ne lisent pas les points ni les barres."
                    />
                    <RecordListEditor<LevelItem>
                      items={s.items}
                      setItems={(fn) => setSectionOf(s.id, 'levels', (x) => ({ ...x, items: fn(x.items) }))}
                      columns="minmax(0, 1fr) 96px 64px"
                      fields={[
                        { key: 'name', label: 'Nom', placeholder: 'Anglais, C++…' },
                        { key: 'level', label: 'Niveau', placeholder: 'C1, Expert…' },
                        { key: 'rating', label: 'Note', type: 'rating' },
                      ]}
                      make={() => newLevelItem()}
                      addLabel="Ajouter un niveau"
                      sel={itemSel(s.id)}
                    />
                  </>
                )}
                {s.kind === 'facts' && (
                  <RecordListEditor<FactItem>
                    items={s.items}
                    setItems={(fn) => setSectionOf(s.id, 'facts', (x) => ({ ...x, items: fn(x.items) }))}
                    columns="minmax(0, 0.8fr) minmax(0, 1.2fr)"
                    fields={[
                      { key: 'key', label: 'Intitulé', placeholder: 'Permis, Disponibilité…' },
                      { key: 'value', label: 'Valeur', placeholder: 'B, immédiate… (facultatif)' },
                    ]}
                    make={() => newFactItem()}
                    addLabel="Ajouter une info"
                    sel={itemSel(s.id)}
                  />
                )}
                {s.kind === 'references' && (
                  <>
                    <Toggle
                      label="Une seule ligne « sur demande »"
                      checked={s.onRequest}
                      onChange={(v) => setSectionOf(s.id, 'references', (x) => ({ ...x, onRequest: v }))}
                    />
                    {s.onRequest ? (
                      <TextField
                        label="Texte"
                        value={s.onRequestText}
                        onChange={(v) => setSectionOf(s.id, 'references', (x) => ({ ...x, onRequestText: v }))}
                      />
                    ) : (
                      <RecordListEditor<ReferenceItem>
                        items={s.items}
                        setItems={(fn) => setSectionOf(s.id, 'references', (x) => ({ ...x, items: fn(x.items) }))}
                        columns="minmax(0, 1fr) minmax(0, 1fr)"
                        fields={[
                          { key: 'name', label: 'Nom', placeholder: 'Nom' },
                          { key: 'role', label: 'Poste', placeholder: 'Poste' },
                          { key: 'company', label: 'Entreprise', placeholder: 'Entreprise' },
                          { key: 'contact', label: 'Contact', placeholder: 'E-mail ou téléphone' },
                        ]}
                        make={() => newReferenceItem()}
                        addLabel="Ajouter une référence"
                        sel={itemSel(s.id)}
                      />
                    )}
                  </>
                )}
                {s.kind === 'highlights' && (
                  <RecordListEditor<HighlightItem>
                    items={s.items}
                    setItems={(fn) => setSectionOf(s.id, 'highlights', (x) => ({ ...x, items: fn(x.items) }))}
                    columns="88px minmax(0, 1fr)"
                    fields={[
                      { key: 'value', label: 'Chiffre', placeholder: '1 M+' },
                      { key: 'label', label: 'Libellé', placeholder: 'téléchargements' },
                    ]}
                    make={() => newHighlightItem()}
                    addLabel="Ajouter un chiffre"
                    max={4}
                    sel={itemSel(s.id)}
                  />
                )}
                <Toggle label="Masquer le titre" checked={!!s.hideTitle} onChange={(v) => setSection(s.id, (x) => ({ ...x, hideTitle: v }))} />
              </Card>
            )}
          </SortableList>

          <div className="add-section">
            <span>Ajouter une section</span>
            <div className="add-section-buttons">
              <button type="button" onClick={() => addSection('timeline')}>
                <ListTree size={15} /> Chronologie
              </button>
              <button type="button" onClick={() => addSection('list')}>
                <List size={15} /> Liste
              </button>
              <button type="button" onClick={() => addSection('tags')}>
                <Tags size={15} /> Tags
              </button>
              <button type="button" onClick={() => addSection('text')}>
                <Text size={15} /> Texte libre
              </button>
              <button type="button" onClick={() => addSection('levels')}>
                <Gauge size={15} /> Niveaux
              </button>
              <button type="button" onClick={() => addSection('facts')}>
                <Rows3 size={15} /> Infos clés
              </button>
              <button type="button" onClick={() => addSection('references')}>
                <Contact2 size={15} /> Références
              </button>
              <button type="button" onClick={() => addSection('highlights')}>
                <Sparkles size={15} /> Chiffres clés
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  )
}

/** Icon of a section card in the sidebar, by section type */
function kindIcon(s: Section): ReactNode {
  switch (s.kind) {
    case 'timeline':
      return <ListTree size={16} />
    case 'list':
      return s.display === 'inline' || s.display === 'chips' ? <Tags size={16} /> : <List size={16} />
    case 'levels':
      return <Gauge size={16} />
    case 'facts':
      return <Rows3 size={16} />
    case 'references':
      return <Contact2 size={16} />
    case 'highlights':
      return <Sparkles size={16} />
    default:
      return <Text size={16} />
  }
}
