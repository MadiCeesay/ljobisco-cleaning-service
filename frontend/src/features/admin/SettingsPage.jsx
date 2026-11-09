import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAdmin } from './AdminLayout';
import { AdminHeading, useConfirmation } from './components';
import { settingsSchema } from './rules';
import { CustomerField } from '../customer/AccountPages';

function SettingsForm() {
  const { data, mutate, demo } = useAdmin();
  const [feedback, setFeedback] = useState('');
  const confirmation = useConfirmation();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(settingsSchema), defaultValues: { whatsappNumber: '', ...data.settings, depositPercentage: String(data.settings.depositPercentage), deliveryFee: data.settings.deliveryFee == null ? '' : String(data.settings.deliveryFee) } });
  const field = (name, label, type = 'text', extra = {}) => <CustomerField key={name} name={name} label={label} type={type} register={register} errors={errors} {...extra} />;
  return <><form noValidate onSubmit={handleSubmit(values => confirmation.confirm({ title: 'Save business settings?', description: `Deposit preview: ${values.depositPercentage}%\n${demo ? 'Development-only settings. No live company information is published.' : 'The backend must authorize and confirm this configuration.'}`, onConfirm: async () => { await mutate('settings', { values, expectedRevision: data.settingsRevision }); setFeedback('The administrator adapter confirmed the settings update.'); } }))}><section className="admin-panel"><h2>Company identity and contact</h2><p className="admin-info-note">Enter only business-approved details. Blank contact information remains unavailable; no fictional contact details are supplied.</p><div className="admin-form-grid">{field('companyName', 'Company name')}{field('tagline', 'Approved tagline')}{field('email', 'Business email (optional)', 'email')}{field('phone', 'Business phone (optional)', 'tel')}{field('whatsappNumber', 'Official WhatsApp number (optional)', 'tel', { hint: 'Use + and the country code. Leave blank to use the approved Ijobisco number +2205393273.' })}<div className="admin-form-full">{field('address', 'Business address (optional)', 'textarea')}</div><div className="admin-form-full">{field('serviceAreas', 'Approved service areas', 'textarea')}</div></div></section><section className="admin-panel"><h2>Cleaning deposit</h2><div className="admin-form-grid">{field('depositPercentage', 'Deposit percentage', 'number', { min: '0.01', max: '100', step: '.01' })}</div><p className="admin-info-note">Default 30%. Frontend amounts remain previews. The backend must validate the applicable percentage and calculate actual payment amounts; settings must not reprice an already issued payment request.</p></section><button className="button button-primary" type="submit">Review Settings</button></form><p role="status" className="admin-info-note">{feedback}</p>{confirmation.dialog}</>;
}
export function AdminSettingsPage() { return <><AdminHeading title="Business settings" description="Manage business details, service areas and cleaning deposit settings." /><SettingsForm /></>; }
