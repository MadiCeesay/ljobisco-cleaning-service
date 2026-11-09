import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useAdmin } from './AdminLayout';
import { AdminHeading, Table, Filter, StatusBadge, useConfirmation } from './components';
import { productSchema, serviceSchema, imageError, safeImageUrl } from './rules';
import { CustomerField } from '../customer/AccountPages';
import { formatPrice } from '../../services/catalog';

function FilePreview({ file, remove }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const preview = URL.createObjectURL(file); setUrl(preview); return () => URL.revokeObjectURL(preview); }, [file]);
  return <div className="admin-image-tile">{url && <img src={url} alt={`Local preview: ${file.name}`} />}<span>{file.name}</span><button type="button" onClick={remove}>Remove New Image</button></div>;
}
function CatalogueForm({ kind, record, onClose }) {
  const { mutate, demo } = useAdmin();
  const product = kind === 'products';
  const singular = product ? 'product' : 'service';
  const [images, setImages] = useState(record?.images || []);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const confirmation = useConfirmation();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(product ? productSchema : serviceSchema), defaultValues: { name: record?.name || '', slug: record?.slug || '', description: record?.description || '', overview: record?.overview || '', category: record?.category || '', price: record ? String(record.price) : '', stock: record ? String(record.stock) : '', enabled: record?.enabled ?? true } });
  function attach(event) {
    const incoming = [...(event.target.files || [])]; event.target.value = '';
    if (incoming.length + files.length + images.length > 4) { setError('Keep no more than four images.'); return; }
    const invalid = incoming.find(file => imageError(file));
    if (invalid) { setError(imageError(invalid)); return; }
    setFiles(previous => [...previous, ...incoming]); setError('');
  }
  function review(values) {
    if (!images.length && !files.length) { setError(`Add at least one ${singular} image.`); return; }
    setError('');
    confirmation.confirm({ title: `Save ${singular}?`, description: `${values.name}\n${product ? `${formatPrice(Number(values.price))} · Stock: ${values.stock}\nCategory: ${values.category}` : values.description}\n${values.enabled ? 'Enabled' : 'Disabled'}\n${demo ? 'Development-only changes; new images stay local and are not uploaded.' : 'The backend must authorize and confirm this change.'}`, onConfirm: async () => { await mutate('catalog', { kind, id: record?.id, values, images, expectedRevision: record?.revision || 0 }, files); onClose('The administrator adapter confirmed the catalogue update.'); } });
  }
  return <section className="admin-panel" aria-labelledby="catalog-editor-title"><h2 id="catalog-editor-title">{record ? 'Edit' : 'Add'} {singular}</h2><p className="admin-info-note">No changes are applied until confirmed. Images: JPG, PNG or WebP, up to 5 MB each, maximum four. {demo ? 'Local development images are not uploaded or published.' : 'New image uploads require a backend-signed upload service.'}</p><form noValidate onSubmit={handleSubmit(review)}><div className="admin-form-grid"><CustomerField name="name" label={product ? 'Product name' : 'Service name'} register={register} errors={errors} /><CustomerField name="slug" label="URL slug" register={register} errors={errors} /><div className="admin-form-full"><CustomerField name="description" label="Description" type="textarea" register={register} errors={errors} /></div>{product ? <><CustomerField name="category" label="Product category" register={register} errors={errors} /><CustomerField name="price" label="Fixed price (GMD)" type="number" min="0" step="0.01" register={register} errors={errors} /><CustomerField name="stock" label="Stock quantity" type="number" min="0" step="1" register={register} errors={errors} /></> : <div className="admin-form-full"><CustomerField name="overview" label="Service overview" type="textarea" register={register} errors={errors} /></div>}</div><label className="admin-checkbox"><input type="checkbox" {...register('enabled')} />{product ? 'Product available in catalogue' : 'Service enabled'}</label><div className="field"><label htmlFor="catalogue-images">{product ? 'Product images' : 'Service images'}</label><input id="catalogue-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={attach} /></div><div className="admin-image-grid">{images.map((image, index) => <div className="admin-image-tile" key={image}>{safeImageUrl(image) && <img src={safeImageUrl(image)} alt={`${record?.name || singular} image ${index + 1}`} />}<button type="button" onClick={() => setImages(previous => previous.filter(value => value !== image))}>Remove Image {index + 1}</button></div>)}{files.map((file, index) => <FilePreview key={`${file.name}-${file.lastModified}-${index}`} file={file} remove={() => setFiles(previous => previous.filter((_, position) => position !== index))} />)}</div>{error && <p role="alert" className="field-error">{error}</p>}<div className="admin-form-actions"><button className="button button-primary" type="submit">Review {product ? 'Product' : 'Service'}</button><button className="button button-outline" type="button" onClick={() => onClose('')}>Cancel Editing</button></div></form>{confirmation.dialog}</section>;
}
export function CataloguePage({ kind }) {
  const { data, search, mutate } = useAdmin();
  const [status, setStatus] = useState('All');
  const [editing, setEditing] = useState(null);
  const [feedback, setFeedback] = useState('');
  const confirmation = useConfirmation();
  const product = kind === 'products';
  const records = data[kind].filter(record => (!search || `${record.name} ${record.slug} ${record.description} ${record.category || ''}`.toLowerCase().includes(search.toLowerCase())) && (status === 'All' || (status === 'Enabled' ? record.enabled : status === 'Disabled' ? !record.enabled : status === 'Out of Stock' ? record.stock === 0 : record.stock > 0 && record.stock <= 3)));
  const selected = data[kind].find(record => record.id === editing);
  function toggle(record) {
    const values = { ...record, enabled: !record.enabled, ...(product ? { price: String(record.price), stock: String(record.stock) } : {}) };
    confirmation.confirm({ title: `${record.enabled ? 'Disable' : 'Enable'} ${product ? 'product' : 'service'}?`, description: `${record.name}\n${record.enabled ? 'This item will be disabled in the managed catalogue.' : 'This item will be enabled in the managed catalogue.'}`, onConfirm: async () => { await mutate('catalog', { kind, id: record.id, values, images: record.images, expectedRevision: record.revision }); setFeedback('The adapter confirmed the availability update.'); } });
  }
  const columns = [{ label: product ? 'Product' : 'Service', render: record => <>{safeImageUrl(record.images[0]) && <img className="admin-thumb" src={safeImageUrl(record.images[0])} alt="" />}<strong>{record.name}</strong><small>{record.slug}</small></> }, ...(product ? [{ label: 'Category', render: record => record.category }, { label: 'Fixed price', render: record => <span className="admin-money">{formatPrice(record.price)}</span> }, { label: 'Stock', render: record => <>{record.stock}<small>{record.stock === 0 ? 'Out of stock' : record.stock <= 3 ? 'Low stock' : 'In stock'}</small></> }] : [{ label: 'Description', render: record => record.description }]), { label: 'Availability', render: record => <StatusBadge status={record.enabled ? 'Enabled' : 'Disabled'} /> }, { label: 'Actions', render: record => <div className="admin-table-actions"><button className="admin-text-button" aria-label={`Edit ${record.name}`} onClick={() => { setEditing(record.id); setFeedback(''); }}>Edit</button><button className="admin-text-button" onClick={() => toggle(record)}>{record.enabled ? 'Disable' : 'Enable'}</button></div> }];
  return <><AdminHeading title={product ? 'Product catalogue' : 'Cleaning services'} description={product ? 'Manage fixed product prices, image galleries, stock and categories.' : 'Manage service information, photography and catalogue availability.'}><button className="button button-primary" onClick={() => { setEditing('new'); setFeedback(''); }}><Plus size={17} aria-hidden="true" />Add {product ? 'Product' : 'Service'}</button></AdminHeading>{editing && <CatalogueForm key={`${kind}-${editing}`} kind={kind} record={selected} onClose={message => { setEditing(null); setFeedback(message); }} />}<p className="admin-info-note" role="status">{feedback}</p><section className="admin-panel"><Filter status={status} setStatus={setStatus} statuses={product ? ['Enabled', 'Disabled', 'Low Stock', 'Out of Stock'] : ['Enabled', 'Disabled']} count={records.length} /><Table caption={product ? 'Product catalogue — development fixture values are not real business offers' : 'Managed cleaning service catalogue'} columns={columns} records={records} /></section>{confirmation.dialog}</>;
}
export function AdminServicesPage() { return <CataloguePage key="services" kind="services" />; }
export function AdminProductsPage() { return <CataloguePage key="products" kind="products" />; }
