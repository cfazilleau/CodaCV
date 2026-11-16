import { Component, type ErrorInfo, type ReactNode } from 'react'
import { defineStrings, strings } from '../i18n'
import { LIBRARY_KEY, TAB_KEY } from '../store'
import { downloadText } from '../utils'

interface State {
  error: Error | null
}

const S = defineStrings(
  {
    title: "Une erreur a empêché l'affichage",
    body: "Vos CV enregistrés n'ont pas été modifiés. Rechargez la page ; si l'erreur revient, téléchargez vos données.",
    reload: 'Recharger',
    download: 'Télécharger les données enregistrées',
    fileName: 'codacv-donnees.json',
    readFailed: (msg: string) => `Lecture impossible : ${msg}`,
    details: 'Détails',
  },
  {
    title: 'An error prevented the page from displaying',
    body: 'Your saved resumes were not changed. Reload the page; if the error comes back, download your data.',
    reload: 'Reload',
    download: 'Download the saved data',
    fileName: 'codacv-data.json',
    readFailed: (msg) => `Could not read the data: ${msg}`,
    details: 'Details',
  },
)

/**
 * Last line of defence: a rendering error shows this screen instead of a blank page. Nothing is
 * saved by the crashed tree (its effects never commit), so the stored data is as it was.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CodaCV crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const t = strings(S)
    return (
      <div className="crash">
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <div className="crash-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              try {
                localStorage.setItem(TAB_KEY, 'content')
              } catch {
                /* the reload still works */
              }
              window.location.reload()
            }}
          >
            {t.reload}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              try {
                downloadText(t.fileName, localStorage.getItem(LIBRARY_KEY) ?? '')
              } catch (e) {
                alert(t.readFailed((e as Error).message))
              }
            }}
          >
            {t.download}
          </button>
        </div>
        <details>
          <summary>{t.details}</summary>
          <pre>{error.stack ?? error.message}</pre>
        </details>
      </div>
    )
  }
}
