import { ArrowLeft, ArrowRight, Check, CircleCheck, Eye, EyeOff, FileText, LocateFixed, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../application/AuthProvider'
import { useAuthForm } from '../application/useAuthForm'
import type { AuthMode } from '../application/useAuthForm'
import { Brand } from '../../../shared/ui/Brand'
import { Field, LoadingScreen, Notice, SubmitButton } from '../../../shared/ui/Form'
import { ThemeToggle } from '../../../shared/ui/theme'

const content = {
  login: { eyebrow: 'YOUR COMMUNITY. YOUR VOICE.', title: 'Welcome back.', description: 'Sign in to stay connected with your community.', action: 'Sign in' },
  register: { eyebrow: 'SMALL ACTIONS. REAL CHANGE.', title: 'Make a difference.', description: 'Create your citizen account to get started.', action: 'Create account' },
  'forgot-password': { eyebrow: 'LET’S GET YOU BACK IN.', title: 'Forgot your password?', description: 'Enter your email and we’ll send you a reset link.', action: 'Send reset link' },
  'reset-password': { eyebrow: 'A FRESH START.', title: 'Set a new password.', description: 'Choose a strong password for your account.', action: 'Update password' },
  'set-password': { eyebrow: 'WELCOME TO CIVICFLOW.', title: 'Set up your account.', description: 'Choose your own password to accept your account invitation.', action: 'Set password' },
}

/** A route line drawing itself between stops, with a service vehicle travelling along it. */
function TransitIllustration() {
  const route = 'M50 150 C 140 150, 140 60, 230 60 S 340 140, 420 110 S 520 40, 560 70'
  return <svg className="transit-art" viewBox="0 0 610 190" fill="none" aria-hidden="true">
    <path d={route} stroke="#ffffff14" strokeWidth="14" strokeLinecap="round" />
    <path className="route" d={route} stroke="url(#route-gradient)" strokeWidth="5" strokeLinecap="round" />
    <defs><linearGradient id="route-gradient" x1="0" x2="610" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#4fbf8f" /><stop offset="1" stopColor="#df5a2b" /></linearGradient></defs>
    {[[50, 150, 'Reported'], [230, 60, 'Assigned'], [420, 110, 'In progress'], [560, 70, 'Resolved']].map(([x, y, label], index) => <g key={String(label)}>
      <circle className="stop" style={{ animationDelay: `${0.6 + index * 0.7}s` }} cx={Number(x)} cy={Number(y)} r="9" fill="#0f1a17" stroke={index === 3 ? '#df5a2b' : '#4fbf8f'} strokeWidth="4" />
      <text x={Number(x)} y={Number(y) + (index % 2 ? -20 : 32)} textAnchor="middle" fill="#8fa59b" fontSize="13" fontWeight="600">{label}</text>
    </g>)}
    <circle className="bus" r="5" fill="#e8a92f" style={{ offsetPath: `path("${route}")` }} />
  </svg>
}

export function AuthPage({ mode = 'login', callback = false }: { mode?: AuthMode; callback?: boolean }) {
  const auth = useAuth()
  const form = useAuthForm(mode)
  const [showPassword, setShowPassword] = useState(false)
  const copy = content[mode]
  const passwordSetup = mode === 'reset-password' || mode === 'set-password'
  if (auth.loading) return <LoadingScreen />
  if (auth.profile && !passwordSetup) return <Navigate to="/workspace" replace />
  const blocked = !!auth.userId && !auth.profile && !passwordSetup
  const invalidRecovery = mode === 'reset-password' && (!auth.userId || !auth.recovery)
  const invalidInvitation = mode === 'set-password' && !auth.userId
  return <main className="auth-layout">
    <section className="auth-story" aria-label="About CivicFlow">
      <Brand light />
      <div className="story-content"><span className="story-tag"><span /> Live service updates</span>
        <h1>Report it once.<br /><span>Watch it<br className="desktop-break" /> get fixed.</span></h1>
        <p>Every complaint gets a reference, a responsible Officer and a service target, and you see each step as it happens.</p>
        <div className="story-steps">{[
          { icon: FileText, title: 'Raise a concern', text: 'Pin it on the map and describe it.' },
          { icon: LocateFixed, title: 'Routed to an owner', text: 'Assigned to the right Officer instantly.' },
          { icon: CircleCheck, title: 'See it resolved', text: 'Updates at every step, then rate the result.' },
        ].map(({ icon: Icon, title, text }) => <div className="story-step" key={title}><span className="step-icon"><Icon size={19} aria-hidden="true" /></span><div><strong>{title}</strong><span>{text}</span></div><Check size={15} className="step-check" aria-hidden="true" /></div>)}</div>
      </div>
      <TransitIllustration />
      <div className="story-footer"><ShieldCheck size={15} aria-hidden="true" /> Built on trust. Designed for everyone.</div>
    </section>
    <section className="auth-main" aria-label="Account access">
      <div className="auth-top"><span>PUBLIC SERVICE, MADE SIMPLE</span><span className="button-row" style={{ alignItems: 'center' }}><ThemeToggle /><span className="secure-label"><LockKeyhole size={13} aria-hidden="true" /> Secure access</span></span></div>
      <div className="auth-card" key={mode}>
        <span className="eyebrow">{copy.eyebrow}</span><h2>{blocked ? 'Your account needs attention.' : copy.title}</h2>
        <p className="auth-description">{blocked ? 'We could not open your workspace. You can retry or sign out.' : copy.description}</p>
        {blocked ? <><Notice>{auth.error ?? 'Account access is unavailable.'}</Notice><div className="button-row"><button className="button button-primary" onClick={() => void auth.refreshProfile()}>Try again</button><button className="button button-secondary" onClick={() => void auth.logout().catch(() => undefined)}>Sign out</button></div></> : invalidRecovery ? <><Notice>Your reset link is missing or has expired. Request a new link to continue.</Notice><Link className="text-link" to="/forgot-password">Request another reset link <ArrowRight size={15} aria-hidden="true" /></Link></> : invalidInvitation ? <><Notice>Your invitation link is missing or has expired. Ask your Administrator for help, or use password recovery if your account already exists.</Notice><Link className="text-link" to="/forgot-password">Recover account access</Link></> : <>
          {(mode === 'login' || mode === 'register') && <nav className="auth-tabs" aria-label="Choose account action"><Link to="/login" aria-current={mode === 'login' ? 'page' : undefined}>Sign in</Link><Link to="/register" aria-current={mode === 'register' ? 'page' : undefined}>Create account</Link></nav>}
          {callback && !auth.userId && <Notice success>Return here to sign in after completing email verification. If your link expired, request a new one by registering again.</Notice>}
          {form.error && <Notice>{form.error}</Notice>}{form.success && <Notice success>{form.success}</Notice>}
          <form noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(event.currentTarget) }}>
            {mode === 'register' && <Field label="Full name" name="displayName" autoComplete="name" placeholder="Your full name" maxLength={100} error={form.errors.displayName} />}
            {!passwordSetup && <Field label="Email address" type="email" name="email" autoComplete="email" placeholder="you@example.com" maxLength={254} error={form.errors.email} />}
            {mode !== 'forgot-password' && <div className="password-field"><Field label={passwordSetup ? 'New password' : 'Password'} type={showPassword ? 'text' : 'password'} name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Enter your password' : 'At least 12 characters'} maxLength={128} error={form.errors.password} hint={mode === 'register' ? 'Use at least 12 characters for a stronger password.' : undefined} /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}
            {passwordSetup && <Field label="Confirm new password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} error={form.errors.confirmPassword} />}
            {mode === 'login' && <div className="form-help"><span><ShieldCheck size={14} aria-hidden="true" /> Your information stays protected</span><Link to="/forgot-password">Forgot password?</Link></div>}
            <SubmitButton busy={form.busy}>{copy.action}<ArrowRight size={17} aria-hidden="true" /></SubmitButton>
          </form>
          {mode === 'register' && <p className="form-note">This creates a Citizen account. Officer and administrator access is managed by your organization.</p>}
          {passwordSetup && form.success && <Link to="/workspace" className="text-link">Go to workspace <ArrowRight size={15} /></Link>}
          {mode === 'forgot-password' && <Link to="/login" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</Link>}
          {mode === 'login' && <p className="auth-alternative">New to CivicFlow? <Link to="/register">Join your community <ArrowRight size={14} aria-hidden="true" /></Link></p>}
        </>}
        <div className="auth-trust"><span className="trust-line" /><ShieldCheck size={16} aria-hidden="true" /><span>Your voice matters. Your privacy does too.</span><span className="trust-line" /></div>
      </div>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} CivicFlow</span><span>Connecting communities. Improving services.</span></footer>
    </section>
  </main>
}
