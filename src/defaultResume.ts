import type { Resume } from './types'
import { getUiLang, type UiLang } from './i18n'

/** "- " bullet lines of a timeline description */
const bullets = (...lines: string[]) => lines.map((l) => `- ${l}`).join('\n')

/**
 * Example resume shown on first launch, by "Partir du modèle" and "Réinitialiser", in French or
 * English. Deliberately generic (a digital project manager) and fictional: names, companies, links
 * (example.com), and the phone number (French range reserved for fiction).
 */
export function templateResume(lang: UiLang = getUiLang()): Resume {
  const L = (fr: string, en: string) => (lang === 'fr' ? fr : en)
  return {
    version: 1,
    meta: { locale: lang, fileName: L('AlexMartin-ChefDeProjet-CV-FR', 'AlexMartin-ProjectManager-Resume-EN') },
    profile: {
      name: 'Alex MARTIN',
      title: L('Chef de projet digital', 'Digital Project Manager'),
      photo: '',
      summary: L(
        "Chef de projet avec huit ans d'expérience entre agence et entreprise, habitué à piloter des équipes pluridisciplinaires, des budgets et des lancements, du cadrage jusqu'au suivi des résultats.",
        'Project manager with eight years of agency and in-house experience, used to leading cross-functional teams, budgets and launches, from scoping to measuring results.',
      ),
      summaryIcon: 'pin',
      contacts: [
        { id: 'c1', icon: 'link', label: 'example.com', url: 'https://example.com' },
        { id: 'c2', icon: 'linkedin', label: 'linkedin.com/in/alex-martin', url: 'https://www.linkedin.com/in/alex-martin-example/' },
        { id: 'c3', icon: 'phone', label: L('06 39 98 12 34', '+33 6 39 98 12 34'), url: '' },
        { id: 'c4', icon: 'mail', label: 'alex.martin@example.com', url: '' },
      ],
    },
    sections: [
      {
        id: 'languages',
        kind: 'list',
        title: L('Langues', 'Languages'),
        visible: true,
        place: 'row',
        colWidth: 0.1452, // lines up with the date column
        items: [
          { id: 'l1', text: L('Français', 'French'), hidden: false },
          { id: 'l2', text: L('Anglais', 'English'), hidden: false },
          { id: 'l3', text: L('Espagnol', 'Spanish'), hidden: false },
        ],
      },
      {
        id: 'skills',
        kind: 'list',
        title: L('Compétences', 'Skills'),
        visible: true,
        place: 'column',
        colWidth: 0.8548,
        items: [
          { id: 's1', text: L('Gestion de projet : cadrage, planning, budget, suivi des risques', 'Project management: scoping, planning, budget, risk tracking'), hidden: false },
          { id: 's2', text: L('Méthodes agiles (Scrum, Kanban) et cycle en V', 'Agile (Scrum, Kanban) and waterfall methods'), hidden: false },
          { id: 's3', text: L('Animation d’équipes pluridisciplinaires et relation client', 'Leading cross-functional teams and client relations'), hidden: false },
          { id: 's4', text: L('Analyse de données et indicateurs de performance (KPI)', 'Data analysis and key performance indicators (KPIs)'), hidden: false },
          { id: 's5', text: L('Outils : Jira, Notion, Excel avancé, Figma, Google Analytics', 'Tools: Jira, Notion, advanced Excel, Figma, Google Analytics'), hidden: false },
        ],
      },
      {
        id: 'experience',
        kind: 'timeline',
        title: L('Expérience', 'Experience'),
        visible: true,
        place: 'row',
        entries: [
          {
            id: 'e1',
            start: '2022/09/01',
            end: '',
            current: true,
            subDate: '',
            country: 'fr',
            location: 'Lyon',
            title: 'Groupe Horizon',
            subtitle: L('Chef de projet digital', 'Digital Project Manager'),
            url: 'https://example.com/horizon',
            description: bullets(
              L('Pilotage de la refonte du site e-commerce : équipe de 9 personnes, budget de 400 k€', 'Led the e-commerce website redesign: team of 9, €400k budget'),
              L('Mise en place des rituels agiles et d’un tableau de bord de suivi partagé avec la direction', 'Set up agile rituals and a progress dashboard shared with senior management'),
              L('Coordination des prestataires et des équipes marketing, IT et service client', 'Coordinated vendors and the marketing, IT and customer service teams'),
              L('Hausse de 18 % du taux de conversion dans les six mois suivant le lancement', '18% increase in conversion rate within six months of launch'),
            ),
            hidden: false,
          },
          {
            id: 'e2',
            start: '2019/03/01',
            end: '2022/08/31',
            current: false,
            subDate: '',
            country: 'ca',
            location: 'Montréal',
            title: 'Agence Nova',
            subtitle: L('Chef de projet', 'Project Manager'),
            url: 'https://example.com/nova',
            description: bullets(
              L('Gestion simultanée de 5 à 8 projets clients (sites, applications, campagnes)', 'Managed 5 to 8 client projects at a time (websites, apps, campaigns)'),
              L('Rédaction des cahiers des charges, estimation des charges et suivi de la rentabilité', 'Wrote specifications, estimated workloads and tracked profitability'),
              L('Interlocuteur principal des clients, de l’avant-vente à la recette', 'Main client contact, from pre-sales to acceptance testing'),
            ),
            hidden: false,
          },
          {
            id: 'e3',
            start: '2017/09/01',
            end: '2019/02/28',
            current: false,
            subDate: '',
            country: 'be',
            location: L('Bruxelles', 'Brussels'),
            title: 'Atelier Lumen',
            subtitle: L('Assistant chef de projet', 'Assistant Project Manager'),
            url: '',
            description: bullets(
              L('Suivi de planning et de budget sur des projets de communication', 'Tracked schedules and budgets on communication projects'),
              L('Organisation des recettes et des retours utilisateurs', 'Organised acceptance testing and user feedback sessions'),
            ),
            hidden: false,
          },
        ],
      },
      {
        id: 'projects',
        kind: 'timeline',
        title: L('Projets notables', 'Key projects'),
        visible: true,
        place: 'row',
        entries: [
          {
            id: 'p1',
            start: '2023/01/01',
            end: '2023/08/31',
            current: false,
            subDate: L('8 mois', '8 months'),
            country: '',
            location: '',
            title: L('Refonte e-commerce', 'E-commerce redesign'),
            subtitle: 'Groupe Horizon',
            url: 'https://example.com/refonte',
            description: bullets(
              L('Migration de 12 000 produits et de l’historique client sans interruption de service', 'Migrated 12,000 products and the customer history with no downtime'),
              L('Nouveau parcours de commande testé auprès de 40 utilisateurs', 'New checkout flow tested with 40 users'),
            ),
            hidden: false,
          },
          {
            id: 'p2',
            start: '2021/02/01',
            end: '2021/05/31',
            current: false,
            subDate: L('4 mois', '4 months'),
            country: '',
            location: '',
            title: L('Application de réservation', 'Booking app'),
            subtitle: L('Client du secteur culturel - Agence Nova', 'Cultural sector client - Agence Nova'),
            url: 'https://example.com/reservation',
            description: bullets(
              L('Lancement d’une application mobile utilisée par 30 000 visiteurs la première année', 'Launched a mobile app used by 30,000 visitors in its first year'),
              L('Livraison dans les délais et le budget, avec trois itérations courtes', 'Delivered on time and on budget, in three short iterations'),
            ),
            hidden: false,
          },
        ],
      },
      {
        id: 'education',
        kind: 'timeline',
        title: L('Formation', 'Education'),
        visible: true,
        place: 'row',
        entries: [
          {
            id: 'f1',
            start: '2015/09/01',
            end: '2017/06/30',
            current: false,
            subDate: '',
            country: 'fr',
            location: 'Paris',
            title: L('Master Management de projet', 'Master’s degree in Project Management'),
            subtitle: 'École de Commerce et de Gestion',
            url: '',
            description: bullets(
              L('Diplôme de niveau 7 (Bac +5)', 'Level 7 degree (EQF)'),
              L('Gestion de projet, marketing digital, finance d’entreprise', 'Project management, digital marketing, corporate finance'),
            ),
            hidden: false,
          },
          {
            id: 'f2',
            start: '2012/09/01',
            end: '2015/06/30',
            current: false,
            subDate: '',
            country: 'fr',
            location: 'Lyon',
            title: L('Licence Information et Communication', 'Bachelor’s degree in Information and Communication'),
            subtitle: 'Université Lumière',
            url: '',
            description: '',
            hidden: false,
          },
        ],
      },
    ],
    theme: {
      accent: '#1d4f7c',
      text: '#19222c',
      font: 'source-sans',
      fontSize: 10,
      density: 'normal',
      showPhoto: true,
      photoShape: 'circle',
      photoSize: 27,
      dateColumn: 27,
      marginX: 10,
      marginY: 10,
      showLinkIcons: true,
      headerStyle: 'classic',
      titleStyle: 'underline',
      entryStyle: 'left',
      photoRing: false,
      photoInitials: true,
      dateFormat: 'year',
    },
  }
}

/** Reference values for `validateResume()` defaults (language-independent fields only are read from it). */
export const defaultResume: Resume = templateResume('fr')
