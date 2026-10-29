import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlarmClock, CheckCheck, ClipboardList, Download, Gauge, RefreshCw, Star, TriangleAlert } from 'lucide-react'
import { statuses, statusLabels } from '../../complaints'
import { userMessage } from '../../../shared/errors/message'
import { Notice } from '../../../shared/ui/Form'
import { ease, GrowBar } from '../../../shared/ui/motion'
import { StatCard } from '../../../shared/ui/StatCard'
import { downloadCsv, useAnalytics } from '../application/useAnalytics'
import { monthLabel, summarize } from '../model/analytics'
import type { Analytics } from '../model/analytics'

const statusColor: Record<string, string> = { submitted: 'var(--s-submitted)', under_review: 'var(--s-review)', in_progress: 'var(--s-progress)', resolved: 'var(--s-resolved)', withdrawn: 'var(--s-withdrawn)' }

export function AnalyticsPage() {
  const state = useAnalytics()
  const data = state.data
  const summary = data ? summarize(data) : null
  return <><div className="page-heading heading-with-action"><div><span className="eyebrow">INSIGHTS</span><h1>Service analytics</h1><p>How quickly complaints are handled, where work is piling up and how citizens rate the outcome.</p></div>
    <div className="button-row"><button className="button button-secondary" type="button" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw size={15} aria-hidden="true" />Refresh</button><button className="button button-primary" type="button" disabled={!data} onClick={() => data && downloadCsv(data)}><Download size={15} aria-hidden="true" />Export CSV</button></div></div>
    {state.error ? <Notice>{userMessage(state.error)}</Notice> : null}
    {summary && summary.unstaffed.length > 0 && <Notice><TriangleAlert size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />{summary.unstaffed.length} active {summary.unstaffed.length === 1 ? 'department has' : 'departments have'} no Officers ({summary.unstaffed.map((department) => department.name).join(', ')}). <Link to="/admin/dispatch">Open the Dispatch centre</Link> to route their complaints.</Notice>}
    <div className="complaint-stats">
      <StatCard label="All complaints" value={summary?.total} icon={ClipboardList} loading={state.loading && !data} />
      <StatCard label="Open now" value={summary?.open} icon={Gauge} tone="review" loading={state.loading && !data} />
      <StatCard label="Past service target" value={data?.overdue} icon={AlarmClock} tone="signal" loading={state.loading && !data} />
      <StatCard label="Avg. days to resolve" value={summary?.avgDays ?? undefined} decimals={1} icon={CheckCheck} tone="ok" loading={state.loading && !data} empty="—" />
      <StatCard label="Satisfaction (of 5)" value={data?.satisfaction.average ?? undefined} decimals={1} icon={Star} tone="sun" loading={state.loading && !data} empty="—" />
    </div>
    {data && summary && <div className="analytics-grid" style={{ marginTop: 18 }}>
      <section className="panel span-8"><div className="chart-title"><h2>Submitted vs resolved</h2><span className="muted">Last 6 months</span></div><TrendChart trend={data.trend} /></section>
      <section className="panel span-4"><div className="chart-title"><h2>Resolved on target</h2></div>
        <div className="big-number">{summary.withinTarget === null ? '—' : `${summary.withinTarget}%`}</div>
        <p className="muted">{data.resolution.count ? `${data.resolution.within_target} of ${data.resolution.count} resolved complaints met their priority's service target.` : 'No complaints have been resolved yet.'}</p>
        <div className="chart-title" style={{ marginTop: 18 }}><h2>Open by priority</h2></div>
        <BarList rows={(['urgent', 'high', 'normal', 'low'] as const).map((priority) => ({ label: priority[0].toUpperCase() + priority.slice(1), value: data.priority[priority] ?? 0 }))} color="var(--signal)" />
      </section>
      <section className="panel span-6"><div className="chart-title"><h2>Complaints by status</h2></div>
        <BarList rows={statuses.map((status) => ({ label: statusLabels[status], value: data.status[status] ?? 0, color: statusColor[status] }))} />
      </section>
      <section className="panel span-6"><div className="chart-title"><h2>Complaints by category</h2><span className="muted">total</span></div>
        <BarList rows={data.categories.map((category) => ({ label: `${category.name}${category.is_active ? '' : ' (inactive)'}`, value: category.total }))} />
      </section>
      <section className="panel span-7"><div className="chart-title"><h2>Department coverage</h2><Link className="text-link" style={{ margin: 0 }} to="/admin/dispatch">Dispatch centre</Link></div>
        <div className="table-wrap"><table><caption className="sr-only">Officers, open, unassigned and overdue complaints per department</caption><thead><tr><th>Department</th><th>Officers</th><th>Open</th><th>Unassigned</th><th>Past target</th></tr></thead><tbody>{data.departments.filter((department) => department.is_active).map((department) => <tr key={department.id}><td><strong>{department.name}</strong>{department.officers === 0 && <small style={{ color: 'var(--signal)' }}>No Officers</small>}</td><td>{department.officers}</td><td>{department.open}</td><td>{department.unassigned}</td><td>{department.overdue}</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel span-5"><div className="chart-title"><h2>Officer workload</h2><span className="muted">open assignments</span></div>
        {data.officers.length ? <BarList rows={data.officers.map((officer) => ({ label: officer.display_name, value: officer.open, note: `${officer.resolved} resolved` }))} color="var(--s-review)" /> : <p className="muted">No active Officers yet.</p>}
      </section>
      <section className="panel span-12"><div className="chart-title"><h2>Citizen satisfaction</h2><span className="muted">{data.satisfaction.count} ratings</span></div>
        <BarList rows={['5', '4', '3', '2', '1'].map((rating) => ({ label: `${rating} star${rating === '1' ? '' : 's'}`, value: data.satisfaction.distribution[rating] ?? 0 }))} color="var(--sun)" />
      </section>
    </div>}
    {data && <p className="muted" style={{ marginTop: 18 }}>Figures generated {new Date(data.generated_at).toLocaleString('en-LK')}. Service targets: urgent 1 day, high 3 days, normal 7 days, low 14 days.</p>}
  </>
}

function BarList({ rows, color }: { rows: { label: string; value: number; color?: string; note?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return <div className="bar-list">{rows.map((row) => <div className="bar-row" key={row.label} title={row.note}><span>{row.label}</span><GrowBar ratio={row.value / max} color={row.color ?? color} label={`${row.label}: ${row.value}`} /><strong>{row.value}</strong></div>)}</div>
}

/** Grouped bars, one axis, two validated series; hover shows exact values. */
function TrendChart({ trend }: { trend: Analytics['trend'] }) {
  const [active, setActive] = useState<number | null>(null)
  const width = 640, height = 230, top = 24, bottom = 30, left = 28
  const max = Math.max(1, ...trend.flatMap((month) => [month.submitted, month.resolved]))
  const ticks = [0, Math.ceil(max / 2), max]
  const group = (width - left) / Math.max(1, trend.length), bar = Math.min(22, group / 3.4)
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max)
  return <>
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Complaints submitted and resolved per month for the last six months" onMouseLeave={() => setActive(null)}>
      {ticks.map((tick) => <g key={tick}><line x1={left} x2={width} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeDasharray={tick ? '3 4' : undefined} /><text x={0} y={y(tick) + 4}>{tick}</text></g>)}
      {trend.map((month, index) => {
        const x = left + index * group + group / 2
        return <g key={month.month} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} tabIndex={0} aria-label={`${monthLabel(month.month)}: ${month.submitted} submitted, ${month.resolved} resolved`}>
          <rect x={x - group / 2} y={top} width={group} height={height - top - bottom} fill={active === index ? 'var(--surface-2)' : 'transparent'} />
          {([['submitted', 'var(--series-1)', -bar - 1], ['resolved', 'var(--series-2)', 1]] as const).map(([key, fill, offset]) => {
            const value = month[key], h = y(0) - y(value)
            return <motion.rect key={key} x={x + offset} width={bar} rx={4} fill={fill} initial={{ y: y(0), height: 0 }} animate={{ y: y(value), height: Math.max(0, h) }} transition={{ duration: 0.8, ease, delay: index * 0.06 }} />
          })}
          <text x={x} y={height - 8} textAnchor="middle">{monthLabel(month.month)}</text>
          {active === index && <text x={x} y={Math.max(12, y(Math.max(month.submitted, month.resolved)) - 8)} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 700 }}>{month.submitted} / {month.resolved}</text>}
        </g>
      })}
    </svg>
    <div className="chart-legend"><span><i style={{ background: 'var(--series-1)' }} />Submitted</span><span><i style={{ background: 'var(--series-2)' }} />Resolved</span></div>
    <details style={{ marginTop: 10 }}><summary className="muted" style={{ cursor: 'pointer' }}>Show data table</summary><div className="table-wrap"><table><thead><tr><th>Month</th><th>Submitted</th><th>Resolved</th></tr></thead><tbody>{trend.map((month) => <tr key={month.month}><td>{monthLabel(month.month)} {month.month.slice(0, 4)}</td><td>{month.submitted}</td><td>{month.resolved}</td></tr>)}</tbody></table></div></details>
  </>
}
