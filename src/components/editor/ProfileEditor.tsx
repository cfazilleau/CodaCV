import { useRef } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import type { Contact, Profile } from '../../types'
import { readImageFile, uid } from '../../utils'
import { IconButton, TextArea, TextField } from './fields'
import { IconPicker } from './IconPicker'
import { SortableList } from './Sortable'

export function ProfileEditor({ profile, setProfile, accent }: { profile: Profile; setProfile: (p: Partial<Profile>) => void; accent: string }) {
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
            const input = e.target
            const file = input.files?.[0]
            input.value = ''
            if (!file) return
            try {
              setProfile({ photo: await readImageFile(file) })
            } catch (err) {
              alert(`Impossible d'utiliser cette image : ${(err as Error).message ?? err}`)
            }
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
                aria-label="Texte affiché"
                placeholder="Texte affiché"
                value={c.label}
                onChange={(e) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))}
              />
              <input
                aria-label="Lien"
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
