import { demoAvailable } from '../../services/demoMode';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ArrowRight, LogOut, LayoutDashboard, ClipboardList, FileCheck2, MessageSquare, CreditCard, UserRound } from 'lucide-react';
import { authSchema, safeDestination } from './validation';
import { accountAction } from './authService';
import { useAuth } from './authStore';
import { useCustomerData } from './customerData';
import './customer.css';
import { apiConfigured, apiRequest } from '../../services/apiClient';

export function CustomerField({ name, label, register, errors, type = 'text', children, hint, ...props }) {
  const [visible, setVisible] = useState(false);
  const error = errors[name];
  const describedBy = [hint ? `${name}-hint` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined;
  const fieldProps = { id: name, ...register(name), 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, ...props };
  return <div className="field"><label htmlFor={name}>{label}</label>{children ? <select {...fieldProps}>{children}</select> : type === 'textarea' ? <textarea {...fieldProps} rows={4} /> : <div className={type === 'password' ? 'password-input' : ''}><input {...fieldProps} type={type === 'password' && visible ? 'text' : type} />{type === 'password' && <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>}</div>}{hint && <small id={`${name}-hint`} className="field-hint">{hint}</small>}{error && <span id={`${name}-error`} role="alert" className="field-error">{error.message}</span>}</div>;
}

export function DemoBanner() {
  return <div className="notice demo-notice"><p><strong>Development-only customer preview.</strong> This is not secure production authentication. Requests, account changes and attachments stay in memory and reset on refresh or logout. No emails, uploads, orders or payments are sent. Use sample information only.</p>{demoAvailable && <Link className="text-link" to="/admin/login">Open Administrator Preview</Link>}</div>;
}

const headings = { register: ['Create your customer account', 'A cleaner space starts with a simple conversation.'], login: ['Welcome back.', 'Log in to manage your cleaning requests.'], 'forgot-password': ['Forgot your password?', 'Enter your email to request a password reset.'], 'reset-password': ['Choose a new password.', 'Use the reset token from your email.'], 'verify-email': ['Verify your email.', 'Enter the verification token from your email.'] };

function VerificationRequest() {
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(authSchema('forgot-password')), defaultValues: { email: '' } });
  return <section><h2>Need another verification email?</h2><form noValidate onSubmit={handleSubmit(async values => { setMessage(''); try { const response = await apiRequest('/auth/resend-verification', { method: 'POST', body: values }); setMessage(response.message); } catch (error) { setMessage(error.message); } })}><CustomerField name="email" label="Verification email address" type="email" register={register} errors={errors} autoComplete="email" /><button className="button button-outline" disabled={!apiConfigured || isSubmitting}>{isSubmitting ? 'Requesting…' : 'Request Verification Email'}</button></form><p className="form-hint">Email delivery needs configured SMTP. This request does not change your password or claim that an email was delivered.</p><p role="status">{message}</p></section>;
}

