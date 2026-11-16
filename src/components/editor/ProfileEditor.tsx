import { useRef } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import type { Contact, Profile } from '../../types'
import { isEmbeddedImage, readImageFile, uid } from '../../utils'
import { IconButton, TextArea, TextField } from './fields'
import { IconPicker } from './IconPicker'
import { SortableList } from './Sortable'
import { defineStrings, useStrings } from '../../i18n'

const S = defineStrings(
  {
    changePhoto: 'Changer la photo',
    addPhoto: 'Ajouter une photo',
    removePhoto: 'Retirer',
    badImage: (msg: string) => `Impossible d'utiliser cette image : ${msg}`,
    name: 'Nom complet',
    jobTitle: 'Intitulé du poste',
    summary: 'Accroche',
    contacts: 'Contacts',
    contactText: 'Texte affiché',
    link: 'Lien',
    linkPlaceholder: 'Lien (auto pour e-mail / tél.)',
    linkHint: 'Laisser vide pour un e-mail ou un numéro : le lien mailto: / tel: est créé automatiquement',
    remove: 'Supprimer',
    addContact: 'Ajouter un contact',
  },
  {
    changePhoto: 'Change photo',
    addPhoto: 'Add a photo',
    removePhoto: 'Remove',
    badImage: (msg) => `Can't use this image: ${msg}`,
    name: 'Full name',
    jobTitle: 'Job title',
    summary: 'Summary',
    contacts: 'Contacts',
    contactText: 'Displayed text',
    link: 'Link',
    linkPlaceholder: 'Link (auto for email / phone)',
    linkHint: 'Leave empty for an email address or a phone number: the mailto: / tel: link is created automatically',
    remove: 'Delete',
    addContact: 'Add a contact',
  },
)

export function ProfileEditor({ profile, setProfile, accent }: { profile: Profile; setProfile: (p: Partial<Profile>) => void; accent: string }) {
  const t = useStrings(S)
  const fileRef = useRef<HTMLInputElement>(null)
  const setContacts = (fn: (c: Contact[]) => Contact[]) => setProfile({ contacts: fn(profile.contacts) })

  return (
    <>
      <div className="photo-row">
        <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()} title={t.changePhoto}>
          {/* Embedded photos only, as on the resume: a web address is never loaded */}
          {isEmbeddedImage(profile.photo) ? <img src={profile.photo} alt="" /> : <ImagePlus size={22} />}
        </button>
        <div className="photo-actions">
          <button type="button" className="btn btn--small" onClick={() => fileRef.current?.click()}>
            {profile.photo ? t.changePhoto : t.addPhoto}
          </button>
          {profile.photo && (
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setProfile({ photo: '' })}>
              {t.removePhoto}
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
              alert(t.badImage(String((err as Error).message ?? err)))
            }
          }}
        />
      </div>

      <div className="grid-2">
        <TextField label={t.name} value={profile.name} onChange={(v) => setProfile({ name: v })} />
        <TextField label={t.jobTitle} value={profile.title} onChange={(v) => setProfile({ title: v })} />
      </div>
      <div className="field">
        <span className="field-label">{t.summary}</span>
        <div className="with-icon">
          <IconPicker value={profile.summaryIcon} accent={accent} onChange={(v) => setProfile({ summaryIcon: v })} />
          <TextArea value={profile.summary} onChange={(v) => setProfile({ summary: v })} />
        </div>
      </div>

      <div className="subhead">{t.contacts}</div>
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
                aria-label={t.contactText}
                placeholder={t.contactText}
                value={c.label}
                onChange={(e) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))}
              />
              <input
                aria-label={t.link}
                placeholder={t.linkPlaceholder}
                title={t.linkHint}
                value={c.url}
                onChange={(e) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, url: e.target.value } : x)))}
              />
              <div className="row-actions">
                <IconButton title={t.remove} danger onClick={() => setContacts((cs) => cs.filter((x) => x.id !== c.id))}>
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
          <Plus size={14} /> {t.addContact}
        </button>
      </div>
    </>
  )
}
