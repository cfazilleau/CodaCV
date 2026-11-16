import { useState } from 'react'
import { Check, Copy, FilePlus2, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import type { Version } from '../../store'
import { defineStrings, useStrings, useUiLang, type UiLang } from '../../i18n'
import { RESUME_LOCALES } from '../../locale'
import { IconButton } from './fields'
import { SortableList } from './Sortable'

interface Props {
  versions: Version[]
  activeId: string
  onSwitch: (id: string) => void
  onCreate: (from: 'copy' | 'template') => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onReorder: (versions: Version[]) => void
}

const S = defineStrings(
  {
    note:
      'Chaque version est un CV complet : contenu, mise en page, couleurs, langue et nom du fichier PDF. Dupliquez la version active pour une autre langue ou une candidature précise.',
    duplicate: 'Dupliquer la version active',
    fromTemplate: 'Partir du modèle',
    nameLabel: 'Nom de la version',
    active: 'Active',
    sections: (n: number) => `${n} section${n > 1 ? 's' : ''}`,
    open: 'Ouvrir cette version',
    rename: 'Renommer',
    cannotDeleteLast: 'Impossible de supprimer la seule version',
    delete: 'Supprimer',
    confirmDelete: (name: string) =>
      `Supprimer la version « ${name} » ? Elle ne pourra pas être récupérée (exportez-la en JSON d'abord si besoin).`,
    justNow: "à l'instant",
    minutesAgo: (n: number) => `il y a ${n} min`,
    hoursAgo: (n: number) => `il y a ${n} h`,
  },
  {
    note:
      'Each version is a complete resume: content, layout, colors, language and PDF file name. Duplicate the active version for another language or a specific application.',
    duplicate: 'Duplicate the active version',
    fromTemplate: 'Start from the template',
    nameLabel: 'Version name',
    active: 'Active',
    sections: (n) => `${n} section${n === 1 ? '' : 's'}`,
    open: 'Open this version',
    rename: 'Rename',
    cannotDeleteLast: 'The only version cannot be deleted',
    delete: 'Delete',
    confirmDelete: (name) => `Delete the version “${name}”? It cannot be recovered (export it as JSON first if needed).`,
    justNow: 'just now',
    minutesAgo: (n) => `${n} min ago`,
    hoursAgo: (n) => `${n} h ago`,
  },
)

function ago(ts: number, t: (typeof S)['fr'], lang: UiLang): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return t.justNow
  if (s < 3600) return t.minutesAgo(Math.round(s / 60))
  if (s < 86400) return t.hoursAgo(Math.round(s / 3600))
  return new Date(ts).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Third sidebar tab: several complete resumes (other language, tailored for a company…). */
export function VersionsPanel({ versions, activeId, onSwitch, onCreate, onRename, onDelete, onReorder }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const t = useStrings(S)
  const lang = useUiLang()

  return (
    <div className="versions">
      <p className="note">{t.note}</p>

      <div className="versions-actions">
        <button type="button" className="btn btn--small" onClick={() => onCreate('copy')}>
          <Copy size={14} /> {t.duplicate}
        </button>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => onCreate('template')}>
          <FilePlus2 size={14} /> {t.fromTemplate}
        </button>
      </div>

      <SortableList items={versions} onReorder={onReorder}>
        {(v, handle) => {
          const active = v.id === activeId
          const r = v.resume
          return (
            <div className={`version${active ? ' is-active' : ''}`}>
              {handle}
              <div className="version-body" onClick={() => !active && onSwitch(v.id)} onDoubleClick={() => setEditing(v.id)}>
                {editing === v.id ? (
                  <input
                    className="item-input version-name-input"
                    aria-label={t.nameLabel}
                    autoFocus
                    defaultValue={v.name}
                    onBlur={(e) => {
                      onRename(v.id, e.target.value.trim() || v.name)
                      setEditing(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <div className="version-name">
                    {v.name}
                    {active && (
                      <span className="version-badge">
                        <Check size={11} /> {t.active}
                      </span>
                    )}
                  </div>
                )}
                <div className="version-meta">
                  <span className="version-lang" title={RESUME_LOCALES[r.meta.locale]?.label}>
                    {r.meta.locale.toUpperCase()}
                  </span>
                  <span>{r.profile.title || r.profile.name}</span>
                  <span>·</span>
                  <span>{t.sections(r.sections.length)}</span>
                  <span>·</span>
                  <span>{ago(v.updatedAt, t, lang)}</span>
                </div>
              </div>
              <div className="row-actions">
                {!active && (
                  <IconButton title={t.open} onClick={() => onSwitch(v.id)}>
                    <FolderOpen size={15} />
                  </IconButton>
                )}
                <IconButton title={t.rename} onClick={() => setEditing(v.id)}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  title={versions.length < 2 ? t.cannotDeleteLast : t.delete}
                  danger
                  disabled={versions.length < 2}
                  onClick={() => {
                    if (confirm(t.confirmDelete(v.name))) onDelete(v.id)
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          )
        }}
      </SortableList>
    </div>
  )
}