export function AuthPage({ mode }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState(null);
  const [verificationRequired, setVerificationRequired] = useState(null);
  useEffect(() => { let active = true; if (apiConfigured) apiRequest('/auth/configuration').then(value => { if (active && typeof value.requireEmailVerification === 'boolean') setVerificationRequired(value.requireEmailVerification); }).catch(() => {}); return () => { active = false; }; }, []);
  const user = useAuth(state => state.user);
  const login = useAuth(state => state.login);
  const destination = safeDestination(params.get('redirect'));
  const authSuffix = `?${new URLSearchParams({ redirect: destination })}`;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(authSchema(mode)), defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', token: params.get('token') || '' } });
  if (mode === 'login' && user) return <Navigate to={user.role === 'ADMIN' ? '/admin/quotations' : destination} replace />;
  async function onSubmit(values) {
    setResult(null);
    try {
      if (mode === 'login') { await login(values, demo); navigate(destination, { replace: true }); return; }
      const response = await accountAction(mode, values, demo);
      if (mode === 'register' && !demo && response.verificationRequired === false) { await login({ email: values.email, password: values.password }, false); navigate(destination, { replace: true }); return; }
      setResult({ success: true, message: demo ? response.message : mode === 'forgot-password' ? 'If your account is eligible, reset instructions have been requested. Please check your email.' : mode === 'register' ? response.message || 'Check your email for verification instructions if this account is eligible.' : mode === 'verify-email' ? 'Your email verification was accepted.' : 'Your password reset was accepted. You can now log in.' });
    } catch (error) { setResult({ success: false, message: error.message }); }
  }
  const [title, description] = headings[mode];
  return <section className="section account-page"><div className="account-intro"><span className="eyebrow">IJOBISCO CUSTOMER ACCOUNTS</span><h1>{title}</h1><p>{description}</p><span className="account-tagline">Sparkles Starts Here</span></div><div className="account-panel">{demoAvailable && <label className="demo-toggle"><input type="checkbox" checked={demo} onChange={event => { setDemo(event.target.checked); setResult(null); }} />Use development demo adapter</label>}{demo ? <DemoBanner /> : <div className="notice"><p>{apiConfigured ? verificationRequired === true ? 'Secure cookies protect your account. Email verification is required before customer login.' : verificationRequired === false ? 'Create your account and get started immediately. Email verification is optional; password recovery still uses email.' : 'Account actions use secure cookies. The backend confirms the current email-verification policy.' : 'Account forms are ready for the backend. Without a connected service, no account is created, email sent or password changed.'}</p></div>}<form noValidate onSubmit={handleSubmit(onSubmit, () => setResult(null))}><fieldset disabled={isSubmitting} className="customer-fieldset">
    {mode === 'register' && <CustomerField name="name" label="Full name" register={register} errors={errors} autoComplete="name" />}
    {['register', 'login', 'forgot-password'].includes(mode) && <CustomerField name="email" label="Email address" type="email" register={register} errors={errors} autoComplete="email" />}
    {['reset-password', 'verify-email'].includes(mode) && <CustomerField name="token" label={mode === 'reset-password' ? 'Reset token' : 'Verification token'} register={register} errors={errors} autoComplete="off" />}
    {['register', 'login', 'reset-password'].includes(mode) && <CustomerField name="password" label="Password" type="password" register={register} errors={errors} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} hint={mode === 'login' ? undefined : 'Use at least 8 characters and at most 72 UTF-8 bytes. A unique passphrase is a good choice.'} />}
    {['register', 'reset-password'].includes(mode) && <CustomerField name="confirmPassword" label="Confirm password" type="password" register={register} errors={errors} autoComplete="new-password" />}
    <button className="button button-primary" type="submit">{isSubmitting ? 'Please wait…' : ({ register: 'Create Customer Account', login: 'Log In', 'forgot-password': 'Request Reset', 'reset-password': 'Reset Password', 'verify-email': 'Verify Email' })[mode]}<ArrowRight size={17} aria-hidden="true" /></button></fieldset></form><div aria-live="polite">{result && <div className={`notice ${result.success ? '' : 'error-notice'}`} role={result.success ? 'status' : 'alert'}><p>{result.message}</p></div>}</div>{mode === 'verify-email' && <VerificationRequest />}<div className="account-links">{mode === 'login' ? <><Link to={`/register${authSuffix}`}>Create a customer account</Link><Link to={`/forgot-password${authSuffix}`}>Forgot password?</Link></> : <Link to={`/login${authSuffix}`}>Back to login</Link>}{mode === 'register' && verificationRequired === true && <Link to={`/verify-email${authSuffix}`}>Verify your email</Link>}{mode === 'forgot-password' && <Link to={`/reset-password${authSuffix}`}>Already have a reset token?</Link>}</div></div></section>;
}

export function ProtectedCustomer() {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="section" role="status">Checking your session…</div>;
  if (!user) return <Navigate to={`/login?${new URLSearchParams({ redirect: location.pathname + location.search })}`} replace />;
  if (user.role !== 'CUSTOMER') return <section className="section"><h1>Customer access required</h1><p>This area is for customer accounts.</p></section>;
  return <Outlet />;
}

export const dashboardLinks = [
  ['/dashboard', 'Overview', LayoutDashboard], ['/dashboard/bookings', 'My Bookings', ClipboardList], ['/dashboard/quotations', 'Quotations', FileCheck2], ['/dashboard/messages', 'WhatsApp support', MessageSquare], ['/dashboard/payments', 'Payments', CreditCard], ['/dashboard/profile', 'Profile', UserRound],
];

export function LogoutButton({ className = '' }) {
  const logout = useAuth(state => state.logout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <><button type="button" className={`logout-button ${className}`} disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await logout(); } catch (error) { setError(error.message); } finally { setBusy(false); } }}><LogOut size={15} aria-hidden="true" />{busy ? 'Logging out…' : 'Log out'}</button>{error && <span className="field-error" role="alert">{error}</span>}</>;
}

export function DashboardLayout() {
  const { user, demo } = useAuth();
  const load = useCustomerData(state => state.load);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { load(demo); }, [load, demo, user.id]);
  const current = dashboardLinks.find(([path]) => path !== '/dashboard' && location.pathname.startsWith(path))?.[0] || '/dashboard';
  return <div className="customer-shell"><aside className="customer-sidebar"><span className="eyebrow">YOUR IJOBISCO</span><strong>{user.name}</strong><nav aria-label="Customer dashboard">{dashboardLinks.map(([path, label, Icon]) => <NavLink key={path} to={path} end={path === '/dashboard'}><Icon size={18} aria-hidden="true" />{label}</NavLink>)}</nav><LogoutButton /></aside><div className="customer-main"><div className="customer-mobile-nav"><label htmlFor="customer-navigation">Customer navigation</label><select id="customer-navigation" value={current} onChange={event => navigate(event.target.value)}>{dashboardLinks.map(([path, label]) => <option key={path} value={path}>{label}</option>)}</select></div>{demo && <DemoBanner />}<Outlet /></div></div>;
}
