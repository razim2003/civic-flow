import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowRight, Bell, CircleHelp, ClipboardList, LayoutDashboard, LogOut, PlusCircle, Tags, UserRound, Users, BriefcaseBusiness } from 'lucide-react'
import { AuthPage, AuthProvider, roleLabels, useAuth } from '../features/auth'
import { useUnreadCount } from '../features/notifications/badge'
import { Brand } from '../shared/ui/Brand'
import { LoadingScreen, Notice } from '../shared/ui/Form'
import { userMessage } from '../shared/errors/message'

const InviteOfficerPage = lazy(() => import('../features/admin').then((module) => ({ default: module.InviteOfficerPage })))
const UsersPage = lazy(() => import('../features/admin').then((module) => ({ default: module.UsersPage })))
const AdminOverview = lazy(() => import('../features/admin').then((module) => ({ default: module.AdminOverview })))
const CategoriesPage = lazy(() => import('../features/categories').then((module) => ({ default: module.CategoriesPage })))
const NotificationsPage = lazy(() => import('../features/notifications').then((module) => ({ default: module.NotificationsPage })))
const ProfilePage = lazy(() => import('../features/profiles').then((module) => ({ default: module.ProfilePage })))
const CitizenOverview = lazy(() => import('../features/complaints').then((module) => ({ default: module.CitizenOverview })))
const MyComplaintsPage = lazy(() => import('../features/complaints').then((module) => ({ default: module.MyComplaintsPage })))
const NewComplaintPage = lazy(() => import('../features/complaints').then((module) => ({ default: module.NewComplaintPage })))
const ComplaintDetailPage = lazy(() => import('../features/complaints').then((module) => ({ default: module.ComplaintDetailPage })))

const OfficerOverview = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerOverview })))
const OfficerQueue = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerQueue })))
const OfficerDetailPage = lazy(() => import('../features/officer').then((module) => ({ default: module.OfficerDetailPage })))

function OfficerOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  return profile?.role === 'officer' ? children : <section className="panel"><h1>Officer access required</h1><p>This workspace is available to Officers provisioned by an Administrator.</p><Link className="text-link" to="/workspace">Return to your workspace</Link></section>
}

function CitizenOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  return profile?.role === 'citizen' ? children : <section className="panel"><h1>Citizen access required</h1><p>Complaint updates are available to the Citizen who submitted the complaint.</p><Link className="text-link" to="/workspace">Return to your workspace</Link></section>
}

function ProtectedLayout() {
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const { pathname } = useLocation()
  const unread = useUnreadCount(auth.profile?.role === 'citizen', pathname)
  if (auth.loading) return <LoadingScreen />
  if (!auth.profile) return <Navigate to="/login" replace />
  const profile = auth.profile
  return <div className="workspace-layout"><a className="skip-link" href="#main-content">Skip to content</a><aside className="sidebar"><Brand /><div className="workspace-label">YOUR WORKSPACE</div>
    <nav aria-label="Main navigation"><NavLink to="/workspace"><LayoutDashboard size={18} aria-hidden="true" />Overview</NavLink>{profile.role === 'citizen' && <><NavLink to="/complaints" end><ClipboardList size={18} aria-hidden="true" />My complaints</NavLink><NavLink to="/complaints/new"><PlusCircle size={18} aria-hidden="true" />Make a complaint</NavLink><NavLink to="/notifications"><Bell size={18} aria-hidden="true" />Updates{unread > 0 && <span className="nav-count" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}</NavLink></>}{profile.role === 'officer' && <><NavLink to="/officer/complaints"><ClipboardList size={18} aria-hidden="true" />Department complaints</NavLink><NavLink to="/officer/assigned"><BriefcaseBusiness size={18} aria-hidden="true" />Assigned to me</NavLink></>}{profile.role === 'administrator' && <><NavLink to="/admin/users"><Users size={18} aria-hidden="true" />User management</NavLink><NavLink to="/admin/categories"><Tags size={18} aria-hidden="true" />Service categories</NavLink></>}<NavLink to="/profile"><UserRound size={18} aria-hidden="true" />Profile settings</NavLink></nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><CircleHelp size={19} aria-hidden="true" /><strong>Every voice makes a difference.</strong><p>Thank you for being part of a more responsive community.</p></div><button className="signout" onClick={() => void auth.logout().catch((error: unknown) => setLogoutError(userMessage(error)))}><LogOut size={17} aria-hidden="true" />Sign out</button></div>
  </aside><div className="workspace-main"><header className="workspace-header"><span><span className="status-dot" />{roleLabels[profile.role]} workspace</span><div className="account-summary"><span>{profile.display_name}</span><span className="avatar" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span></div></header><main className="workspace-content" id="main-content">{logoutError && <Notice>{logoutError}</Notice>}<Suspense fallback={<p role="status">Opening page…</p>}><Outlet /></Suspense></main><footer className="workspace-footer">CivicFlow · Better services, stronger communities.</footer></div></div>
}

function Overview() {
  const { profile } = useAuth()
  if (!profile) return null
  if (profile.role === 'citizen') return <CitizenOverview />
  if (profile.role === 'officer') return <OfficerOverview />
  return <AdminOverview />
}

function AdminOnly({ children }: { children?: ReactNode }) {
  const { profile } = useAuth()
  return profile?.role === 'administrator' ? children ?? <UsersPage /> : <section className="panel"><h1>Administrator access required</h1><p>This page is available to your organization’s administrators.</p><Link className="text-link" to="/workspace">Return to your workspace <ArrowRight size={15} /></Link></section>
}

function NotFound() {
  return <main className="not-found"><Brand /><span className="eyebrow">PAGE NOT FOUND</span><h1>Let’s get you back on track.</h1><p>The page you’re looking for isn’t here.</p><Link className="button button-primary" to="/workspace">Go to workspace <ArrowRight size={16} /></Link></main>
}

export function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/" element={<Navigate to="/login" replace />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/forgot-password" element={<AuthPage mode="forgot-password" />} /><Route path="/reset-password" element={<AuthPage mode="reset-password" />} /><Route path="/accept-invite" element={<AuthPage mode="set-password" />} /><Route path="/auth/callback" element={<AuthPage callback />} /><Route element={<ProtectedLayout />}><Route path="/workspace" element={<Overview />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/admin/users" element={<AdminOnly />} /><Route path="/admin/officers/new" element={<AdminOnly><InviteOfficerPage /></AdminOnly>} /><Route path="/admin/categories" element={<AdminOnly><CategoriesPage /></AdminOnly>} /><Route path="/notifications" element={<CitizenOnly><NotificationsPage /></CitizenOnly>} /><Route path="/complaints" element={<MyComplaintsPage />} /><Route path="/complaints/new" element={<NewComplaintPage />} /><Route path="/complaints/:id" element={<ComplaintDetailPage />} /><Route path="/officer/complaints" element={<OfficerOnly><OfficerQueue /></OfficerOnly>} /><Route path="/officer/assigned" element={<OfficerOnly><OfficerQueue key="mine" mine /></OfficerOnly>} /><Route path="/officer/complaints/:id" element={<OfficerOnly><OfficerDetailPage /></OfficerOnly>} /></Route><Route path="*" element={<NotFound />} /></Routes></AuthProvider></BrowserRouter>
}
