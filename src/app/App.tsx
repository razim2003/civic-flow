import { lazy, Suspense, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowRight, BarChart3, Bell, BriefcaseBusiness, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Map, Menu, PlusCircle, Send, Tags, UserRound, Users, X } from 'lucide-react'
import { AuthPage, AuthProvider, roleLabels, useAuth } from '../features/auth'
import { useUnreadCount } from '../features/notifications/badge'
import { Brand } from '../shared/ui/Brand'
import { LoadingScreen, Notice } from '../shared/ui/Form'
import { MotionProvider, PageTransition } from '../shared/ui/motion'
import { ThemeToggle } from '../shared/ui/theme'
import { userMessage } from '../shared/errors/message'

const InviteOfficerPage = lazy(() => import('../features/admin').then((module) => ({ default: module.InviteOfficerPage })))
const UsersPage = lazy(() => import('../features/admin').then((module) => ({ default: module.UsersPage })))
const AdminOverview = lazy(() => import('../features/admin').then((module) => ({ default: module.AdminOverview })))
const CategoriesPage = lazy(() => import('../features/categories').then((module) => ({ default: module.CategoriesPage })))
const DispatchPage = lazy(() => import('../features/dispatch').then((module) => ({ default: module.DispatchPage })))
const AnalyticsPage = lazy(() => import('../features/analytics').then((module) => ({ default: module.AnalyticsPage })))
const NotificationsPage = lazy(() => import('../features/notifications').then((module) => ({ default: module.NotificationsPage })))
const ProfilePage = lazy(() => import('../features/profiles').then((module) => ({ default: module.ProfilePage })))
const CitizenOverview = lazy(() => import('../features/complaints').then((module) => ({ default: module.CitizenOverview })))
const MyComplaintsPage = lazy(() => import('../features/complaints').then((module) => ({ default: module.MyComplaintsPage })))
const NewComplaintPage = lazy(() => import('../features/complaints').then((module) => ({ default: module.NewComplaintPage })))
const ComplaintDetailPage = lazy(() => import('../features/complaints').then((module) => ({ default: module.ComplaintDetailPage })))
const OfficerOverview = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerOverview })))
const OfficerQueue = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerQueue })))
const OfficerDetailPage = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerDetailPage })))
const OfficerMapPage = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerMapPage })))
const LandingPage = lazy(() => import('../features/landing').then((module) => ({ default: module.LandingPage })))

// Route guards are user experience only; the database enforces every permission.
function RoleOnly({ role, children, title, text }: { role: 'citizen' | 'officer' | 'administrator'; children: ReactNode; title: string; text: string }) {
  const { profile } = useAuth()
  return profile?.role === role ? children : <section className="panel"><h1>{title}</h1><p>{text}</p><Link className="text-link" to="/workspace">Return to your workspace <ArrowRight size={15} aria-hidden="true" /></Link></section>
}
const OfficerOnly = ({ children }: { children: ReactNode }) => <RoleOnly role="officer" title="Officer access required" text="This workspace is available to Officers provisioned by an Administrator.">{children}</RoleOnly>
const AdminOnly = ({ children }: { children?: ReactNode }) => <RoleOnly role="administrator" title="Administrator access required" text="This page is available to your organization’s administrators.">{children ?? <UsersPage />}</RoleOnly>
const CitizenOnly = ({ children }: { children: ReactNode }) => <RoleOnly role="citizen" title="Citizen access required" text="This page is available to the Citizen who submitted the complaint.">{children}</RoleOnly>

