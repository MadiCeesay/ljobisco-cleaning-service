import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, ClipboardList, CalendarDays, MessageSquare, Check, ArrowUpRight, FileCheck2, CreditCard } from 'lucide-react';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './styles.css';
import { BusinessWhatsApp } from './components/WhatsAppAction';
import { useServices } from './services/useServices';
import ServiceCard from './components/ServiceCard';
import { ServicesPage, ServiceDetailsPage, AboutPage, ContactPage, NotFoundPage } from './pages/PublicPages';
import { AuthPage, ProtectedCustomer, DashboardLayout, LogoutButton } from './features/customer/AccountPages';
import { DashboardOverview, BookingsPage, BookingDetailsPage, ProfilePage } from './features/customer/DashboardPages';
import { BookingRequest } from './features/customer/BookingRequest';
import { useAuth } from './features/customer/authStore';
function lazyPage(loader, name) {
  const Page = lazy(() => loader().then(module => ({ default: module[name] })));
  return function WorkspacePage(props) { return <Suspense fallback={<div className="section" role="status">Loading workspace…</div>}><Page {...props} /></Suspense>; };
}
const QuotationsPage = lazyPage(() => import('./features/quotations/QuotationPages'), 'QuotationsPage');
const QuotationDetailsPage = lazyPage(() => import('./features/quotations/QuotationPages'), 'QuotationDetailsPage');
const PaymentSelectionPage = lazyPage(() => import('./features/payments/PaymentPages'), 'CleaningPaymentsPage');
const MessagingPage = lazyPage(() => import('./features/quotations/MessagingPage'), 'MessagingPage');
const AdministratorAccess = lazyPage(() => import('./features/quotations/AdminQuotationEditor'), 'AdministratorAccess');
const ProtectedAdministrator = lazyPage(() => import('./features/quotations/AdminQuotationEditor'), 'ProtectedAdministrator');
const AdministratorLayout = lazyPage(() => import('./features/admin/AdminLayout'), 'AdminLayout');
const AdminQuotationsPage = lazyPage(() => import('./features/admin/AdminPages'), 'AdminQuotationWorkspace');
const AdminOverview = lazyPage(() => import('./features/admin/AdminPages'), 'AdminOverview');
const AdminBookingsPage = lazyPage(() => import('./features/admin/AdminPages'), 'AdminBookingsPage');
const AdminBookingDetails = lazyPage(() => import('./features/admin/AdminPages'), 'AdminBookingDetails');
const AdminCustomersPage = lazyPage(() => import('./features/admin/AdminPages'), 'AdminCustomersPage');
const AdminCustomerDetails = lazyPage(() => import('./features/admin/AdminPages'), 'AdminCustomerDetails');
const AdminPaymentsPage = lazyPage(() => import('./features/admin/AdminPages'), 'AdminPaymentsPage');
const AdminConversationWorkspace = lazyPage(() => import('./features/admin/AdminPages'), 'AdminConversationWorkspace');
const AdminServicesPage = lazyPage(() => import('./features/admin/CataloguePages'), 'AdminServicesPage');
const AdminSettingsPage = lazyPage(() => import('./features/admin/SettingsPage'), 'AdminSettingsPage');

function PublicChrome({ children }) { const { pathname } = useLocation(); return (pathname === '/admin' || pathname.startsWith('/admin/')) && pathname !== '/admin/login' ? null : children; }

const navigation = [['Home', '/'], ['Services', '/services'], ['About', '/about'], ['Contact', '/contact']];

function Brand() {
  const [hasLogo, setHasLogo] = useState(true);
  return <Link to="/" className="brand" aria-label="Ijobisco Cleaning Services home">
    {hasLogo ? <img src="/images/ijobisco-logo.jpeg" alt="Ijobisco Cleaning Services — Sparkles Starts Here" width="1080" height="1080" onError={() => setHasLogo(false)} /> : <span className="brand-placeholder"><strong>IJOBISCO<span>Cleaning Services</span></strong><small>Temporary wordmark · official logo pending</small></span>}
  </Link>;
}

