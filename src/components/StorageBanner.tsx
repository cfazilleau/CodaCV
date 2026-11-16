import { AlertTriangle } from 'lucide-react'
import { LIBRARY_KEY, type StorageIssue } from '../store'
import { downloadText } from '../utils'

interface Props {
  issue: StorageIssue | null
  onOverwrite: () => void
  onDismiss: () => void
}

/** Download what is stored under a key, as is (to keep a copy before overwriting it). */
function downloadKey(key: string, fileName: string) {
  try {
    downloadText(fileName, localStorage.getItem(key) ?? '')
  } catch (e) {
    alert(`Lecture impossible : ${(e as Error).message}`)
  }
}

/** Warnings about the saved data: another tab saved, or some data could not be read. */
export function StorageBanner({ issue, onOverwrite, onDismiss }: Props) {
  if (!issue) return null
  return (
    <div className="storage-banner" role="alert">
      <AlertTriangle size={16} />
      {issue.kind === 'other-tab' && (
        <>
          <span>
            Vos CV ont été modifiés dans un autre onglet. Les changements faits ici ne sont plus enregistrés, pour ne pas écraser
            ceux de l'autre onglet.
          </span>
          <button type="button" className="btn btn--small" onClick={() => window.location.reload()}>
            Recharger (perd les changements de cet onglet)
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => confirm("Remplacer les données de l'autre onglet par celles de cet onglet ?") && onOverwrite()}
          >
            Garder cet onglet
          </button>
        </>
      )}
      {issue.kind === 'unreadable' && (
        <>
          <span>
            Les données enregistrées sont illisibles et n'ont pas pu être mises de côté (stockage plein ?). L'enregistrement est
            suspendu pour ne pas les effacer.
          </span>
          <button type="button" className="btn btn--small" onClick={() => downloadKey(LIBRARY_KEY, 'codacv-donnees-illisibles.json')}>
            Télécharger les données
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => confirm('Enregistrer quand même ? Les données illisibles seront effacées.') && onOverwrite()}
          >
            Enregistrer quand même
          </button>
        </>
      )}
      {issue.kind === 'save-failed' && (
        <span>
          Impossible d'enregistrer : l'espace de stockage du navigateur est plein. Retirez une photo ou des versions inutiles, ou
          exportez vos CV en JSON. Le prochain changement réessaiera.
        </span>
      )}
      {issue.kind === 'quarantined' && (
        <>
          <span>
            {issue.count > 1
              ? `${issue.count} versions illisibles ont été mises de côté (conservées`
              : 'Une version illisible a été mise de côté (conservée'}{' '}
            dans le navigateur, clé « {issue.key} »).
          </span>
          <button type="button" className="btn btn--small" onClick={() => downloadKey(issue.key, 'codacv-versions-illisibles.json')}>
            Télécharger
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={onDismiss}>
            OK
          </button>
        </>
      )}
    </div>
  )
}
