import { AlertTriangle } from 'lucide-react'
import { LIBRARY_KEY, type StorageIssue } from '../store'
import { defineStrings, strings, useStrings } from '../i18n'
import { downloadText } from '../utils'

interface Props {
  issue: StorageIssue | null
  onOverwrite: () => void
  onDismiss: () => void
}

const S = defineStrings(
  {
    readFailed: (msg: string) => `Lecture impossible : ${msg}`,
    otherTab:
      "Vos CV ont été modifiés dans un autre onglet. Les changements faits ici ne sont plus enregistrés, pour ne pas écraser ceux de l'autre onglet.",
    reload: 'Recharger (perd les changements de cet onglet)',
    confirmKeepTab: "Remplacer les données de l'autre onglet par celles de cet onglet ?",
    keepTab: 'Garder cet onglet',
    unreadable:
      "Les données enregistrées sont illisibles et n'ont pas pu être mises de côté (stockage plein ?). L'enregistrement est suspendu pour ne pas les effacer.",
    unreadableFile: 'codacv-donnees-illisibles.json',
    downloadData: 'Télécharger les données',
    confirmSaveAnyway: 'Enregistrer quand même ? Les données illisibles seront effacées.',
    saveAnyway: 'Enregistrer quand même',
    saveFailed:
      "Impossible d'enregistrer : l'espace de stockage du navigateur est plein. Retirez une photo ou des versions inutiles, ou exportez vos CV en JSON. Le prochain changement réessaiera.",
    quarantined: (count: number, key: string) =>
      count > 1
        ? `${count} versions illisibles ont été mises de côté (conservées dans le navigateur, clé « ${key} »).`
        : `Une version illisible a été mise de côté (conservée dans le navigateur, clé « ${key} »).`,
    quarantinedFile: 'codacv-versions-illisibles.json',
    download: 'Télécharger',
    ok: 'OK',
  },
  {
    readFailed: (msg) => `Could not read the data: ${msg}`,
    otherTab:
      'Your resumes were changed in another tab. Changes made here are no longer saved, so as not to overwrite those of the other tab.',
    reload: 'Reload (loses the changes made in this tab)',
    confirmKeepTab: "Replace the other tab's data with this tab's?",
    keepTab: 'Keep this tab',
    unreadable:
      'The saved data is unreadable and could not be set aside (storage full?). Saving is paused so that it is not erased.',
    unreadableFile: 'codacv-unreadable-data.json',
    downloadData: 'Download the data',
    confirmSaveAnyway: 'Save anyway? The unreadable data will be erased.',
    saveAnyway: 'Save anyway',
    saveFailed:
      "Could not save: the browser's storage is full. Remove a photo or versions you no longer need, or export your resumes as JSON. The next change will try again.",
    quarantined: (count, key) =>
      count > 1
        ? `${count} unreadable versions were set aside (kept in the browser, key “${key}”).`
        : `An unreadable version was set aside (kept in the browser, key “${key}”).`,
    quarantinedFile: 'codacv-unreadable-versions.json',
    download: 'Download',
    ok: 'OK',
  },
)

/** Download what is stored under a key, as is (to keep a copy before overwriting it). */
function downloadKey(key: string, fileName: string) {
  try {
    downloadText(fileName, localStorage.getItem(key) ?? '')
  } catch (e) {
    alert(strings(S).readFailed((e as Error).message))
  }
}

/** Warnings about the saved data: another tab saved, or some data could not be read. */
export function StorageBanner({ issue, onOverwrite, onDismiss }: Props) {
  const t = useStrings(S)
  if (!issue) return null
  return (
    <div className="storage-banner" role="alert">
      <AlertTriangle size={16} />
      {issue.kind === 'other-tab' && (
        <>
          <span>{t.otherTab}</span>
          <button type="button" className="btn btn--small" onClick={() => window.location.reload()}>
            {t.reload}
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => confirm(t.confirmKeepTab) && onOverwrite()}
          >
            {t.keepTab}
          </button>
        </>
      )}
      {issue.kind === 'unreadable' && (
        <>
          <span>{t.unreadable}</span>
          <button type="button" className="btn btn--small" onClick={() => downloadKey(LIBRARY_KEY, t.unreadableFile)}>
            {t.downloadData}
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => confirm(t.confirmSaveAnyway) && onOverwrite()}
          >
            {t.saveAnyway}
          </button>
        </>
      )}
      {issue.kind === 'save-failed' && <span>{t.saveFailed}</span>}
      {issue.kind === 'quarantined' && (
        <>
          <span>{t.quarantined(issue.count, issue.key)}</span>
          <button type="button" className="btn btn--small" onClick={() => downloadKey(issue.key, t.quarantinedFile)}>
            {t.download}
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={onDismiss}>
            {t.ok}
          </button>
        </>
      )}
    </div>
  )
}