function ProtectedLayout() {
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState('')
  // Below the desktop breakpoint the sidebar is an off-canvas menu.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const unread = useUnreadCount(auth.profile?.role === 'citizen' || auth.profile?.role === 'officer', pathname)
  if (auth.loading) return <LoadingScreen />
  if (!auth.profile) return <Navigate to="/login" replace />
  const profile = auth.profile
  const openMenu = () => { setMenuOpen(true); requestAnimationFrame(() => closeButton.current?.focus()) }
  const closeMenu = (returnFocus = false) => { setMenuOpen(false); if (returnFocus) menuButton.current?.focus() }
  const updates = <NavLink to="/notifications"><Bell size={18} aria-hidden="true" />Updates{unread > 0 && <span className="nav-count" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}</NavLink>
  return <div className={`workspace-layout ${menuOpen ? 'menu-open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape' && menuOpen) closeMenu(true) }}><a className="skip-link" href="#main-content">Skip to content</a>
    <aside id="workspace-menu" className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Workspace menu"><div className="sidebar-top"><Brand light /><button ref={closeButton} type="button" className="sidebar-close" aria-label="Close menu" onClick={() => closeMenu(true)}><X size={18} aria-hidden="true" /></button></div><div className="workspace-label">Your workspace</div>
    <nav aria-label="Main navigation" onClick={(event) => { if (event.target instanceof Element && event.target.closest('a')) closeMenu() }}><NavLink to="/workspace"><LayoutDashboard size={18} aria-hidden="true" />Overview</NavLink>
      {profile.role === 'citizen' && <><NavLink to="/complaints" end><ClipboardList size={18} aria-hidden="true" />My complaints</NavLink><NavLink to="/complaints/new"><PlusCircle size={18} aria-hidden="true" />Make a complaint</NavLink>{updates}</>}
      {profile.role === 'officer' && <><NavLink to="/officer/complaints"><ClipboardList size={18} aria-hidden="true" />Department complaints</NavLink><NavLink to="/officer/assigned"><BriefcaseBusiness size={18} aria-hidden="true" />Assigned to me</NavLink><NavLink to="/officer/map"><Map size={18} aria-hidden="true" />Department map</NavLink>{updates}</>}
      {profile.role === 'administrator' && <><NavLink to="/admin/dispatch"><Send size={18} aria-hidden="true" />Dispatch centre</NavLink><NavLink to="/admin/analytics"><BarChart3 size={18} aria-hidden="true" />Analytics</NavLink><div className="nav-section">Manage</div><NavLink to="/admin/users"><Users size={18} aria-hidden="true" />User management</NavLink><NavLink to="/admin/categories"><Tags size={18} aria-hidden="true" />Service categories</NavLink></>}
      <NavLink to="/profile"><UserRound size={18} aria-hidden="true" />Profile settings</NavLink></nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><CircleHelp size={19} aria-hidden="true" /><strong>Every voice makes a difference.</strong><p>Thank you for being part of a more responsive community.</p></div><button className="signout" onClick={() => void auth.logout().catch((error: unknown) => setLogoutError(userMessage(error)))}><LogOut size={17} aria-hidden="true" />Sign out</button></div>
  </aside><div className="sidebar-backdrop" aria-hidden="true" onClick={() => closeMenu()} />
    <div className="workspace-main"><header className="workspace-header"><div className="header-start"><button ref={menuButton} type="button" className="icon-button menu-button" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="workspace-menu" onClick={openMenu}><Menu size={18} aria-hidden="true" />{unread > 0 && <i className="menu-dot" aria-hidden="true" />}</button><span className="header-brand"><Brand /></span><span className="workspace-role"><span className="status-dot" />{roleLabels[profile.role]} workspace</span></div><div className="header-actions"><ThemeToggle /><div className="account-summary"><span>{profile.display_name}</span><span className="avatar" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span></div></div></header>
    <main className="workspace-content" id="main-content">{logoutError && <Notice>{logoutError}</Notice>}<Suspense fallback={<p role="status" className="muted">Opening page…</p>}><PageTransition routeKey={pathname}><Outlet /></PageTransition></Suspense></main><footer className="workspace-footer">CivicFlow · Better services, stronger communities.</footer></div></div>
}

function Overview() {
  const { profile } = useAuth()
  if (!profile) return null
  if (profile.role === 'citizen') return <CitizenOverview />
  if (profile.role === 'officer') return <OfficerOverview />
  return <AdminOverview />
}

function NotFound() {
  return <main className="not-found"><Brand /><span className="eyebrow">Page not found</span><h1>Let’s get you back on track.</h1><p className="muted">The page you’re looking for isn’t here.</p><Link className="button button-primary" to="/workspace">Go to workspace <ArrowRight size={16} aria-hidden="true" /></Link></main>
}

export function App() {
  return <BrowserRouter><MotionProvider><AuthProvider><Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/forgot-password" element={<AuthPage mode="forgot-password" />} /><Route path="/reset-password" element={<AuthPage mode="reset-password" />} /><Route path="/accept-invite" element={<AuthPage mode="set-password" />} /><Route path="/auth/callback" element={<AuthPage callback />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/workspace" element={<Overview />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/admin/users" element={<AdminOnly />} /><Route path="/admin/officers/new" element={<AdminOnly><InviteOfficerPage /></AdminOnly>} /><Route path="/admin/categories" element={<AdminOnly><CategoriesPage /></AdminOnly>} />
      <Route path="/admin/dispatch" element={<AdminOnly><DispatchPage /></AdminOnly>} /><Route path="/admin/analytics" element={<AdminOnly><AnalyticsPage /></AdminOnly>} /><Route path="/admin/complaints/:id" element={<AdminOnly><ComplaintDetailPage backTo="/admin/dispatch" backLabel="Dispatch centre" /></AdminOnly>} />
      <Route path="/complaints" element={<CitizenOnly><MyComplaintsPage /></CitizenOnly>} /><Route path="/complaints/new" element={<CitizenOnly><NewComplaintPage /></CitizenOnly>} /><Route path="/complaints/:id" element={<ComplaintDetailPage />} />
      <Route path="/officer/complaints" element={<OfficerOnly><OfficerQueue /></OfficerOnly>} /><Route path="/officer/assigned" element={<OfficerOnly><OfficerQueue key="mine" mine /></OfficerOnly>} /><Route path="/officer/map" element={<OfficerOnly><OfficerMapPage /></OfficerOnly>} /><Route path="/officer/complaints/:id" element={<OfficerOnly><OfficerDetailPage /></OfficerOnly>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></AuthProvider></MotionProvider></BrowserRouter>
}
