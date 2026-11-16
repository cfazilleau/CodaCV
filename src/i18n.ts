import { useSyncExternalStore } from 'react'

/**
 * Editor UI language (not the resume's language, which is `resume.meta.locale`, see locale.ts).
 * Strings live next to the code that uses them:
 *
 *   const S = defineStrings({ save: 'Enregistrer', pages: (n: number) => `${n} pages` }, { save: 'Save', pages: (n) => `${n} pages` })
 *   const t = useStrings(S)   // in a component (re-renders when the language changes)
 *   strings(S).save           // outside React (alerts, store messages…)
 */
export type UiLang = 'fr' | 'en'

export const UI_LANGS: { value: UiLang; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

const KEY = 'codacv.uiLang'

const isLang = (v: unknown): v is UiLang => v === 'fr' || v === 'en'

function initialLang(): UiLang {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLang(saved)) return saved
  } catch {
    // storage blocked: fall back to the browser language
  }
  return /^fr\b/i.test(navigator.language) ? 'fr' : 'en'
}

let lang: UiLang = initialLang()
const listeners = new Set<() => void>()

function emit(next: UiLang) {
  if (next === lang) return
  lang = next
  listeners.forEach((f) => f())
}

export const getUiLang = (): UiLang => lang

export function setUiLang(next: UiLang) {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // not remembered, still applied
  }
  emit(next)
}

// Follow a change made in another tab
window.addEventListener('storage', (e) => {
  if (e.key === KEY && isLang(e.newValue)) emit(e.newValue)
})

function subscribe(f: () => void) {
  listeners.add(f)
  return () => listeners.delete(f)
}

export function useUiLang(): UiLang {
  return useSyncExternalStore(subscribe, getUiLang)
}

export type Strings<T> = Record<UiLang, T>

/** French first (the reference); the English table must have the same shape. */
export function defineStrings<T>(fr: T, en: NoInfer<T>): Strings<T> {
  return { fr, en }
}

export function useStrings<T>(s: Strings<T>): T {
  return s[useUiLang()]
}

/** Current-language table, for code outside React components. */
export function strings<T>(s: Strings<T>): T {
  return s[lang]
}
