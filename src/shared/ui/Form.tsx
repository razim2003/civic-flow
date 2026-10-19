import type { InputHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

export function Field({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = props.id ?? props.name
  return <div className="field"><label htmlFor={id}>{label}</label><input {...props} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}{hint && !error && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
  </div>
}

export function Notice({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <div className={`notice ${success ? 'notice-success' : ''}`} role={success ? 'status' : 'alert'}>{children}</div>
}

export function SubmitButton({ children, busy, disabled = false }: { children: ReactNode; busy: boolean; disabled?: boolean }) {
  return <button className="button button-primary" type="submit" disabled={busy || disabled}>{busy && <LoaderCircle size={17} className="spin" aria-hidden="true" />}{busy ? 'Please wait…' : children}</button>
}

export function LoadingScreen() {
  return <div className="loading-screen" role="status"><LoaderCircle className="spin" size={26} aria-hidden="true" /><span>Opening your workspace…</span></div>
}
