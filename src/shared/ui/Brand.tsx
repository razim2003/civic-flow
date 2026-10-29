import { Link } from 'react-router-dom'

/** Mark: a route line passing two stops and ending in a check — a complaint's journey to resolution. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return <svg className="brand-mark" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
    <rect width="40" height="40" rx="12" fill="currentColor" />
    <path d="M9 27c6 0 6-14 12-14s5 9 10 9" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="9" cy="27" r="3.2" fill="#fff" /><circle cx="21" cy="13" r="3.2" fill="#fff" />
    <path d="m27.5 21.5 2.6 2.6 5-5.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

export function Brand({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return <Link to={to} className={`brand ${light ? 'brand-light' : ''}`} aria-label="CivicFlow home">
    <BrandMark />
    <span>Civic<span className="brand-flow">Flow</span><span className="brand-dot">.</span></span>
  </Link>
}
