import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Contact2, Eye, EyeOff, Gauge, Layers, List, ListTree, Palette, PenLine, Rows3, Sparkles, Tags, Text, Trash2, User } from 'lucide-react'
import type { FactItem, HighlightItem, LevelItem, LevelMeter, Profile, ReferenceItem, Resume, Section, SectionKind, Selection } from '../../types'
import { newFactItem, newHighlightItem, newLevelItem, newReferenceItem, newSection } from '../../utils'
import { contentLang } from '../../locale'
import { defineStrings, useStrings } from '../../i18n'
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

type SectionOf<K extends SectionKind> = Extract<Section, { kind: K }>

type Tab = 'content' | 'style' | 'versions'

const S = defineStrings(
  {
    mdHint: 'Markdown : **gras**, *italique*, [lien](https://…), listes, ![image](https://…)',
    tabs: { content: 'Contenu', style: 'Apparence', versions: 'Versions' } as Record<Tab, string>,
    panels: 'Panneaux',
    profile: 'Informations personnelles',
    sections: 'Sections',
    untitled: 'Sans titre',
    hideSection: 'Masquer la section',
    showSection: 'Afficher la section',
    deleteSection: 'Supprimer la section',
    confirmDelete: (title: string) => `Supprimer la section « ${title} » ?`,
    sectionTitle: 'Titre de la section',
    inSidebar: 'Dans la barre latérale',
    content: 'Contenu',
    meter: 'Indicateur',
    meterDots: 'Points',
    meterBar: 'Barre',
    meterNone: 'Texte seul',
    meterHint: 'Le niveau est toujours écrit en texte : les logiciels de recrutement ne lisent pas les points ni les barres.',
    levelName: 'Nom',
    levelNamePh: 'Anglais, C++…',
    level: 'Niveau',
    levelPh: 'C1, Expert…',
    rating: 'Note',
    addLevel: 'Ajouter un niveau',
    factKey: 'Intitulé',
    factKeyPh: 'Permis, Disponibilité…',
    factValue: 'Valeur',
    factValuePh: 'B, immédiate… (facultatif)',
    addFact: 'Ajouter une info',
    onRequest: 'Une seule ligne « sur demande »',
    onRequestText: 'Texte',
    refName: 'Nom',
    refRole: 'Poste',
    refCompany: 'Entreprise',
    refContact: 'Contact',
    refContactPh: 'E-mail ou téléphone',
    addReference: 'Ajouter une référence',
    figure: 'Chiffre',
    figurePh: '1 M+',
    figureLabel: 'Libellé',
    figureLabelPh: 'téléchargements',
    addFigure: 'Ajouter un chiffre',
    hideTitle: 'Masquer le titre',
    addSection: 'Ajouter une section',
    kinds: {
      timeline: 'Chronologie',
      list: 'Liste',
      tags: 'Tags',
      text: 'Texte libre',
      levels: 'Niveaux',
      facts: 'Infos clés',
      references: 'Références',
      highlights: 'Chiffres clés',
    } as Record<SectionKind | 'tags', string>,
  },
  {
    mdHint: 'Markdown: **bold**, *italic*, [link](https://…), lists, ![image](https://…)',
    tabs: { content: 'Content', style: 'Design', versions: 'Versions' },
    panels: 'Panels',
    profile: 'Personal details',
    sections: 'Sections',
    untitled: 'Untitled',
    hideSection: 'Hide the section',
    showSection: 'Show the section',
    deleteSection: 'Delete the section',
    confirmDelete: (title) => `Delete the section “${title}”?`,
    sectionTitle: 'Section title',
    inSidebar: 'In the sidebar',
    content: 'Content',
    meter: 'Indicator',
    meterDots: 'Dots',
    meterBar: 'Bar',
    meterNone: 'Text only',
    meterHint: 'The level is always written as text: applicant tracking systems don’t read dots or bars.',
    levelName: 'Name',
    levelNamePh: 'English, C++…',
    level: 'Level',
    levelPh: 'C1, Expert…',
    rating: 'Rating',
    addLevel: 'Add a level',
    factKey: 'Label',
    factKeyPh: 'Driving licence, Availability…',
    factValue: 'Value',
    factValuePh: 'B, immediate… (optional)',
    addFact: 'Add an item',
    onRequest: 'Single “available on request” line',
    onRequestText: 'Text',
    refName: 'Name',
    refRole: 'Position',
    refCompany: 'Company',
    refContact: 'Contact',
    refContactPh: 'Email or phone',
    addReference: 'Add a reference',
    figure: 'Figure',
    figurePh: '1M+',
    figureLabel: 'Label',
    figureLabelPh: 'downloads',
    addFigure: 'Add a figure',
    hideTitle: 'Hide the title',
    addSection: 'Add a section',
    kinds: {
      timeline: 'Timeline',
      list: 'List',
      tags: 'Tags',
      text: 'Free text',
      levels: 'Levels',
      facts: 'Key facts',
      references: 'References',
      highlights: 'Key figures',
    },
  },
)

