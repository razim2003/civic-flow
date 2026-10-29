import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BarChart3, BellRing, MapPinned, Route, ShieldCheck, Star } from 'lucide-react'
import { useAuth } from '../../auth'
import { Brand } from '../../../shared/ui/Brand'
import { ease, Reveal } from '../../../shared/ui/motion'
import { ThemeToggle } from '../../../shared/ui/theme'

const features = [
  { icon: MapPinned, title: 'Pin it, describe it', text: 'Drop a pin on the map or use your current location, add photos, and your report is saved with a reference you can track.' },
  { icon: Route, title: 'Routed to an owner', text: 'Each category routes to its department, and the Officer with the lightest workload is assigned straight away.' },
  { icon: BellRing, title: 'Never wonder again', text: 'Every review, assignment and progress note lands in your Updates inbox and on a transit-style progress line.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Your complaint, photos and history are visible only to you and the team handling it — enforced in the database itself.' },
  { icon: BarChart3, title: 'Accountable service', text: 'Every priority has a service target. Late work is flagged, and administrators see coverage gaps before citizens feel them.' },
  { icon: Star, title: 'Close the loop', text: 'When the work is done you rate the outcome, so departments learn what good service looks like.' },
]
const journey = [['Submitted', 'done', '09:12'], ['Assigned to Officer', 'done', '09:12'], ['Under review', 'done', '10:40'], ['In progress', 'now', 'today'], ['Resolved', '', '']] as const

export function LandingPage() {
  const { profile } = useAuth()
  return <div className="landing">
    <header className="landing-nav"><Brand /><div className="button-row" style={{ alignItems: 'center' }}><ThemeToggle />{profile ? <Link className="button button-primary" to="/workspace">Open workspace <ArrowRight size={16} aria-hidden="true" /></Link> : <><Link className="button button-ghost" to="/login">Sign in</Link><Link className="button button-primary" to="/register">Report an issue <ArrowRight size={16} aria-hidden="true" /></Link></>}</div></header>
    <main>
      <section className="landing-hero">
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
          <span className="eyebrow">PUBLIC SERVICE COMPLAINTS · SOUTHERN PROVINCE PROTOTYPE</span>
          <h1>Report it once.<br /><em>Watch it</em> get fixed.</h1>
          <p>CivicFlow gives every pothole, broken pipe and missed collection a ticket, an owner and a deadline — and keeps you updated until it's resolved.</p>
          <div className="button-row" style={{ marginTop: 28 }}><Link className="button button-primary" to={profile ? '/workspace' : '/register'}>{profile ? 'Go to your workspace' : 'Create a free account'} <ArrowRight size={16} aria-hidden="true" /></Link><a className="button button-secondary" href="#how">How it works</a></div>
        </motion.div>
        <motion.aside className="hero-ticket" aria-label="Example complaint journey" initial={{ opacity: 0, y: 40, rotate: 6 }} animate={{ opacity: 1, y: 0, rotate: 2 }} transition={{ duration: 0.9, ease, delay: 0.15 }}>
          <span className="complaint-reference">CF-7Q2A91D4</span>
          <h3>Burst water main on Galle Road</h3>
          <p style={{ margin: 0, color: 'var(--night-muted)', fontSize: 14 }}>Water supply · high priority · due in 2 days</p>
          <ol>{journey.map(([label, state, time], index) => <motion.li key={label} className={state} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + index * 0.15, ease }}><i />{label}{time && <span>{time}</span>}</motion.li>)}</ol>
        </motion.aside>
      </section>
      <div className="marquee" aria-hidden="true"><div className="marquee-track">{[0, 1].map((copy) => <span key={copy}>{['Road maintenance', 'Waste management', 'Water supply', 'Sanitation', 'Public transport', 'Street lighting', 'Other public services'].map((item) => <span key={item}>{item}</span>)}</span>)}</div></div>
      <section className="landing-band" id="how">
        <Reveal><h2>One clear path from complaint to resolution.</h2></Reveal>
        <div className="landing-features">{features.map(({ icon: Icon, title, text }, index) => <Reveal key={title} delay={index * 0.06} className="landing-feature"><Icon size={26} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></Reveal>)}</div>
      </section>
      <section className="landing-roles" aria-label="Who uses CivicFlow">
        {[['01', 'Citizens', ['Report with a map pin and photos', 'Follow every step and get updates', 'Withdraw or rate the outcome']], ['02', 'Officers', ['Work arrives already assigned', 'Department queue, map and filters', 'Service targets keep priorities honest']], ['03', 'Administrators', ['Invite Officers and manage access', 'Dispatch work out of unstaffed teams', 'Analytics and CSV export']]].map(([number, title, items]) => <Reveal key={String(title)} className="landing-role"><span>{number}</span><h3>{title}</h3><ul>{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul></Reveal>)}
      </section>
      <Reveal className="landing-cta"><h2>Your street, your report, your update.</h2><Link className="button button-light" to={profile ? '/workspace' : '/register'}>{profile ? 'Open workspace' : 'Get started'} <ArrowRight size={16} aria-hidden="true" /></Link></Reveal>
    </main>
    <footer className="landing-footer"><span>© {new Date().getFullYear()} CivicFlow · ICT2232 Group 15, University of Ruhuna</span><span>Prototype using fictional demonstration data.</span></footer>
  </div>
}
