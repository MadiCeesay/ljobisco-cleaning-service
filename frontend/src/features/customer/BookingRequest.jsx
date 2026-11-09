import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react';
import { CustomerField, DemoBanner } from './AccountPages';
import { bookingSchema, localDate, MAX_PHOTOS, photoError } from './validation';
import { useBookingDraft } from './draft';
import { useAuth } from './authStore';
import { useCustomerData } from './customerData';
import { submitBooking } from './services';
import { useServices } from '../../services/useServices';
import { BusinessWhatsApp } from '../../components/WhatsAppAction';

const steps = ['Your clean', 'Location & contact', 'Review & send'];
const stepFields = [['service', 'rooms', 'description'], ['contactPhone', 'address', 'town', 'date'], []];

export function BookingRequest() {
  const demo = useAuth(state => state.demo);
  const user = useAuth(state => state.user);
  const services = useServices(demo);
  const [params] = useSearchParams();
  const selectedService = services.find(service => service.slug === params.get('service') || service.name === params.get('service'))?.slug;
  const draft = useBookingDraft();
  const navigate = useNavigate();
  const [photoMessage, setPhotoMessage] = useState('');
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState([]);
  const titleRef = useRef(null);
  const { register, handleSubmit, trigger, watch, getValues, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { ...draft.values, size: '', requirements: '', directions: '', time: 'Flexible', contactPhone: draft.values.contactPhone || user.phone || '', service: draft.values.service || selectedService || '' },
    shouldUnregister: false,
  });
  useEffect(() => { useBookingDraft.getState().setValues(getValues()); const subscription = watch(values => useBookingDraft.getState().setValues(values)); return () => subscription.unsubscribe(); }, [watch, getValues]);
  useEffect(() => {
    const next = draft.files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach(preview => URL.revokeObjectURL(preview.url));
  }, [draft.files]);
  useEffect(() => { titleRef.current?.focus(); }, [draft.step]);
  useEffect(() => { if (selectedService && !getValues('service')) setValue('service', selectedService); }, [selectedService, getValues, setValue]);
  async function nextStep() {
    setError('');
    if (await trigger(stepFields[draft.step], { shouldFocus: true })) draft.setStep(Math.min(2, draft.step + 1));
  }
  function addPhotos(event) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (incoming.length + draft.files.length > MAX_PHOTOS) { setPhotoMessage('Choose no more than eight photographs.'); return; }
    const invalid = incoming.find(file => photoError(file));
    if (invalid) { setPhotoMessage(invalid.name + ': ' + photoError(invalid)); return; }
    const files = [...draft.files];
    for (const file of incoming) if (!files.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) files.push(file);
    draft.setFiles(files);
    setPhotoMessage('');
  }
  async function onSubmit(values) {
    if (draft.step !== 2) { await nextStep(); return; }
    setError('');
    try {
      const booking = await submitBooking(values, draft.files, demo);
      if (!booking.id) throw new Error('No booking reference was returned. Check your requests before trying again.');
      await useCustomerData.getState().load(demo);
      draft.clear();
      navigate('/dashboard/bookings/' + booking.id, { replace: true });
    } catch (error) { setError(error.message); }
  }
  const values = getValues();
  return <section className="section booking-request">
    <div className="customer-page-heading"><div><span className="eyebrow">REQUEST A CLEAN</span><h1>Let’s make your space sparkle.</h1><p>A few details are all we need to prepare your quotation.</p></div><Link className="text-link" to="/dashboard/bookings">My Bookings</Link></div>
    {demo && <DemoBanner />}
    <ol className="booking-progress" aria-label="Request progress">{steps.map((title, index) => <li key={title} aria-current={draft.step === index ? 'step' : undefined}><span>{index + 1}</span>{title}</li>)}</ol>
    <form noValidate onSubmit={handleSubmit(onSubmit, invalid => { const first = stepFields.findIndex(fields => fields.some(field => invalid[field])); if (first >= 0) draft.setStep(first); })}>
      <fieldset disabled={isSubmitting} className="customer-fieldset booking-form-panel">
        <h2 ref={titleRef} tabIndex={-1}>{steps[draft.step]}</h2>
        {draft.step === 0 && <>
          <CustomerField name="service" label="What would you like cleaned?" register={register} errors={errors}><option value="">Choose a service</option>{services.map(service => <option key={service.slug} value={service.slug}>{service.name}</option>)}</CustomerField>
          <CustomerField name="rooms" label="Rooms or areas (optional)" type="number" min="1" step="1" register={register} errors={errors} />
          <CustomerField name="description" label="What cleaning do you need?" type="textarea" register={register} errors={errors} hint="Briefly describe the areas and anything that needs special attention." />
        </>}
        {draft.step === 1 && <>
          <CustomerField name="contactPhone" label="Phone / WhatsApp number" type="tel" register={register} errors={errors} autoComplete="tel" hint="Enter a Gambian number or include your international country code." />
          <CustomerField name="address" label="Address or nearby landmark" register={register} errors={errors} autoComplete="street-address" />
          <div className="form-grid"><CustomerField name="town" label="Town or area" register={register} errors={errors} autoComplete="address-level2" /><CustomerField name="date" label="Preferred date (optional)" type="date" min={localDate()} register={register} errors={errors} /></div>
          <p className="form-hint">Not sure of a date? Leave it blank. We’ll confirm scheduling with you.</p>
        </>}
        {draft.step === 2 && <>
          <dl className="review-grid">{[
            ['Service', services.find(service => service.slug === values.service)?.name],
            ['Rooms / areas', values.rooms || 'Not specified'],
            ['Cleaning needed', values.description],
            ['Contact', values.contactPhone],
            ['Location', values.address + ', ' + values.town],
            ['Preferred date', values.date || 'To be discussed'],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <details className="photo-upload"><summary><ImagePlus size={19} aria-hidden="true" /> Add photographs (optional)</summary><label htmlFor="booking-photos">Photographs of the cleaning areas</label><input id="booking-photos" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help photo-feedback" onChange={addPhotos} /><p id="photo-help" className="form-hint">Up to 8 JPG, PNG or WebP images, 5 MB each. You can submit without photos.</p><p id="photo-feedback" className="field-error" role="alert">{photoMessage}</p></details>
          <div className="photo-previews">{previews.map((preview, index) => <figure key={preview.url}><img src={preview.url} alt={'Selected cleaning area: ' + preview.name} /><figcaption>{preview.name}</figcaption><button type="button" aria-label={'Remove photograph ' + (index + 1)} onClick={() => { draft.setFiles(draft.files.filter((_, position) => position !== index)); setPhotoMessage(''); }}><X size={17} aria-hidden="true" /></button></figure>)}</div>
          <p className="notice">Ijobisco will review your request and send an official quotation. No payment is required now, and your preferred date is not a confirmed appointment.</p>
        </>}
        <div className="booking-form-actions">{draft.step > 0 ? <button type="button" className="button button-outline" onClick={() => draft.setStep(draft.step - 1)}><ArrowLeft size={17} aria-hidden="true" />Back</button> : <Link to="/dashboard" className="text-link">Back to Dashboard</Link>}{draft.step < 2 ? <button key="next-step" type="button" className="button button-primary" onClick={nextStep}>Continue<ArrowRight size={17} aria-hidden="true" /></button> : <button key="submit-request" type="submit" className="button button-primary">{isSubmitting ? 'Sending…' : demo ? 'Send Demo Request' : 'Send Cleaning Request'}<ArrowRight size={17} aria-hidden="true" /></button>}</div>
      </fieldset>
      {error && <div className="notice error-notice" role="alert"><p>{error}</p></div>}
    </form>
    <p className="form-hint">Prefer to discuss your cleaning needs first?</p><BusinessWhatsApp />
  </section>;
}
