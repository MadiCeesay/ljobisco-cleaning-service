import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet as RouteOutlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, FileCheck2, MessageSquare, Brush, Users, CreditCard, Settings, Menu, X, Search, RefreshCw, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../customer/authStore';
import { LogoutButton } from '../customer/AccountPages';
import { getAdminWorkspace, adminOperation } from './services';
import './admin.css';

import { AdminContext, useAdmin } from './AdminContext';
export { useAdmin } from './AdminContext';
function Outlet() { return <AdminDataState><RouteOutlet /></AdminDataState>; }
export const adminNavigation = [
  ['Overview', '/admin', LayoutDashboard], ['Bookings', '/admin/bookings', ClipboardList], ['Quotations', '/admin/quotations', FileCheck2], ['WhatsApp support', '/admin/messages', MessageSquare], ['Services', '/admin/services', Brush], ['Customers', '/admin/customers', Users], ['Payments', '/admin/payments', CreditCard], ['Settings', '/admin/settings', Settings],
];
export function AdminDataState({ children }) {
  const admin = useAdmin();
  if (admin.loading && !admin.data) return <div className="admin-empty" role="status">Loading administrator workspace…</div>;
  if (admin.error) return <div className="notice error-notice" role="alert"><h2>Workspace unavailable</h2><p>{admin.error}</p><button className="button button-outline" onClick={admin.refresh}>Try Again</button></div>;
  if (!admin.data) return null;
  return children;
}
export function AdminLayout() {
  const { user, demo, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const toggle = useRef(null);
  const requestSequence = useRef(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { setOpen(false); setSearch(''); }, [location.pathname]);
  useEffect(() => {
    let active = true;
    const request = ++requestSequence.current;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    getAdminWorkspace(demo, user).then(data => { if (active && request === requestSequence.current) setState({ data, loading: false, error: '' }); }).catch(error => { if (active && request === requestSequence.current) setState(previous => ({ ...previous, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [demo, user, revision, location.pathname]);
  useEffect(() => {
    if (!open) return;
    function keydown(event) { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [open]);
  async function mutate(operation, payload, files = []) {
    const record = await adminOperation(operation, payload, files, demo, user);
    const request = ++requestSequence.current;
    const data = await getAdminWorkspace(demo, user);
    if (request === requestSequence.current && useAuth.getState().user === user) setState({ data, loading: false, error: '' });
    return record;
  }
  const current = [...adminNavigation].reverse().find(([, href]) => location.pathname === href || (href !== '/admin' && location.pathname.startsWith(`${href}/`)))?.[0] || 'Overview';
  return <AdminContext.Provider value={{ ...state, demo, user, search, setSearch, refresh, mutate }}><div className="admin-shell"><aside id="administrator-sidebar" className={`admin-sidebar ${open ? 'is-open' : ''}`}><Link className="admin-brand" to="/admin"><img src="/images/ijobisco-logo.jpeg" width="72" height="72" alt="Ijobisco Cleaning Services" /><span>IJOBISCO<small>Administration</small></span></Link><span className="admin-nav-label">WORKSPACE</span><nav aria-label="Administrator navigation">{adminNavigation.map(([label, href, Icon]) => <NavLink key={href} to={href} end={href === '/admin'}><Icon size={19} aria-hidden="true" />{label}</NavLink>)}</nav><div className="admin-sidebar-bottom"><Link to="/">View Website<ArrowUpRight size={16} aria-hidden="true" /></Link><LogoutButton /></div></aside>{open && <button type="button" className="admin-backdrop" aria-label="Close administrator navigation" onClick={() => { setOpen(false); toggle.current?.focus(); }} />}<div className="admin-main"><header className="admin-topbar"><div><button ref={toggle} className="admin-menu-button" aria-expanded={open} aria-controls="administrator-sidebar" aria-label={open ? 'Close administrator menu' : 'Open administrator menu'} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><span>Workspace <span aria-hidden="true">/</span> <strong>{current}</strong></span></div><div className="admin-topbar-actions"><span className="admin-environment">{demo ? 'Development demo' : 'Backend session'}</span><button className="admin-refresh" disabled={state.loading} onClick={refresh} aria-label="Refresh administrator data"><RefreshCw size={18} className={state.loading ? 'admin-spinning' : ''} /></button></div></header><div className="admin-content"><div className="admin-utility"><label className="admin-global-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search current admin list</span><input type="search" placeholder="Search this page…" value={search} onChange={event => setSearch(event.target.value)} /></label>{demo && <button className="button button-outline" disabled={switching} onClick={async () => { setSwitching(true); try { await login({}, true); navigate('/dashboard'); } catch (error) { setSwitchError(error.message); } finally { setSwitching(false); } }}>Switch to Customer Preview</button>}</div>{switchError && <p role="alert" className="field-error">{switchError}</p>}{demo && <div className="admin-demo-banner"><strong>Development-only administrator workspace.</strong> All counts, edits, uploads, schedules and transactions are local demonstrations, not live business records. Nothing is sent to customers or payment providers. Refreshing the browser or logging out resets this workspace.</div>}{state.loading && state.data && <p className="admin-refreshing" role="status">Refreshing data…</p>}<Outlet /></div></div></div></AdminContext.Provider>;
}