function Action({ to = '/request-quote', children = 'Request a Quote', variant = 'primary', className = '' }) {
  return <Link className={`button button-${variant} ${className}`} to={to}>{children}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

function Header() {
  const user = useAuth(state => state.user);
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event) {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  return <header className="header">
    <div className="header-inner">
      <Brand />
      <nav className="desktop-nav" aria-label="Main navigation">{navigation.map(([label, href]) => <Link key={label} to={href} aria-current={location.pathname === href || (href !== '/' && location.pathname.startsWith(`${href}/`)) ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className="header-actions">{user ? <div className="header-account"><Link to={user.role === 'ADMIN' ? '/admin/quotations' : '/dashboard'} className="login-link">My Account</Link><LogoutButton /></div> : <Link className="login-link" to="/login">Customer Login</Link>}<Action className="header-quote" /><button className="menu-toggle" ref={menuButton} type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
    </div>
    {open && <nav className="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">{navigation.map(([label, href]) => <Link key={label} to={href}>{label}<ArrowUpRight size={16} /></Link>)}{user ? <><Link to={user.role === 'ADMIN' ? '/admin/quotations' : '/dashboard'}>My Account</Link><LogoutButton /></> : <Link to="/login">Customer Login</Link>}<Action /></nav>}
  </header>;
}

function Hero() {
  return <section className="hero" aria-labelledby="hero-title">
    <img className="hero-image" src="/images/hero-office.webp" alt="Cleaning team in blue uniforms wiping desks, vacuuming and mopping a bright modern office" width="1536" height="1024" fetchPriority="high" />
    <div className="hero-overlay" />
    <div className="hero-content">
      <h1 id="hero-title">A Cleaner Space.<br />A Better Everyday.</h1>
      <p>Professional home and commercial cleaning services<br className="desktop-break" /> tailored to your needs.</p>
      <div className="hero-actions"><Action /><Action to="/#services" variant="white">Explore Services</Action></div>
    </div>
  </section>;
}

function Home() {
  const services = useServices();
  return <>
    <Hero />
    <section className="section services" id="services" aria-labelledby="services-title">
      <div className="section-heading"><div><span className="eyebrow">OUR SERVICES</span><h2 id="services-title">A fresh approach to every space.</h2></div><p>From the place you call home to the place you do your best work. Find a clean that fits.</p></div>
      <p className="development-note">Proposed service categories — subject to confirmation by Ijobisco.</p>
      <div className="service-grid">{services.map(service => <ServiceCard key={service.slug} service={service} variant="home" />)}</div>
    </section>
    <section className="process-section" id="how-it-works" aria-labelledby="process-title"><div className="section">
      <div className="process-heading"><h2 id="process-title">How It Works</h2><p>Your cleaning journey, made simple.</p></div>
      <ol className="process-grid">{[
        [ClipboardList, '01', 'Request', 'Choose a service and share your cleaning requirements.'],
        [FileCheck2, '02', 'Get a Quote', 'Receive a quotation prepared by an administrator.'],
        [MessageSquare, '03', 'Discuss', 'Ask questions or negotiate the price.'],
        [Check, '04', 'Accept', 'Approve the final official quotation.'],
        [CreditCard, '05', 'Pay', 'Choose a 30% deposit or full payment.'],
        [CalendarDays, '06', 'Schedule', 'Confirm your cleaning date with Ijobisco.'],
      ].map(([Icon, number, title, text]) => <li key={number}><div className="process-icon"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /><span aria-hidden="true">{number}</span></div><h3>{title}</h3><p>{text}</p></li>)}</ol>
    </div></section>
    <section className="section about-section" id="about" aria-labelledby="about-title"><div className="about-photo"><img src="/images/why-ijobisco.jpg" alt="Two cleaners in work uniforms vacuuming and mopping a contemporary living room" width="1200" height="1800" loading="lazy" decoding="async" /></div><div className="about-content"><span className="eyebrow">WHY IJOBISCO</span><h2 id="about-title">Your space. Your needs.<br />A thoughtful clean.</h2><p>Ijobisco Cleaning Services is a cleaning services business based in The Gambia. Our starting point is simple: understanding what your space needs.</p><ul>{['Cleaning tailored to your requirements', 'Preferred dates that work around you', 'A clear quotation and discussion process'].map(item => <li key={item}><Check size={18} aria-hidden="true" />{item}</li>)}</ul><Action /></div></section>
    <section className="final-cta"><span className="eyebrow">SPARKLES STARTS HERE</span><h2>Ready for a Cleaner Space?</h2><p>Let’s start with what you need.</p><Action /></section>
  </>;
}

const plannedPages = {
  '/privacy': ['Privacy Policy', 'The business-approved privacy policy will be added before the website goes live. Do not submit real customer information until the business approves privacy and retention policies.'],
  '/terms': ['Terms of Service', 'The business-approved terms of service will be added before the website goes live.'],
};

function PreviewPage() {
  const { pathname } = useLocation();
  const [title, description] = plannedPages[pathname] || ['Page not found', 'This page is not available in the local homepage preview.'];
  return <section className="preview-page section"><span className="eyebrow">LOCAL DESIGN PREVIEW</span><h1>{title}</h1><p>{description}</p><Action to="/#services" variant="primary">Explore Services</Action><Link className="back-link" to="/">Back to homepage</Link></section>;
}

function Footer() {
  return <footer className="footer"><div className="footer-main section"><div><Brand /><p>Professional cleaning services<br />for homes and businesses in The Gambia.</p><BusinessWhatsApp /><span className="footer-tagline">Sparkles Starts Here</span></div><div><h3>Explore</h3><Link to="/">Home</Link><Link to="/services">Services</Link></div><div><h3>Ijobisco</h3><Link to="/about">About us</Link><Link to="/contact">Contact</Link><Link to="/request-quote">Request a Quote</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Ijobisco Cleaning Services.</span><div><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/admin/login">Administrator Login</Link></div></div></footer>;
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const target = document.getElementById(hash ? hash.slice(1) : 'main-content');
    if (hash && target) { target.setAttribute('tabindex', '-1'); target.scrollIntoView(); }
    else window.scrollTo(0, 0);
    target?.focus({ preventScroll: true });
  }, [pathname, hash]);
  return null;
}

function App() {
  return <BrowserRouter><ScrollManager /><a className="skip-link" href="#main-content">Skip to content</a><PublicChrome><Header /></PublicChrome><main id="main-content" tabIndex={-1}><Routes><Route path="/" element={<Home />} /><Route path="/services" element={<ServicesPage />} /><Route path="/services/:slug" element={<ServiceDetailsPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} />{['register', 'login', 'forgot-password', 'reset-password', 'verify-email'].map(mode => <Route key={mode} path={`/${mode}`} element={<AuthPage key={mode} mode={mode} />} />)}<Route path="/admin/login" element={<AdministratorAccess />} /><Route element={<ProtectedAdministrator />}><Route path="/admin" element={<AdministratorLayout />}><Route index element={<AdminOverview />} /><Route path="bookings" element={<AdminBookingsPage />} /><Route path="bookings/:id" element={<AdminBookingDetails />} /><Route path="services" element={<AdminServicesPage />} /><Route path="customers" element={<AdminCustomersPage />} /><Route path="customers/:id" element={<AdminCustomerDetails />} /><Route path="payments" element={<AdminPaymentsPage />} /><Route path="settings" element={<AdminSettingsPage />} /><Route path="quotations" element={<AdminQuotationsPage />} /><Route path="quotations/:id" element={<QuotationDetailsPage />} /><Route path="messages" element={<AdminConversationWorkspace />} /><Route path="messages/:bookingId" element={<AdminConversationWorkspace />} /></Route></Route><Route path="/request-quote" element={<QuoteRedirect />} /><Route element={<ProtectedCustomer />}><Route path="/bookings/new" element={<BookingRequest />} /><Route path="/dashboard" element={<DashboardLayout />}><Route index element={<DashboardOverview />} /><Route path="bookings" element={<BookingsPage />} /><Route path="bookings/:id" element={<BookingDetailsPage />} /><Route path="quotations" element={<QuotationsPage />} /><Route path="quotations/:id" element={<QuotationDetailsPage />} /><Route path="messages" element={<MessagingPage />} /><Route path="messages/:bookingId" element={<MessagingPage />} /><Route path="payments" element={<PaymentSelectionPage />} /><Route path="profile" element={<ProfilePage />} /></Route></Route>{Object.keys(plannedPages).map(path => <Route key={path} path={path} element={<PreviewPage />} />)}{['/shop', '/shop/*', '/cart', '/checkout', '/dashboard/orders', '/dashboard/orders/*', '/admin/products', '/admin/orders', '/admin/orders/*'].map(path => <Route key={path} path={path} element={<Navigate replace to="/services" />} />)}<Route path="*" element={<NotFoundPage />} /></Routes></main><PublicChrome><Footer /></PublicChrome></BrowserRouter>;
}

function QuoteRedirect() {
  const location = useLocation();
  return <Navigate replace to={`/bookings/new${location.search}`} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
