import { useEffect, useRef, type ReactNode } from 'react'

interface BaseProps {
  label?: string
  hint?: ReactNode
  className?: string
}

export function Field({ label, hint, className, children }: BaseProps & { children: ReactNode }) {
  return (
    <label className={`field ${className ?? ''}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <Field {...base}>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/** Textarea that grows with its content. */
export function TextArea({
  value,
  onChange,
  placeholder,
  minRows = 2,
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <Field {...base}>
      <textarea
        ref={ref}
        rows={minRows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/** One bullet per line. Keeps a trailing empty line while typing. */
export function LinesField({
  value,
  onChange,
  ...rest
}: BaseProps & { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return <TextArea {...rest} minRows={3} value={value.join('\n')} onChange={(v) => onChange(v.split('\n'))} />
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span>{label}</span>
    </label>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ...base
}: BaseProps & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <Field {...base}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  ...base
}: BaseProps & { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <Field {...base}>
      <div className="slider">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="slider-value">
          {value}
          {unit}
        </span>
      </div>
    </Field>
  )
}

export function ColorField({ value, onChange, ...base }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <Field {...base}>
      <div className="color-field">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  )
}

export function IconButton({
  title,
  onClick,
  children,
  danger,
  disabled,
}: {
  title: string
  onClick: () => void
  children: ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`icon-btn${danger ? ' icon-btn--danger' : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export const COUNTRIES: { value: string; label: string }[] = [
  { value: '', label: '— Aucun —' },
  { value: 'fr', label: 'France' },
  { value: 'ca', label: 'Canada' },
  { value: 'us', label: 'États-Unis' },
  { value: 'gb', label: 'Royaume-Uni' },
  { value: 'be', label: 'Belgique' },
  { value: 'ch', label: 'Suisse' },
  { value: 'de', label: 'Allemagne' },
  { value: 'es', label: 'Espagne' },
  { value: 'it', label: 'Italie' },
  { value: 'nl', label: 'Pays-Bas' },
  { value: 'se', label: 'Suède' },
  { value: 'fi', label: 'Finlande' },
  { value: 'pl', label: 'Pologne' },
  { value: 'ie', label: 'Irlande' },
  { value: 'pt', label: 'Portugal' },
  { value: 'jp', label: 'Japon' },
  { value: 'kr', label: 'Corée du Sud' },
  { value: 'cn', label: 'Chine' },
  { value: 'au', label: 'Australie' },
  { value: 'sg', label: 'Singapour' },
  { value: 'ro', label: 'Roumanie' },
  { value: 'ua', label: 'Ukraine' },
  { value: 'ma', label: 'Maroc' },
]
