import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from 'react'
import {
  ChevronRight,
  Columns2,
  Contact2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  LayoutTemplate,
  List,
  ListTree,
  Palette,
  PenLine,
  Plus,
  Rows3,
  Sparkles,
  Tags,
  Text,
  Trash2,
  Type,
  User,
} from 'lucide-react'
import type {
  Contact,
  FactItem,
  FactSection,
  HighlightItem,
  HighlightSection,
  LevelItem,
  LevelMeter,
  LevelSection,
  EntryStyle,
  HeaderStyle,
  ListItem,
  ListDisplay,
  ListSection,
  Profile,
  ReferenceItem,
  ReferenceSection,
  Resume,
  Section,
  SectionKind,
  Selection,
  TimelineEntry,
  TimelineSection,
  TitleStyle,
} from '../../types'
import { newEntry, newFactItem, newHighlightItem, newLevelItem, newListItem, newReferenceItem, newSection, readImageFile, uid } from '../../utils'
import { FONT_FAMILIES, sectionIcon } from '../ResumeDocument'
import { isInSidebar, removeSection, reorderSections } from '../../layout'
import { COUNTRIES, ColorField, IconButton, LinesField, Select, Slider, TextArea, TextField, Toggle } from './fields'
import { IconPicker } from './IconPicker'
import { SortableList } from './Sortable'
import { VersionsPanel } from './VersionsPanel'
import { TAB_KEY, type ResumeStore } from '../../store'

interface Props {
  resume: Resume
  setResume: (fn: (r: Resume) => Resume) => void
  selection: Selection
  onSelect: (sel: Selection) => void
  store: ResumeStore
}

const MD_HINT = 'Markdown : **gras**, *italique*, [lien](https://…), listes, ![image](https://…)'

