import type { ReactNode } from 'react'
import {
  AtSign,
  Award,
  Briefcase,
  Calendar,
  Car,
  Code,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  House,
  Languages,
  Link,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Smartphone,
  Star,
  User,
} from 'lucide-react'
import type { IconKey } from '../types'
import { defineStrings, strings } from '../i18n'

type P = { size?: number }

const filled = (size: number, children: ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
)

const LinkedinIcon = ({ size = 12 }: P) =>
  filled(
    size,
    <path d="M5.3 8.2h3v10h-3v-10Zm1.5-4.9a1.8 1.8 0 1 1 0 3.5 1.8 1.8 0 0 1 0-3.5Zm3.4 4.9h2.9v1.4c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7v5.5h-3v-4.9c0-1.2 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5v5h-3v-10Z" />,
  )

const GithubIcon = ({ size = 12 }: P) =>
  filled(
    size,
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />,
  )

const XIcon = ({ size = 12 }: P) =>
  filled(size, <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />)

const YoutubeIcon = ({ size = 12 }: P) =>
  filled(
    size,
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />,
  )

export const ExternalIcon = ({ size = 10 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
)

const stroke = 2.6

/** Every icon available for contacts and the summary line, in picker order. */
export const ICONS: { key: IconKey; render: (size: number) => ReactNode }[] = [
  { key: 'link', render: (s) => <Link size={s} strokeWidth={stroke} /> },
  { key: 'globe', render: (s) => <Globe size={s} strokeWidth={stroke} /> },
  { key: 'mail', render: (s) => <Mail size={s} strokeWidth={stroke} /> },
  { key: 'at', render: (s) => <AtSign size={s} strokeWidth={stroke} /> },
  { key: 'phone', render: (s) => <Phone size={s} strokeWidth={stroke} /> },
  { key: 'smartphone', render: (s) => <Smartphone size={s} strokeWidth={stroke} /> },
  { key: 'pin', render: (s) => <MapPin size={s} strokeWidth={stroke} /> },
  { key: 'house', render: (s) => <House size={s} strokeWidth={stroke} /> },
  { key: 'linkedin', render: (s) => <LinkedinIcon size={s} /> },
  { key: 'github', render: (s) => <GithubIcon size={s} /> },
  { key: 'x', render: (s) => <XIcon size={s} /> },
  { key: 'youtube', render: (s) => <YoutubeIcon size={s} /> },
  { key: 'message', render: (s) => <MessageCircle size={s} strokeWidth={stroke} /> },
  { key: 'briefcase', render: (s) => <Briefcase size={s} strokeWidth={stroke} /> },
  { key: 'code', render: (s) => <Code size={s} strokeWidth={stroke} /> },
  { key: 'gamepad', render: (s) => <Gamepad2 size={s} strokeWidth={stroke} /> },
  { key: 'user', render: (s) => <User size={s} strokeWidth={stroke} /> },
  { key: 'calendar', render: (s) => <Calendar size={s} strokeWidth={stroke} /> },
  { key: 'car', render: (s) => <Car size={s} strokeWidth={stroke} /> },
  { key: 'languages', render: (s) => <Languages size={s} strokeWidth={stroke} /> },
  { key: 'graduation', render: (s) => <GraduationCap size={s} strokeWidth={stroke} /> },
  { key: 'award', render: (s) => <Award size={s} strokeWidth={stroke} /> },
  { key: 'star', render: (s) => <Star size={s} strokeWidth={stroke} /> },
  { key: 'heart', render: (s) => <Heart size={s} strokeWidth={stroke} /> },
]

const BY_KEY = new Map(ICONS.map((i) => [i.key, i]))

/** Icon names shown in the picker (tooltips), per UI language. */
export const ICON_LABELS = defineStrings<Record<IconKey, string>>(
  {
    none: 'Aucune icône',
    link: 'Lien / site web',
    globe: 'Globe',
    mail: 'E-mail',
    at: 'Arobase',
    phone: 'Téléphone',
    smartphone: 'Mobile',
    pin: 'Localisation',
    house: 'Adresse',
    linkedin: 'LinkedIn',
    github: 'GitHub',
    x: 'X / Twitter',
    youtube: 'YouTube',
    message: 'Messagerie',
    briefcase: 'Portfolio / travail',
    code: 'Code',
    gamepad: 'Jeux',
    user: 'Profil',
    calendar: 'Date / âge',
    car: 'Permis',
    languages: 'Langues',
    graduation: 'Diplôme',
    award: 'Récompense',
    star: 'Étoile',
    heart: 'Centres d’intérêt',
  },
  {
    none: 'No icon',
    link: 'Link / website',
    globe: 'Globe',
    mail: 'Email',
    at: 'At sign',
    phone: 'Phone',
    smartphone: 'Mobile',
    pin: 'Location',
    house: 'Address',
    linkedin: 'LinkedIn',
    github: 'GitHub',
    x: 'X / Twitter',
    youtube: 'YouTube',
    message: 'Messaging',
    briefcase: 'Portfolio / work',
    code: 'Code',
    gamepad: 'Games',
    user: 'Profile',
    calendar: 'Date / age',
    car: 'Driving licence',
    languages: 'Languages',
    graduation: 'Degree',
    award: 'Award',
    star: 'Star',
    heart: 'Interests',
  },
)

/** Name of an icon in the current UI language (components: prefer `useStrings(ICON_LABELS)`). */
export function iconLabel(key: IconKey): string {
  return strings(ICON_LABELS)[key] ?? key
}

/** Raw glyph for an icon key (null for 'none' / unknown). */
export function Icon({ name, size = 12 }: { name: IconKey; size?: number }) {
  const def = BY_KEY.get(name)
  return def ? <>{def.render(size)}</> : null
}

/** Icon inside the accent-colored circle used on the resume header. */
export function IconBadge({ name, size = 11 }: { name: IconKey; size?: number }) {
  if (name === 'none' || !BY_KEY.has(name)) return null
  return (
    <span className="cv-icon">
      <Icon name={name} size={size} />
    </span>
  )
}
