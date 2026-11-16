import { useRef, useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import type { Contact, Profile } from '../../types'
import { gravatarPhoto, isEmail, NoGravatarError, readImageFile, uid } from '../../utils'
import { Field, IconButton, TextArea, TextField } from './fields'
import { IconPicker } from './IconPicker'
import { SortableList } from './Sortable'
import { defineStrings, useStrings } from '../../i18n'

const S = defineStrings(
  {
    changePhoto: 'Changer la photo',
    addPhoto: 'Ajouter une photo',
    removePhoto: 'Retirer',
    badImage: (msg: string) => `Impossible d'utiliser cette image : ${msg}`,
    gravatar: 'Gravatar',
    gravatarTitle: 'Utiliser la photo Gravatar d’une adresse e-mail',
    gravatarEmail: 'Adresse e-mail du compte Gravatar',
    gravatarHint: 'Seule une empreinte (hash) de l’adresse est envoyée à gravatar.com. La photo est copiée dans le CV : elle ne change plus ensuite.',
    gravatarUse: 'Utiliser cette photo',
    gravatarLoading: 'Chargement…',
    cancel: 'Annuler',
    gravatarBadEmail: 'Adresse e-mail invalide',
    gravatarNone: 'Aucune photo Gravatar pour cette adresse',
    gravatarFailed: (msg: string) => `Impossible de récupérer la photo Gravatar : ${msg}`,
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
    gravatar: 'Gravatar',
    gravatarTitle: 'Use the Gravatar picture of an email address',
    gravatarEmail: 'Email address of the Gravatar account',
    gravatarHint: 'Only a fingerprint (hash) of the address is sent to gravatar.com. The picture is copied into the resume: it does not change afterwards.',
    gravatarUse: 'Use this picture',
    gravatarLoading: 'Loading…',
    cancel: 'Cancel',
    gravatarBadEmail: 'Invalid email address',
    gravatarNone: 'No Gravatar picture for this address',
    gravatarFailed: (msg) => `Could not get the Gravatar picture: ${msg}`,
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
  // Gravatar form: null = closed, else the address typed (prefilled with the resume's e-mail contact)
  const [gravatarEmail, setGravatarEmail] = useState<string | null>(null)
  const [gravatarBusy, setGravatarBusy] = useState(false)
  const [gravatarError, setGravatarError] = useState('')

  const openGravatar = () => {
    const contact = profile.contacts.find((c) => isEmail(c.label) || /^mailto:/i.test(c.url.trim()))
    setGravatarEmail(contact ? (isEmail(contact.label) ? contact.label : contact.url.trim().slice(7)).trim() : '')
    setGravatarError('')
  }

  const applyGravatar = async () => {
    const email = gravatarEmail?.trim() ?? ''
    if (!isEmail(email)) return setGravatarError(t.gravatarBadEmail)
    setGravatarBusy(true)
    setGravatarError('')
    try {
      setProfile({ photo: await gravatarPhoto(email) })
      setGravatarEmail(null)
    } catch (err) {
      setGravatarError(err instanceof NoGravatarError ? t.gravatarNone : t.gravatarFailed(String((err as Error).message ?? err)))
    } finally {
      setGravatarBusy(false)
    }
  }

  return (
    <>
      <div className="photo-row">
        <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()} title={t.changePhoto}>
          {profile.photo ? <img src={profile.photo} alt="" /> : <ImagePlus size={22} />}
        </button>
        <div className="photo-actions">
          <button type="button" className="btn btn--small" onClick={() => fileRef.current?.click()}>
            {profile.photo ? t.changePhoto : t.addPhoto}
          </button>
          <button type="button" className="btn btn--small btn--ghost" title={t.gravatarTitle} aria-expanded={gravatarEmail !== null} onClick={openGravatar}>
            {t.gravatar}
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
      {gravatarEmail !== null && (
        <form
          className="gravatar-form"
          onSubmit={(e) => {
            e.preventDefault()
            void applyGravatar()
          }}
        >
          <Field label={t.gravatarEmail} hint={t.gravatarHint}>
            <input
              type="email"
              autoFocus
              value={gravatarEmail}
              onChange={(e) => {
                setGravatarEmail(e.target.value)
                setGravatarError('')
              }}
            />
          </Field>
          {gravatarError && (
            <p className="gravatar-error" role="alert">
              {gravatarError}
            </p>
          )}
          <div className="photo-actions">
            <button type="submit" className="btn btn--small" disabled={gravatarBusy}>
              {gravatarBusy ? t.gravatarLoading : t.gravatarUse}
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setGravatarEmail(null)}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}

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
