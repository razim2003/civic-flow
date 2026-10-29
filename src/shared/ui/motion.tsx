import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { animate, motion, MotionConfig, useInView, useReducedMotion } from 'motion/react'

export const ease = [0.2, 0.8, 0.2, 1] as const

/** Honour the operating-system "reduce motion" preference everywhere. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.45, ease }}>{children}</MotionConfig>
}

/** Soft rise-in for each routed page. */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  return <motion.div key={routeKey} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>{children}</motion.div>
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }
export const riseItem = { hidden: { opacity: 0, y: 16, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease } } }

/** Staggers direct `motion` children that use `riseItem` variants. */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Component = as === 'ul' ? motion.ul : as === 'ol' ? motion.ol : motion.div
  return <Component className={className} variants={container} initial="hidden" animate="show">{children}</Component>
}

/** Reveals content once it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.6, ease, delay }}>{children}</motion.div>
}

const formatNumber = (value: number, decimals: number) => value.toLocaleString('en-LK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/** Counts up to a number once visible; renders the final value immediately for reduced motion. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const show = (current: number) => { node.textContent = formatNumber(current, decimals) }
    if (reduce || !inView) { show(value); return }
    const controls = animate(0, value, { duration: 1.1, ease, onUpdate: show })
    return () => controls.stop()
  }, [value, decimals, inView, reduce])
  return <span ref={ref}>{formatNumber(value, decimals)}</span>
}

/** Animated horizontal bar for simple ratios (0..1). Animates on mount so values never depend on scrolling. */
export function GrowBar({ ratio, color, label }: { ratio: number; color?: string; label: string }) {
  return <div className="bar-track" role="img" aria-label={label}><motion.div className="bar-fill" style={color ? { background: color } : undefined} initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, Math.min(1, ratio)) }} transition={{ duration: 0.9, ease }} /></div>
}
