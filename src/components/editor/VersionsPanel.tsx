import { useState } from 'react'
import { Check, Copy, FilePlus2, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import type { Version } from '../../store'
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

const LOCALE_LABEL: Record<string, string> = { fr: 'FR', en: 'EN' }

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Third sidebar tab: several complete resumes (other language, tailored for a company…). */
export function VersionsPanel({ versions, activeId, onSwitch, onCreate, onRename, onDelete, onReorder }: Props) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="versions">
      <p className="note">
        Chaque version est un CV complet : contenu, mise en page, couleurs, langue et nom du fichier PDF. Dupliquez la version active
        pour une autre langue ou une candidature précise.
      </p>

      <div className="versions-actions">
        <button type="button" className="btn btn--small" onClick={() => onCreate('copy')}>
          <Copy size={14} /> Dupliquer la version active
        </button>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => onCreate('template')}>
          <FilePlus2 size={14} /> Partir du modèle
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
                    aria-label="Nom de la version"
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
                        <Check size={11} /> Active
                      </span>
                    )}
                  </div>
                )}
                <div className="version-meta">
                  <span className="version-lang">{LOCALE_LABEL[r.meta.locale] ?? r.meta.locale}</span>
                  <span>{r.profile.title || r.profile.name}</span>
                  <span>·</span>
                  <span>{r.sections.length} sections</span>
                  <span>·</span>
                  <span>{ago(v.updatedAt)}</span>
                </div>
              </div>
              <div className="row-actions">
                {!active && (
                  <IconButton title="Ouvrir cette version" onClick={() => onSwitch(v.id)}>
                    <FolderOpen size={15} />
                  </IconButton>
                )}
                <IconButton title="Renommer" onClick={() => setEditing(v.id)}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  title={versions.length < 2 ? 'Impossible de supprimer la seule version' : 'Supprimer'}
                  danger
                  disabled={versions.length < 2}
                  onClick={() => {
                    if (confirm(`Supprimer la version « ${v.name} » ? Elle ne pourra pas être récupérée (exportez-la en JSON d'abord si besoin).`))
                      onDelete(v.id)
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
