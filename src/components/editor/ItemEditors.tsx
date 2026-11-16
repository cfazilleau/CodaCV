import type { ClipboardEvent } from 'react'
import { ChevronRight, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import type { ListDisplay, ListItem, ListSection, TimelineEntry, TimelineSection } from '../../types'
import { newEntry, newListItem, uid } from '../../utils'
import { COUNTRIES, IconButton, LinesField, Select, TextField } from './fields'
import { SortableList } from './Sortable'

export interface ItemSel {
  openItem: string | null
  /** Select the item (highlight on the page) when one of its fields gets focus */
  focusItem: (id: string) => void
  registerItem: (id: string) => (el: HTMLElement | null) => void
}

interface RecordField<T> {
  key: keyof T & string
  /** Accessible name of the input (the grid has no visible labels) */
  label: string
  placeholder?: string
  type?: 'text' | 'rating'
}

/** Editor for sections whose items are a few short fields (levels, facts, references, highlights). */
export function RecordListEditor<T extends { id: string; hidden: boolean }>({
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
                      aria-label={f.label}
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
                      aria-label={f.label}
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


interface ItemEditorProps<S> {
  section: S
  update: (fn: (s: S) => S) => void
  openItem: string | null
  toggleItem: (id: string) => void
  registerItem: (id: string) => (el: HTMLElement | null) => void
}

export function TimelineEditor({ section, update, openItem, toggleItem, registerItem }: ItemEditorProps<TimelineSection>) {
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

export function ListEditor({ section, update, openItem, toggleItem, registerItem }: ItemEditorProps<ListSection>) {
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
                  aria-label="Élément"
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
