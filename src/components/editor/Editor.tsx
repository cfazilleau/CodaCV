import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Columns2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  List,
  ListTree,
  Palette,
  PenLine,
  Plus,
  Text,
  Trash2,
  Type,
  User,
} from 'lucide-react'
import type {
  Contact,
  ListItem,
  ListSection,
  Profile,
  Resume,
  Section,
  SectionKind,
  Selection,
  TimelineEntry,
  TimelineSection,
} from '../../types'
import { newEntry, newListItem, newSection, readImageFile, uid } from '../../utils'
import { FONT_FAMILIES } from '../ResumeDocument'
import { COUNTRIES, ColorField, IconButton, LinesField, Select, Slider, TextArea, TextField, Toggle } from './fields'
import { IconPicker } from './IconPicker'
import { SortableList } from './Sortable'

interface Props {
  resume: Resume
  setResume: (fn: (r: Resume) => Resume) => void
  selection: Selection
  onSelect: (sel: Selection) => void
}

const MD_HINT = 'Markdown : **gras**, *italique*, [lien](https://…), listes, ![image](https://…)'

type Tab = 'content' | 'style'
const TAB_KEY = 'codacv.sidebarTab'

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'style' ? 'style' : 'content'
  } catch {
    return 'content'
  }
}

export function Editor({ resume, setResume, selection, onSelect }: Props) {
  const [tab, setTabState] = useState<Tab>(loadTab)
  const [openCard, setOpenCard] = useState<string | null>('profile')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const itemRefs = useRef(new Map<string, HTMLElement>())

  const setTab = (t: Tab) => {
    setTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* per-browser convenience only */
    }
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

  const addSection = (kind: SectionKind) => {
    const s = newSection(kind)
    setResume((r) => ({ ...r, sections: [...r.sections, s] }))
    setOpenCard(s.id)
    onSelect({ kind: 'section', sectionId: s.id })
    requestAnimationFrame(() => cardRefs.current.get(s.id)?.scrollIntoView({ behavior: 'smooth' }))
  }

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
          onClick={() => setTab('content')}
        >
          <PenLine size={15} /> Contenu
        </button>
        <button role="tab" aria-selected={tab === 'style'} className={tab === 'style' ? 'is-active' : ''} onClick={() => setTab('style')}>
          <Palette size={15} /> Apparence
        </button>
      </div>

      {tab === 'style' ? (
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
            onReorder={(sections) => setResume((r) => ({ ...r, sections }))}
          >
            {(s, handle) => (
              <Card
                handle={handle}
                ref={registerCard(s.id)}
                icon={s.kind === 'timeline' ? <ListTree size={16} /> : s.kind === 'list' ? <List size={16} /> : <Text size={16} />}
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
                          setResume((r) => ({ ...r, sections: r.sections.filter((x) => x.id !== s.id) }))
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </>
                }
              >
                <TextField label="Titre de la section" value={s.title} onChange={(v) => setSection(s.id, (x) => ({ ...x, title: v }))} />
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
              <button type="button" onClick={() => addSection('text')}>
                <Text size={15} /> Texte libre
              </button>
            </div>
          </div>
        </>
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
      <header className="card-head" onClick={onToggle}>
        {handle}
        <ChevronRight size={16} className="card-chevron" />
        <span className="card-icon">{icon}</span>
        <h3>{title}</h3>
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
              <div className="item-head" onClick={() => toggleItem(e.id)}>
                {handle}
                <ChevronRight size={14} className="card-chevron" />
                <div className="item-title">
                  <strong>{e.title || 'Sans titre'}</strong>
                  <span>{[e.subtitle, e.date].filter(Boolean).join(' · ')}</span>
                </div>
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

  return (
    <div className="items">
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

const ACCENTS = ['#b35f22', '#c2410c', '#b91c1c', '#be185d', '#7c3aed', '#1d4ed8', '#0e7490', '#047857', '#374151']

function ThemeEditor({ resume, setResume }: { resume: Resume; setResume: (fn: (r: Resume) => Resume) => void }) {
  const t = resume.theme
  const setTheme = (p: Partial<typeof t>) => setResume((r) => ({ ...r, theme: { ...r.theme, ...p } }))
  const setMeta = (p: Partial<Resume['meta']>) => setResume((r) => ({ ...r, meta: { ...r.meta, ...p } }))

  return (
    <div className="style-panel">
      <StyleGroup icon={<Palette size={15} />} title="Couleurs">
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${t.accent.toLowerCase() === c ? ' is-active' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => setTheme({ accent: c })}
            />
          ))}
        </div>
        <div className="grid-2">
          <ColorField label="Couleur d'accent" value={t.accent} onChange={(v) => setTheme({ accent: v })} />
          <ColorField label="Couleur du texte" value={t.text} onChange={(v) => setTheme({ text: v })} />
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
