import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { CountUp, riseItem } from './motion'

export type StatTone = 'brand' | 'signal' | 'sun' | 'review' | 'ok' | 'withdrawn'

/** Headline number with animated count-up; renders a placeholder while loading. */
export function StatCard({ label, value, icon: Icon, tone = 'brand', loading = false, decimals = 0, empty = '—' }: { label: string; value: number | undefined; icon: LucideIcon; tone?: StatTone; loading?: boolean; decimals?: number; empty?: string }) {
  return <motion.section variants={riseItem} initial="hidden" animate="show" className={`stat-card tone-${tone}`}>
    <span className="stat-icon"><Icon size={18} aria-hidden="true" /></span><span>{label}</span>
    <strong>{loading ? '…' : value === undefined ? empty : <CountUp value={value} decimals={decimals} />}</strong>
  </motion.section>
}
