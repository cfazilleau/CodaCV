import { Component, type ErrorInfo, type ReactNode } from 'react'
import { LIBRARY_KEY, TAB_KEY } from '../store'
import { downloadText } from '../utils'

interface State {
  error: Error | null
}

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
    return (
      <div className="crash">
        <h1>Une erreur a empêché l'affichage</h1>
        <p>Vos CV enregistrés n'ont pas été modifiés. Rechargez la page ; si l'erreur revient, téléchargez vos données.</p>
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
            Recharger
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              try {
                downloadText('codacv-donnees.json', localStorage.getItem(LIBRARY_KEY) ?? '')
              } catch (e) {
                alert(`Lecture impossible : ${(e as Error).message}`)
              }
            }}
          >
            Télécharger les données enregistrées
          </button>
        </div>
        <details>
          <summary>Détails</summary>
          <pre>{error.stack ?? error.message}</pre>
        </details>
      </div>
    )
  }
}
