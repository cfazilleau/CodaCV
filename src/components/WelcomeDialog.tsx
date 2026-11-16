import { useEffect, useRef, type ReactNode } from 'react'
import { CodeXml, Cookie, ExternalLink, Gift, HardDrive } from 'lucide-react'
import { defineStrings, useStrings } from '../i18n'

/** Public source repository, linked from the welcome screen. */
export const REPO_URL = 'https://github.com/cfazilleau/CodaCV'

/** Set once the welcome screen has been closed: it then only opens from the top bar. */
const SEEN_KEY = 'codacv.welcomeSeen'

export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false // storage blocked: show it, nothing is remembered anyway
  }
}

const S = defineStrings(
  {
    title: 'Bienvenue sur CodaCV',
    intro: 'Créez votre CV, mettez-le en page sur un aperçu A4 et enregistrez-le en PDF lisible par les logiciels de recrutement.',
    freeTitle: 'Gratuit',
    free: 'Sans compte, sans publicité, sans limite.',
    openTitle: 'Open source',
    open: 'Tout le code est public :',
    dataTitle: 'Vos données restent chez vous',
    data: "Vos CV sont enregistrés uniquement dans ce navigateur. Rien n'est envoyé à un serveur.",
    privacyTitle: 'Ni cookie, ni suivi',
    privacy: 'Aucun cookie, aucune statistique de visite, aucun traceur.',
    note: "Videz les données du navigateur et vos CV disparaissent : exportez-les en JSON pour en garder une copie. Seule exception au « rien ne sort » : une image que vous insérez par son adresse dans un texte libre est chargée depuis son site.",
    start: 'Commencer',
  },
  {
    title: 'Welcome to CodaCV',
    intro: 'Write your resume, lay it out on an A4 preview and save it as a PDF that recruiting software can read.',
    freeTitle: 'Free',
    free: 'No account, no ads, no limits.',
    openTitle: 'Open source',
    open: 'All the code is public:',
    dataTitle: 'Your data stays with you',
    data: 'Your resumes are saved only in this browser. Nothing is sent to a server.',
    privacyTitle: 'No cookies, no tracking',
    privacy: 'No cookies, no visit statistics, no trackers.',
    note: 'Clearing your browser data erases your resumes: export them as JSON to keep a copy. The one exception to "nothing leaves": an image you insert by its address in a free-text section is loaded from its site.',
    start: 'Get started',
  },
)

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Welcome screen, shown on the first visit (then from the top bar's info button). A native
 * <dialog>: focus stays inside, Esc and a click on the backdrop close it. Never printed.
 */
export function WelcomeDialog({ open, onClose }: Props) {
  const t = useStrings(S)
  const ref = useRef<HTMLDialogElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)

  // Follow `open` without a cleanup: StrictMode re-runs effects, and closing in a cleanup would
  // count as the user closing it
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // showModal focuses the first link; the main button is the natural first stop (Enter closes)
      startRef.current?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // not remembered: it will show again next time
    }
    onClose()
  }

  const point = (icon: ReactNode, title: string, body: ReactNode) => (
    <li>
      <span className="welcome-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </li>
  )

  return (
    <dialog
      ref={ref}
      className="welcome"
      aria-labelledby="welcome-title"
      onClose={close}
      // A click on the backdrop lands on the dialog element itself
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <div className="welcome-body">
        <h1 id="welcome-title">
          <span className="brand-logo">CV</span> {t.title}
        </h1>
        <p className="welcome-intro">{t.intro}</p>
        <ul className="welcome-points">
          {point(<Gift size={17} />, t.freeTitle, t.free)}
          {point(
            <CodeXml size={17} />,
            t.openTitle,
            <>
              {t.open}{' '}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                github.com/cfazilleau/CodaCV <ExternalLink size={12} />
              </a>
            </>,
          )}
          {point(<HardDrive size={17} />, t.dataTitle, t.data)}
          {point(<Cookie size={17} />, t.privacyTitle, t.privacy)}
        </ul>
        <p className="welcome-note">{t.note}</p>
        <form method="dialog" className="welcome-actions">
          <button ref={startRef} className="btn btn--primary">
            {t.start}
          </button>
        </form>
      </div>
    </dialog>
  )
}
