import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { ArrowRight, Building2, CircleHelp, LayoutDashboard, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react'
import { AuthPage, AuthProvider, roleLabels, useAuth } from '../features/auth'
import { Brand } from '../shared/ui/Brand'
import { LoadingScreen, Notice } from '../shared/ui/Form'
import { userMessage } from '../shared/errors/message'

const UsersPage = lazy(() => import('../features/admin').then((module) => ({ default: module.UsersPage })))
const ProfilePage = lazy(() => import('../features/profiles').then((module) => ({ default: module.ProfilePage })))

function ProtectedLayout() {
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState('')
  if (auth.loading) return <LoadingScreen />
  if (!auth.profile) return <Navigate to="/login" replace />
  const profile = auth.profile
  return <div className="workspace-layout"><a className="skip-link" href="#main-content">Skip to content</a><aside className="sidebar"><Brand /><div className="workspace-label">YOUR WORKSPACE</div>
    <nav aria-label="Main navigation"><NavLink to="/workspace"><LayoutDashboard size={18} aria-hidden="true" />Overview</NavLink>{profile.role === 'administrator' && <NavLink to="/admin/users"><Users size={18} aria-hidden="true" />User management</NavLink>}<NavLink to="/profile"><UserRound size={18} aria-hidden="true" />Profile settings</NavLink></nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><CircleHelp size={19} aria-hidden="true" /><strong>Every voice makes a difference.</strong><p>Thank you for being part of a more responsive community.</p></div><button className="signout" onClick={() => void auth.logout().catch((error: unknown) => setLogoutError(userMessage(error)))}><LogOut size={17} aria-hidden="true" />Sign out</button></div>
  </aside><div className="workspace-main"><header className="workspace-header"><span><span className="status-dot" />{roleLabels[profile.role]} workspace</span><div className="account-summary"><span>{profile.display_name}</span><span className="avatar" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span></div></header><main className="workspace-content" id="main-content">{logoutError && <Notice>{logoutError}</Notice>}<Suspense fallback={<p role="status">Opening page…</p>}><Outlet /></Suspense></main><footer className="workspace-footer">CivicFlow · Better services, stronger communities.</footer></div></div>
}

function Overview() {
  const { profile } = useAuth()
  if (!profile) return null
  const admin = profile.role === 'administrator'
  const officer = profile.role === 'officer'
  return <><div className="page-heading"><span className="eyebrow">A BETTER COMMUNITY STARTS HERE</span><h1>Hello, {profile.display_name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>{admin ? 'Manage access and help your public service team work together.' : officer ? 'Your space to support citizens and keep public services moving.' : 'Your voice helps make your community a better place.'}</p></div>
    <section className="welcome-panel"><div><span className="pill"><ShieldCheck size={14} aria-hidden="true" /> You’re connected</span><h2>{admin ? 'A stronger team. A better service.' : officer ? 'Public service, with purpose.' : 'Small actions can create real change.'}</h2><p>{admin ? 'Give the right people the right access. Citizen, Officer and Administrator roles keep everyone focused on their part.' : officer ? 'Your account is ready. Complaint review and resolution tools will appear here as the service becomes available.' : 'Your account is ready. Complaint submission and tracking will be available here soon.'}</p><Link className="button button-light" to={admin ? '/admin/users' : '/profile'}>{admin ? 'Manage users' : 'View your profile'}<ArrowRight size={16} aria-hidden="true" /></Link></div><Building2 className="welcome-icon" size={126} strokeWidth={1} aria-hidden="true" /></section>
    <div className="overview-grid"><section className="panel"><span className="card-icon"><UserRound size={20} aria-hidden="true" /></span><h2>Your account</h2><p className="muted">Signed in as {roleLabels[profile.role].toLowerCase()}.</p><div className="detail-row"><span>Account status</span><span className="badge">Active</span></div><div className="detail-row"><span>Display name</span><strong>{profile.display_name}</strong></div><Link className="text-link" to="/profile">Manage profile <ArrowRight size={15} aria-hidden="true" /></Link></section><section className="panel"><span className="card-icon"><ShieldCheck size={20} aria-hidden="true" /></span><h2>A space you can trust</h2><p className="muted">Your account gives you access to the information and actions meant for your role.</p><p className="muted">For your privacy, you’ll sign in again after refreshing or closing this page.</p></section></div>
  </>
}

function AdminOnly() {
  const { profile } = useAuth()
  return profile?.role === 'administrator' ? <UsersPage /> : <section className="panel"><h1>Administrator access required</h1><p>This page is available to your organization’s administrators.</p><Link className="text-link" to="/workspace">Return to your workspace <ArrowRight size={15} /></Link></section>
}

function NotFound() {
  return <main className="not-found"><Brand /><span className="eyebrow">PAGE NOT FOUND</span><h1>Let’s get you back on track.</h1><p>The page you’re looking for isn’t here.</p><Link className="button button-primary" to="/workspace">Go to workspace <ArrowRight size={16} /></Link></main>
}

export function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/" element={<Navigate to="/login" replace />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/forgot-password" element={<AuthPage mode="forgot-password" />} /><Route path="/reset-password" element={<AuthPage mode="reset-password" />} /><Route path="/auth/callback" element={<AuthPage callback />} /><Route element={<ProtectedLayout />}><Route path="/workspace" element={<Overview />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/admin/users" element={<AdminOnly />} /></Route><Route path="*" element={<NotFound />} /></Routes></AuthProvider></BrowserRouter>
}