const TABS: { id: Tab; icon: ReactNode }[] = [
  { id: 'content', icon: <PenLine size={15} /> },
  { id: 'style', icon: <Palette size={15} /> },
  { id: 'versions', icon: <Layers size={15} /> },
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
  const t = useStrings(S)
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
  const switchTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    if (next !== 'content') onSelect(null)
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
    const s = newSection(kind, contentLang(resume.meta.locale))
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
        aria-label={t.panels}
        onKeyDown={(e) => {
          const i = TABS.findIndex((x) => x.id === tab)
          const next =
            e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
          if (next < 0) return
          e.preventDefault()
          switchTab(TABS[next].id)
          document.getElementById(`editor-tab-${TABS[next].id}`)?.focus()
        }}
      >
        {TABS.map((x) => (
          <button
            key={x.id}
            id={`editor-tab-${x.id}`}
            role="tab"
            aria-selected={tab === x.id}
            aria-controls="editor-panel"
            tabIndex={tab === x.id ? 0 : -1}
            className={tab === x.id ? 'is-active' : ''}
            onClick={() => switchTab(x.id)}
          >
            {x.icon} {t.tabs[x.id]}
            {x.id === 'versions' && <span className="tab-count">{store.versions.length}</span>}
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
            title={t.profile}
            open={openCard === 'profile'}
            selected={selection?.kind === 'profile'}
            onToggle={() => toggleCard('profile')}
          >
            <ProfileEditor profile={resume.profile} setProfile={setProfile} accent={resume.theme.accent} />
          </Card>

          <h2 className="editor-heading">
            {t.sections} <span>{resume.sections.length}</span>
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
                title={s.title || t.untitled}
                muted={!s.visible}
                open={openCard === s.id}
                selected={selection?.kind === 'section' && selection.sectionId === s.id}
                onToggle={() => toggleCard(s.id)}
                actions={
                  <>
                    <IconButton
                      title={s.visible ? t.hideSection : t.showSection}
                      onClick={() => setSection(s.id, (x) => ({ ...x, visible: !x.visible }))}
                    >
                      {s.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </IconButton>
                    <IconButton
                      title={t.deleteSection}
                      danger
                      onClick={() => {
                        if (confirm(t.confirmDelete(s.title)))
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
                    <span className="field-label">{t.sectionTitle}</span>
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
                  <TextField label={t.sectionTitle} value={s.title} onChange={(v) => setSection(s.id, (x) => ({ ...x, title: v }))} />
                )}
                {!(resume.theme.headerStyle === 'sidebar' && isInSidebar(s)) && (
                  <PlacementFields sections={resume.sections} section={s} sidebarMode={resume.theme.headerStyle === 'sidebar'} setResume={setResume} />
                )}
                {resume.theme.headerStyle === 'sidebar' && (
                  <Toggle
                    label={t.inSidebar}
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
                    locale={resume.meta.locale}
                    dateFormat={resume.theme.dateFormat}
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
                    label={t.content}
                    hint={t.mdHint}
                    minRows={4}
                    value={s.text}
                    onChange={(v) => setSection(s.id, (x) => ({ ...x, text: v }))}
                  />
                )}
                {s.kind === 'levels' && (
                  <>
                    <Select<LevelMeter>
                      label={t.meter}
                      value={s.meter}
                      options={[
                        { value: 'dots', label: t.meterDots },
                        { value: 'bar', label: t.meterBar },
                        { value: 'none', label: t.meterNone },
                      ]}
                      onChange={(v) => setSectionOf(s.id, 'levels', (x) => ({ ...x, meter: v }))}
                      hint={t.meterHint}
                    />
                    <RecordListEditor<LevelItem>
                      items={s.items}
                      setItems={(fn) => setSectionOf(s.id, 'levels', (x) => ({ ...x, items: fn(x.items) }))}
                      columns="minmax(0, 1fr) 96px 64px"
                      fields={[
                        { key: 'name', label: t.levelName, placeholder: t.levelNamePh },
                        { key: 'level', label: t.level, placeholder: t.levelPh },
                        { key: 'rating', label: t.rating, type: 'rating' },
                      ]}
                      make={() => newLevelItem()}
                      addLabel={t.addLevel}
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
                      { key: 'key', label: t.factKey, placeholder: t.factKeyPh },
                      { key: 'value', label: t.factValue, placeholder: t.factValuePh },
                    ]}
                    make={() => newFactItem()}
                    addLabel={t.addFact}
                    sel={itemSel(s.id)}
                  />
                )}
                {s.kind === 'references' && (
                  <>
                    <Toggle
                      label={t.onRequest}
                      checked={s.onRequest}
                      onChange={(v) => setSectionOf(s.id, 'references', (x) => ({ ...x, onRequest: v }))}
                    />
                    {s.onRequest ? (
                      <TextField
                        label={t.onRequestText}
                        value={s.onRequestText}
                        onChange={(v) => setSectionOf(s.id, 'references', (x) => ({ ...x, onRequestText: v }))}
                      />
                    ) : (
                      <RecordListEditor<ReferenceItem>
                        items={s.items}
                        setItems={(fn) => setSectionOf(s.id, 'references', (x) => ({ ...x, items: fn(x.items) }))}
                        columns="minmax(0, 1fr) minmax(0, 1fr)"
                        fields={[
                          { key: 'name', label: t.refName, placeholder: t.refName },
                          { key: 'role', label: t.refRole, placeholder: t.refRole },
                          { key: 'company', label: t.refCompany, placeholder: t.refCompany },
                          { key: 'contact', label: t.refContact, placeholder: t.refContactPh },
                        ]}
                        make={() => newReferenceItem(contentLang(resume.meta.locale))}
                        addLabel={t.addReference}
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
                      { key: 'value', label: t.figure, placeholder: t.figurePh },
                      { key: 'label', label: t.figureLabel, placeholder: t.figureLabelPh },
                    ]}
                    make={() => newHighlightItem()}
                    addLabel={t.addFigure}
                    max={4}
                    sel={itemSel(s.id)}
                  />
                )}
                <Toggle label={t.hideTitle} checked={!!s.hideTitle} onChange={(v) => setSection(s.id, (x) => ({ ...x, hideTitle: v }))} />
              </Card>
            )}
          </SortableList>

          <div className="add-section">
            <span>{t.addSection}</span>
            <div className="add-section-buttons">
              <button type="button" onClick={() => addSection('timeline')}>
                <ListTree size={15} /> {t.kinds.timeline}
              </button>
              <button type="button" onClick={() => addSection('list')}>
                <List size={15} /> {t.kinds.list}
              </button>
              <button type="button" onClick={() => addSection('tags')}>
                <Tags size={15} /> {t.kinds.tags}
              </button>
              <button type="button" onClick={() => addSection('text')}>
                <Text size={15} /> {t.kinds.text}
              </button>
              <button type="button" onClick={() => addSection('levels')}>
                <Gauge size={15} /> {t.kinds.levels}
              </button>
              <button type="button" onClick={() => addSection('facts')}>
                <Rows3 size={15} /> {t.kinds.facts}
              </button>
              <button type="button" onClick={() => addSection('references')}>
                <Contact2 size={15} /> {t.kinds.references}
              </button>
              <button type="button" onClick={() => addSection('highlights')}>
                <Sparkles size={15} /> {t.kinds.highlights}
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