type Tab = 'content' | 'style' | 'versions'

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
      <div className="editor-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'content'}
          className={tab === 'content' ? 'is-active' : ''}
          onClick={() => switchTab('content')}
        >
          <PenLine size={15} /> Contenu
        </button>
        <button role="tab" aria-selected={tab === 'style'} className={tab === 'style' ? 'is-active' : ''} onClick={() => switchTab('style')}>
          <Palette size={15} /> Apparence
        </button>
        <button
          role="tab"
          aria-selected={tab === 'versions'}
          className={tab === 'versions' ? 'is-active' : ''}
          onClick={() => switchTab('versions')}
        >
          <Layers size={15} /> Versions <span className="tab-count">{store.versions.length}</span>
        </button>
      </div>

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
                    update={(fn) => setSection(s.id, (x) => fn(x as TimelineSection))}
                    openItem={openItem}
                    toggleItem={(id) => toggleItem(s.id, id)}
                    registerItem={registerItem}
                  />
                )}
                {s.kind === 'list' && (
                  <ListEditor
                    section={s}
                    update={(fn) => setSection(s.id, (x) => fn(x as ListSection))}
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
                      onChange={(v) => setSection(s.id, (x) => ({ ...(x as LevelSection), meter: v }))}
                      hint="Le niveau est toujours écrit en texte : les logiciels de recrutement ne lisent pas les points ni les barres."
                    />
                    <RecordListEditor<LevelItem>
                      items={s.items}
                      setItems={(fn) => setSection(s.id, (x) => ({ ...(x as LevelSection), items: fn((x as LevelSection).items) }))}
                      columns="minmax(0, 1fr) 96px 64px"
                      fields={[
                        { key: 'name', placeholder: 'Anglais, C++…' },
                        { key: 'level', placeholder: 'C1, Expert…' },
                        { key: 'rating', type: 'rating' },
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
                    setItems={(fn) => setSection(s.id, (x) => ({ ...(x as FactSection), items: fn((x as FactSection).items) }))}
                    columns="minmax(0, 0.8fr) minmax(0, 1.2fr)"
                    fields={[
                      { key: 'key', placeholder: 'Permis, Disponibilité…' },
                      { key: 'value', placeholder: 'B, immédiate… (facultatif)' },
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
                      onChange={(v) => setSection(s.id, (x) => ({ ...(x as ReferenceSection), onRequest: v }))}
                    />
                    {s.onRequest ? (
                      <TextField
                        label="Texte"
                        value={s.onRequestText}
                        onChange={(v) => setSection(s.id, (x) => ({ ...(x as ReferenceSection), onRequestText: v }))}
                      />
                    ) : (
                      <RecordListEditor<ReferenceItem>
                        items={s.items}
                        setItems={(fn) =>
                          setSection(s.id, (x) => ({ ...(x as ReferenceSection), items: fn((x as ReferenceSection).items) }))
                        }
                        columns="minmax(0, 1fr) minmax(0, 1fr)"
                        fields={[
                          { key: 'name', placeholder: 'Nom' },
                          { key: 'role', placeholder: 'Poste' },
                          { key: 'company', placeholder: 'Entreprise' },
                          { key: 'contact', placeholder: 'E-mail ou téléphone' },
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
                    setItems={(fn) => setSection(s.id, (x) => ({ ...(x as HighlightSection), items: fn((x as HighlightSection).items) }))}
                    columns="88px minmax(0, 1fr)"
                    fields={[
                      { key: 'value', placeholder: '1 M+' },
                      { key: 'label', placeholder: 'téléchargements' },
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

/* ---------------------------------------------------------------- Simple item lists */

interface ItemSel {
  openItem: string | null
  /** Select the item (highlight on the page) when one of its fields gets focus */
  focusItem: (id: string) => void
  registerItem: (id: string) => (el: HTMLElement | null) => void
}

interface RecordField<T> {
  key: keyof T & string
  placeholder?: string
  type?: 'text' | 'rating'
}

/** Editor for sections whose items are a few short fields (levels, facts, references, highlights). */
function RecordListEditor<T extends { id: string; hidden: boolean }>({
  items,
  setItems,
  fields,
  columns,
  make,
  addLabel,
  max,
  sel,
}: {
  items: T[]
  setItems: (fn: (items: T[]) => T[]) => void
  fields: RecordField<T>[]
  columns: string
  make: () => T
  addLabel: string
  max?: number
  sel: ItemSel
}) {
  const patch = (id: string, p: Partial<T>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <div className="items">
      <SortableList items={items} onReorder={(next) => setItems(() => next)}>
        {(it, handle) => (
          <div
            ref={sel.registerItem(it.id)}
            className={`item item--record${sel.openItem === it.id ? ' is-open' : ''}${it.hidden ? ' is-muted' : ''}`}
          >
            <div className="item-head">
              {handle}
              <div className="record-grid" style={{ gridTemplateColumns: columns }}>
                {fields.map((f) =>
                  f.type === 'rating' ? (
                    <select
                      key={f.key}
                      className="item-input"
                      title="Note (dessine les points / la barre)"
                      value={Number(it[f.key])}
                      onFocus={() => sel.focusItem(it.id)}
                      onChange={(e) => patch(it.id, { [f.key]: Number(e.target.value) } as Partial<T>)}
                    >
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? '—' : `${n} / 5`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={f.key}
                      className="item-input"
                      placeholder={f.placeholder}
                      value={String(it[f.key] ?? '')}
                      onFocus={() => sel.focusItem(it.id)}
                      onChange={(e) => patch(it.id, { [f.key]: e.target.value } as Partial<T>)}
                    />
                  ),
                )}
              </div>
              <div className="row-actions">
                <IconButton title={it.hidden ? 'Afficher' : 'Masquer'} onClick={() => patch(it.id, { hidden: !it.hidden } as Partial<T>)}>
                  {it.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </IconButton>
                <IconButton title="Supprimer" danger onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          </div>
        )}
      </SortableList>
      {(!max || items.length < max) && (
        <button type="button" className="btn btn--small btn--ghost" onClick={() => setItems((xs) => [...xs, make()])}>
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Card */

interface CardProps {
  icon: ReactNode
  title: string
  open: boolean
  selected?: boolean
  muted?: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
  ref?: (el: HTMLElement | null) => void
  /** Drag grip, for cards that can be reordered */
  handle?: ReactNode
}

function Card({ icon, title, open, selected, muted, onToggle, actions, children, ref, handle }: CardProps) {
  return (
    <section
      ref={ref}
      className={`card${open ? ' is-open' : ''}${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}${handle ? ' has-handle' : ''}`}
    >
      <header className="card-head">
        {handle}
        {/* A real button: the card opens with Enter / Space too */}
        <h3>
          <button type="button" className="card-toggle" aria-expanded={open} onClick={onToggle}>
            <ChevronRight size={16} className="card-chevron" />
            <span className="card-icon">{icon}</span>
            <span className="card-title">{title}</span>
          </button>
        </h3>
        <div className="card-actions">{actions}</div>
      </header>
      {open && <div className="card-body">{children}</div>}
    </section>
  )
}

/* ---------------------------------------------------------------- Profile */

function ProfileEditor({ profile, setProfile, accent }: { profile: Profile; setProfile: (p: Partial<Profile>) => void; accent: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const setContacts = (fn: (c: Contact[]) => Contact[]) => setProfile({ contacts: fn(profile.contacts) })

  return (
    <>
      <div className="photo-row">
        <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()} title="Changer la photo">
          {profile.photo ? <img src={profile.photo} alt="" /> : <ImagePlus size={22} />}
        </button>
        <div className="photo-actions">
          <button type="button" className="btn btn--small" onClick={() => fileRef.current?.click()}>
            {profile.photo ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {profile.photo && (
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setProfile({ photo: '' })}>
              Retirer
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) setProfile({ photo: await readImageFile(file) })
            e.target.value = ''
          }}
        />
      </div>

      <div className="grid-2">
        <TextField label="Nom complet" value={profile.name} onChange={(v) => setProfile({ name: v })} />
        <TextField label="Intitulé du poste" value={profile.title} onChange={(v) => setProfile({ title: v })} />
      </div>
      <div className="field">
        <span className="field-label">Accroche</span>
        <div className="with-icon">
          <IconPicker value={profile.summaryIcon} accent={accent} onChange={(v) => setProfile({ summaryIcon: v })} />
          <TextArea value={profile.summary} onChange={(v) => setProfile({ summary: v })} />
        </div>
      </div>

      <div className="subhead">Contacts</div>
      <div className="contacts-editor">
        <SortableList items={profile.contacts} onReorder={(contacts) => setProfile({ contacts })}>
          {(c, handle) => (
            <div className="contact-row">
              {handle}
              <IconPicker
                value={c.icon}
                accent={accent}
                onChange={(v) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, icon: v } : x)))}
              />
              <input
                placeholder="Texte affiché"
                value={c.label}
                onChange={(e) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))}
              />
              <input
                placeholder="Lien (auto pour e-mail / tél.)"
                title="Laisser vide pour un e-mail ou un numéro : le lien mailto: / tel: est créé automatiquement"
                value={c.url}
                onChange={(e) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, url: e.target.value } : x)))}
              />
              <div className="row-actions">
                <IconButton title="Supprimer" danger onClick={() => setContacts((cs) => cs.filter((x) => x.id !== c.id))}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          )}
        </SortableList>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => setContacts((cs) => [...cs, { id: uid(), icon: 'link', label: '', url: '' }])}
        >
          <Plus size={14} /> Ajouter un contact
        </button>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- Timeline */

interface ItemEditorProps<S> {
  section: S
  update: (fn: (s: S) => S) => void
  openItem: string | null
  toggleItem: (id: string) => void
  registerItem: (id: string) => (el: HTMLElement | null) => void
}

function TimelineEditor({ section, update, openItem, toggleItem, registerItem }: ItemEditorProps<TimelineSection>) {
  const setEntries = (fn: (e: TimelineEntry[]) => TimelineEntry[]) => update((s) => ({ ...s, entries: fn(s.entries) }))
  const patch = (id: string, p: Partial<TimelineEntry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)))

  return (
    <div className="items">
      <SortableList items={section.entries} onReorder={(entries) => update((s) => ({ ...s, entries }))}>
        {(e, handle, i) => {
          const open = openItem === e.id
          return (
            <div ref={registerItem(e.id)} className={`item${open ? ' is-open' : ''}${e.hidden ? ' is-muted' : ''}`}>
              <div className="item-head">
                {handle}
                <button type="button" className="item-toggle" aria-expanded={open} onClick={() => toggleItem(e.id)}>
                  <ChevronRight size={14} className="card-chevron" />
                  <span className="item-title">
                    <strong>{e.title || 'Sans titre'}</strong>
                    <span>{[e.subtitle, e.date].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                <div className="row-actions">
                  <IconButton title={e.hidden ? 'Afficher' : 'Masquer'} onClick={() => patch(e.id, { hidden: !e.hidden })}>
                    {e.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                  <IconButton
                    title="Dupliquer"
                    onClick={() => setEntries((es) => [...es.slice(0, i + 1), { ...structuredClone(e), id: uid() }, ...es.slice(i + 1)])}
                  >
                    <Copy size={14} />
                  </IconButton>
                  <IconButton
                    title="Supprimer"
                    danger
                    onClick={() => confirm(`Supprimer « ${e.title} » ?`) && setEntries((es) => es.filter((x) => x.id !== e.id))}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
              {open && (
                <div className="item-body">
                  <div className="grid-2">
                    <TextField label="Titre (gras)" value={e.title} onChange={(v) => patch(e.id, { title: v })} />
                    <TextField label="Sous-titre (italique)" value={e.subtitle} onChange={(v) => patch(e.id, { subtitle: v })} />
                    <TextField label="Date" placeholder="2022 – 2024" value={e.date} onChange={(v) => patch(e.id, { date: v })} />
                    <TextField label="Sous la date" placeholder="6 mois" value={e.subDate} onChange={(v) => patch(e.id, { subDate: v })} />
                    <Select label="Drapeau" value={e.country} options={COUNTRIES} onChange={(v) => patch(e.id, { country: v })} />
                    <TextField label="Ville" value={e.location} onChange={(v) => patch(e.id, { location: v })} />
                  </div>
                  <TextField label="Lien" placeholder="https://…" value={e.url} onChange={(v) => patch(e.id, { url: v })} />
                  <LinesField
                    label="Puces (une par ligne)"
                    hint="Markdown en ligne accepté : **gras**, *italique*, [lien](https://…)"
                    value={e.bullets}
                    onChange={(v) => patch(e.id, { bullets: v })}
                  />
                </div>
              )}
            </div>
          )
        }}
      </SortableList>
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() => {
          const e = newEntry()
          setEntries((es) => [...es, e])
          toggleItem(e.id)
        }}
      >
        <Plus size={14} /> Ajouter une entrée
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- List */

function ListEditor({ section, update, openItem, toggleItem, registerItem }: ItemEditorProps<ListSection>) {
  const setItems = (fn: (e: ListItem[]) => ListItem[]) => update((s) => ({ ...s, items: fn(s.items) }))
  const patch = (id: string, p: Partial<ListItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const display = section.display ?? 'bullets'

  // Pasting "C++, Unity, Git" (or several lines) into an item splits it into several items
  const pasteSplit = (it: ListItem) => (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    const parts = text
      .split(/[,;\n\t]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length < 2) return
    e.preventDefault()
    const input = e.currentTarget
    const len = input.value.length
    // Pasting at the end of an item that already has text: every part becomes a new item after it
    if (input.value.trim() && (input.selectionStart ?? len) === len && (input.selectionEnd ?? len) === len) {
      setItems((xs) => {
        const i = xs.findIndex((x) => x.id === it.id)
        return [...xs.slice(0, i + 1), ...parts.map((t) => newListItem(t)), ...xs.slice(i + 1)]
      })
      return
    }
    const before = input.value.slice(0, input.selectionStart ?? len)
    const after = input.value.slice(input.selectionEnd ?? len)
    const first = (before + parts[0]).trim()
    const last = (parts[parts.length - 1] + after).trim()
    const middle = parts.slice(1, -1)
    setItems((xs) => {
      const i = xs.findIndex((x) => x.id === it.id)
      const added = [...middle, last].map((t) => newListItem(t))
      return [...xs.slice(0, i), { ...it, text: first }, ...added, ...xs.slice(i + 1)]
    })
  }

  return (
    <div className="items">
      <div className="grid-2">
        <Select<ListDisplay>
          label="Affichage"
          value={display}
          options={[
            { value: 'bullets', label: 'Liste à puces' },
            { value: 'inline', label: 'Tags en ligne' },
            { value: 'chips', label: 'Pastilles' },
          ]}
          onChange={(v) => update((s) => ({ ...s, display: v }))}
        />
        {display === 'inline' && (
          <Select
            label="Séparateur"
            value={section.separator ?? ' · '}
            options={[
              { value: ' · ', label: 'Point médian  ·' },
              { value: ', ', label: 'Virgule  ,' },
              { value: ' | ', label: 'Barre  |' },
              { value: ' / ', label: 'Barre oblique  /' },
            ]}
            onChange={(v) => update((s) => ({ ...s, separator: v }))}
          />
        )}
      </div>
      <SortableList items={section.items} onReorder={(items) => update((s) => ({ ...s, items }))}>
        {(it, handle) => {
          const open = openItem === it.id
          return (
            <div ref={registerItem(it.id)} className={`item item--list${open ? ' is-open' : ''}${it.hidden ? ' is-muted' : ''}`}>
              <div className="item-head">
                {handle}
                <input
                  className="item-input"
                  value={it.text}
                  onChange={(e) => patch(it.id, { text: e.target.value })}
                  onPaste={pasteSplit(it)}
                  title="Coller « A, B, C » crée plusieurs éléments"
                  // Focusing an item selects it, so it is highlighted on the page
                  onFocus={() => !open && toggleItem(it.id)}
                />
                <div className="row-actions">
                  <IconButton title={it.hidden ? 'Afficher' : 'Masquer'} onClick={() => patch(it.id, { hidden: !it.hidden })}>
                    {it.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                  <IconButton title="Supprimer" danger onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            </div>
          )
        }}
      </SortableList>
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() => {
          const it = newListItem('')
          setItems((xs) => [...xs, it])
          toggleItem(it.id)
        }}
      >
        <Plus size={14} /> Ajouter un élément
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- Theme */

/**
 * Curated palettes: accent (name, section titles, icon circles) + a near-black text tinted to match.
 * Every accent has ≥ 5.3:1 contrast on white and white icons on it (WCAG AA), text ≥ 13:1.
 */
const PALETTES: { name: string; accent: string; text: string }[] = [
  { name: 'Cuivre', accent: '#a8541c', text: '#1f1d1b' },
  { name: 'Terracotta', accent: '#b1442c', text: '#221c1a' },
  { name: 'Bordeaux', accent: '#8c2638', text: '#211b1d' },
  { name: 'Framboise', accent: '#a8285d', text: '#221a1e' },
  { name: 'Prune', accent: '#6d3b9a', text: '#1e1a24' },
  { name: 'Indigo', accent: '#3446a8', text: '#1b1e2b' },
  { name: 'Bleu nuit', accent: '#1d4f7c', text: '#19222c' },
  { name: 'Pétrole', accent: '#0d6670', text: '#162325' },
  { name: 'Forêt', accent: '#2b6a3d', text: '#1a231d' },
  { name: 'Olive', accent: '#5d6420', text: '#21231a' },
  { name: 'Ardoise', accent: '#3e4c5e', text: '#1d2228' },
  { name: 'Graphite', accent: '#2e2e2e', text: '#2e2e2e' },
]

function ThemeEditor({ resume, setResume }: { resume: Resume; setResume: (fn: (r: Resume) => Resume) => void }) {
  const t = resume.theme
  const setTheme = (p: Partial<typeof t>) => setResume((r) => ({ ...r, theme: { ...r.theme, ...p } }))
  const setMeta = (p: Partial<Resume['meta']>) => setResume((r) => ({ ...r, meta: { ...r.meta, ...p } }))

  return (
    <div className="style-panel">
      <StyleGroup icon={<Palette size={15} />} title="Couleurs">
        <div className="palettes" role="radiogroup" aria-label="Palette">
          {PALETTES.map((p) => {
            const active = t.accent.toLowerCase() === p.accent && t.text.toLowerCase() === p.text
            return (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={active}
                className={`palette${active ? ' is-active' : ''}`}
                onClick={() => setTheme({ accent: p.accent, text: p.text })}
                title={`${p.name} — ${p.accent}`}
              >
                <span className="palette-preview">
                  <span className="palette-dot" style={{ background: p.accent }} />
                  <span className="palette-lines">
                    <span style={{ background: p.accent }} />
                    <span style={{ background: p.text }} />
                    <span style={{ background: p.text }} />
                  </span>
                </span>
                <span className="palette-name">{p.name}</span>
              </button>
            )
          })}
        </div>
        <div className="field-label">Personnaliser</div>
        <div className="grid-2">
          <ColorField label="Couleur d'accent" value={t.accent} onChange={(v) => setTheme({ accent: v })} />
          <ColorField label="Couleur du texte" value={t.text} onChange={(v) => setTheme({ text: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<LayoutTemplate size={15} />} title="Styles">
        <Select<HeaderStyle>
          label="En-tête"
          value={t.headerStyle}
          options={[
            { value: 'classic', label: 'Photo à gauche' },
            { value: 'centered', label: 'Centré' },
            { value: 'band', label: 'Bandeau couleur' },
            { value: 'sidebar', label: 'Barre latérale' },
          ]}
          // The sections are not reordered: the sidebar style only draws them differently (see mainLayout)
          onChange={(v) => setTheme({ headerStyle: v })}
          hint={
            t.headerStyle === 'sidebar'
              ? 'Les listes vont dans la barre latérale ; réglable par section (Contenu) ou en glissant une section sur la page.'
              : undefined
          }
        />
        <div className="grid-2">
          <Select<TitleStyle>
            label="Titres de section"
            value={t.titleStyle}
            options={[
              { value: 'underline', label: 'Souligné' },
              { value: 'caps', label: 'Petites capitales' },
              { value: 'bar', label: 'Barre à gauche' },
              { value: 'icon', label: 'Icône' },
            ]}
            onChange={(v) => setTheme({ titleStyle: v })}
          />
          <Select<EntryStyle>
            label="Entrées"
            value={t.entryStyle}
            options={[
              { value: 'left', label: 'Dates à gauche' },
              { value: 'right', label: 'Dates à droite' },
              { value: 'timeline', label: 'Frise' },
              { value: 'cards', label: 'Cartes' },
            ]}
            onChange={(v) => setTheme({ entryStyle: v })}
          />
        </div>
      </StyleGroup>

      <StyleGroup icon={<Type size={15} />} title="Typographie">
        <div className="grid-2">
          <Select
            label="Police"
            value={t.font}
            options={Object.entries(FONT_FAMILIES).map(([value, f]) => ({ value: value as typeof t.font, label: f.label }))}
            onChange={(v) => setTheme({ font: v })}
          />
          <Select
            label="Densité"
            value={t.density}
            options={[
              { value: 'compact', label: 'Compacte' },
              { value: 'normal', label: 'Normale' },
              { value: 'airy', label: 'Aérée' },
            ]}
            onChange={(v) => setTheme({ density: v })}
          />
        </div>
        <Slider
          label="Taille du texte"
          min={8}
          max={13}
          step={0.5}
          unit=" pt"
          value={t.fontSize}
          onChange={(v) => setTheme({ fontSize: v })}
        />
      </StyleGroup>

      <StyleGroup icon={<Columns2 size={15} />} title="Mise en page">
        <p className="note">
          Sur la page, survolez une section et glissez sa poignée pour la placer en ligne, en colonne ou sous une autre. Glissez le
          séparateur entre colonnes pour les redimensionner, et les bords de page pour les marges.
        </p>
        <Slider label="Colonne des dates" min={18} max={45} unit=" mm" value={t.dateColumn} onChange={(v) => setTheme({ dateColumn: v })} />
        <div className="grid-2">
          <Slider label="Marges horizontales" min={5} max={25} unit=" mm" value={t.marginX} onChange={(v) => setTheme({ marginX: v })} />
          <Slider label="Marges verticales" min={5} max={25} unit=" mm" value={t.marginY} onChange={(v) => setTheme({ marginY: v })} />
        </div>
        <Toggle label="Icônes de lien sur les entrées" checked={t.showLinkIcons} onChange={(v) => setTheme({ showLinkIcons: v })} />
      </StyleGroup>

      <StyleGroup icon={<ImageIcon size={15} />} title="Photo">
        <Toggle label="Afficher la photo" checked={t.showPhoto} onChange={(v) => setTheme({ showPhoto: v })} />
        <Toggle label="Anneau couleur" checked={t.photoRing} onChange={(v) => setTheme({ photoRing: v })} />
        <Toggle label="Initiales s'il n'y a pas de photo" checked={t.photoInitials} onChange={(v) => setTheme({ photoInitials: v })} />
        <div className="grid-2">
          <Select
            label="Forme"
            value={t.photoShape}
            options={[
              { value: 'circle', label: 'Cercle' },
              { value: 'rounded', label: 'Arrondie' },
              { value: 'square', label: 'Carrée' },
            ]}
            onChange={(v) => setTheme({ photoShape: v })}
          />
          <Slider label="Taille" min={15} max={45} unit=" mm" value={t.photoSize} onChange={(v) => setTheme({ photoSize: v })} />
        </div>
      </StyleGroup>

      <StyleGroup icon={<FileText size={15} />} title="Export PDF">
        <div className="grid-2">
          <TextField label="Nom du fichier PDF" value={resume.meta.fileName} onChange={(v) => setMeta({ fileName: v })} />
          <Select
            label="Langue du CV"
            value={resume.meta.locale}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
            onChange={(v) => setMeta({ locale: v })}
            hint="Indiquée dans le PDF pour les logiciels de recrutement."
          />
        </div>
      </StyleGroup>
    </div>
  )
}

function StyleGroup({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="style-group">
      <h3 className="style-group-title">
        <span className="card-icon">{icon}</span>
        {title}
      </h3>
      <div className="style-group-body">{children}</div>
    </section>
  )
}
