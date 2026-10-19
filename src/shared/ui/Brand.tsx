import { Link } from 'react-router-dom'

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="CivicFlow home">
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true"><rect width="40" height="40" rx="11" fill="currentColor" /><path d="M27 13a10 10 0 1 0 0 14" fill="none" stroke="#bde8c3" strokeWidth="4" strokeLinecap="round" /><path d="m22 20 4 4 7-8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span>Civic<span className="brand-flow">Flow</span><span className="brand-dot">.</span></span>
  </Link>
}
