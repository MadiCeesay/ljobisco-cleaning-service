import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './AdminLayout';

export function AdminHeading({ title, description, children }) { return <div className="admin-heading"><div><span className="eyebrow">IJOBISCO ADMINISTRATION</span><h1>{title}</h1><p>{description}</p></div>{children}</div>; }
export function StatusBadge({ status }) {
  const tone = ['Paid', 'Accepted', 'Active', 'Completed', 'Enabled', 'In Stock'].includes(status) ? 'positive' : ['Failed', 'Cancelled', 'Declined', 'Suspended', 'Out of Stock', 'Payment Failed'].includes(status) ? 'negative' : ['Disabled', 'Superseded', 'Refunded'].includes(status) ? 'neutral' : 'warning';
  return <span className={`admin-badge ${tone}`}>{status}</span>;
}
export function EmptyState({ title = 'No matching records.', children = 'Try changing your search or filter.' }) { return <div className="admin-empty"><h2>{title}</h2><p>{children}</p></div>; }
export function Table({ caption, columns, records, rowKey = 'id', empty }) {
  if (!records.length) return empty || <EmptyState />;
  return <><div className="admin-table-scroll" tabIndex={0} role="region" aria-label={caption}><table className="admin-table"><caption>{caption}</caption><thead><tr>{columns.map(column => <th key={column.label} scope="col">{column.label}</th>)}</tr></thead><tbody>{records.map(record => <tr key={record[rowKey]}>{columns.map(column => <td key={column.label}>{column.render(record)}</td>)}</tr>)}</tbody></table></div><p className="admin-mobile-table-hint">Scroll horizontally to see all columns.</p></>;
}
export function Filter({ status, setStatus, statuses, count, label = 'Status filter' }) { return <div className="admin-filters"><div className="field"><label htmlFor="admin-status-filter">{label}</label><select id="admin-status-filter" value={status} onChange={event => setStatus(event.target.value)}><option value="All">All statuses</option>{statuses.map(item => <option key={item}>{item}</option>)}</select></div><span className="admin-result-count" role="status">{count} matching records</span></div>; }
export function ConfirmAction({ title, description, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  return <dialog ref={dialog} className="admin-modal" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}><h2 id="admin-confirm-title">{title}</h2><p id="admin-confirm-description">{description}</p>{error && <p role="alert" className="field-error">{error}</p>}<div className="admin-form-actions"><button autoFocus className="button button-outline" disabled={busy} onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onConfirm(); } catch (error) { setError(error.message); } finally { setBusy(false); } }}>{busy ? 'Saving…' : 'Confirm Change'}</button></div></dialog>;
}
export function useConfirmation() { const [confirmation, setConfirmation] = useState(null); return { confirm: setConfirmation, dialog: confirmation ? <ConfirmAction {...confirmation} onCancel={() => setConfirmation(null)} onConfirm={async () => { await confirmation.onConfirm(); setConfirmation(null); }} /> : null }; }
export function AuditHistory({ items }) { return !items.length ? <p className="admin-info-note">No administrator changes recorded yet.</p> : <ol className="admin-history">{items.map((item, index) => <li key={index}>{item.title}{item.status && <div><StatusBadge status={item.status} /></div>}<time dateTime={item.at}>{new Date(item.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ol>; }
export function CustomerName({ id }) { const { data } = useAdmin(); const customer = data.customers.find(item => item.id === id); return customer ? <Link to={`/admin/customers/${customer.id}`}>{customer.name}</Link> : <span>{id || 'Not provided'}</span>; }
