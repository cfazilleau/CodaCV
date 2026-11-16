import { useSyncExternalStore } from 'react'

/** Phones: the editor and the preview take the whole screen in turn (Edit / Preview switch). */
export const PHONE = '(max-width: 700px)'
/** Touch screens (no hover): the on-page layout tools follow the selected section, not the pointer. */
export const TOUCH = '(hover: none)'

/** Whether a CSS media query matches, updated live. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
