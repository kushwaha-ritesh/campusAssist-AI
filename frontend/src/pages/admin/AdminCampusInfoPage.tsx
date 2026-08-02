import React, { useState, useEffect } from 'react';
import { Building2, FileText, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { campusAdminApi } from '../../api/endpoints';
import type { Office, DocumentCategory } from '../../types';

// ── Blank templates ────────────────────────────────────────────────────────────
const BLANK_OFFICE: Partial<Office> = {
  id: '', name: '', block: '', room: '', phone: '', email: '', hours: '', services: [],
};
const BLANK_DOC: DocumentCategory = { category: '', documents: [] };

// ── Helper ─────────────────────────────────────────────────────────────────────
const errMsg = (e: any) => e?.response?.data?.detail ?? 'Something went wrong.';

export default function AdminCampusInfoPage() {
  const [tab, setTab] = useState<'offices' | 'documents'>('offices');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campus Info Management</h1>
          <p className="page-subtitle">Edit office details and required document lists shown to students</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          className={`btn btn-sm ${tab === 'offices' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('offices')}
        >
          <Building2 size={14} /> Offices
        </button>
        <button
          className={`btn btn-sm ${tab === 'documents' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('documents')}
        >
          <FileText size={14} /> Required Documents
        </button>
      </div>

      {tab === 'offices' ? <OfficesTab /> : <DocumentsTab />}
    </div>
  );
}

// ── Offices Tab ────────────────────────────────────────────────────────────────
function OfficesTab() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // null = none, 'new' = add form
  const [form, setForm] = useState<Partial<Office>>(BLANK_OFFICE);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setOffices(await campusAdminApi.listOffices()); }
    catch { toast.error('Failed to load offices.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (office: Office) => {
    setEditingId(office.id);
    setForm({ ...office, services: [...office.services] });
  };

  const startAdd = () => {
    setEditingId('new');
    setForm({ ...BLANK_OFFICE });
  };

  const cancelEdit = () => { setEditingId(null); setForm(BLANK_OFFICE); };

  const setField = (k: keyof Office, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name?.trim() || !form.id?.trim()) { toast.error('ID and Name are required.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        services: typeof form.services === 'string'
          ? (form.services as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : form.services ?? [],
      };
      if (editingId === 'new') {
        const created = await campusAdminApi.createOffice(payload);
        setOffices(o => [...o, created]);
        toast.success('Office added.');
      } else {
        const updated = await campusAdminApi.updateOffice(editingId!, payload);
        setOffices(o => o.map(x => x.id === editingId ? updated : x));
        toast.success('Office updated.');
      }
      cancelEdit();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await campusAdminApi.deleteOffice(id);
      setOffices(o => o.filter(x => x.id !== id));
      toast.success('Office deleted.');
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Offices ({offices.length})</span>
        {editingId !== 'new' && (
          <button className="btn btn-primary btn-sm" onClick={startAdd}>
            <Plus size={14} /> Add Office
          </button>
        )}
      </div>

      {/* Add form */}
      {editingId === 'new' && (
        <OfficeForm form={form} setField={setField} onSave={save} onCancel={cancelEdit} saving={saving} isNew />
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Location</th><th>Phone</th><th>Hours</th><th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offices.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ibm-gray-60)', padding: '2rem' }}>No offices yet.</td></tr>
            )}
            {offices.map(o => (
              <React.Fragment key={o.id}>
                <tr>
                  <td><strong>{o.name}</strong></td>
                  <td>{o.block}, {o.room}</td>
                  <td>{o.phone}</td>
                  <td style={{ fontSize: '0.8rem' }}>{o.hours}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(o)} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-sm" style={{ color: 'var(--ibm-red-50)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} onClick={() => remove(o.id, o.name)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === o.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <OfficeForm form={form} setField={setField} onSave={save} onCancel={cancelEdit} saving={saving} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Office inline form ─────────────────────────────────────────────────────────
function OfficeForm({ form, setField, onSave, onCancel, saving, isNew = false }: {
  form: Partial<Office>;
  setField: (k: keyof Office, v: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const servicesStr = Array.isArray(form.services) ? form.services.join(', ') : form.services ?? '';
  return (
    <div style={{ background: 'var(--ibm-gray-10)', padding: '1rem 1.25rem', borderBottom: '1px solid var(--ibm-gray-20)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {isNew && (
          <div>
            <label className="form-label">ID (slug)*</label>
            <input className="form-input" placeholder="e.g. admissions" value={form.id ?? ''} onChange={e => setField('id', e.target.value)} />
          </div>
        )}
        <div>
          <label className="form-label">Name*</label>
          <input className="form-input" value={form.name ?? ''} onChange={e => setField('name', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Block</label>
          <input className="form-input" value={form.block ?? ''} onChange={e => setField('block', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Room</label>
          <input className="form-input" value={form.room ?? ''} onChange={e => setField('room', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input className="form-input" value={form.phone ?? ''} onChange={e => setField('phone', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email ?? ''} onChange={e => setField('email', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Hours</label>
          <input className="form-input" placeholder="e.g. Mon–Fri: 8AM–5PM" value={form.hours ?? ''} onChange={e => setField('hours', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Services (comma-separated)</label>
          <input className="form-input" placeholder="e.g. Enrollment, Transcripts" value={servicesStr} onChange={e => setField('services', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? <span className="spinner" /> : <><Check size={13} /> Save</>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── Documents Tab ──────────────────────────────────────────────────────────────
function DocumentsTab() {
  const [docs, setDocs] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentCategory>(BLANK_DOC);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setDocs(await campusAdminApi.listDocuments()); }
    catch { toast.error('Failed to load documents.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (d: DocumentCategory) => {
    setEditingCat(d.category);
    setForm({ ...d, documents: [...d.documents] });
  };

  const startAdd = () => { setEditingCat('__new__'); setForm({ ...BLANK_DOC }); };
  const cancelEdit = () => { setEditingCat(null); setForm(BLANK_DOC); };

  const save = async () => {
    if (!form.category.trim()) { toast.error('Category name is required.'); return; }
    const docsArr = form.documents
      .flatMap(d => typeof d === 'string' && d.includes('\n') ? d.split('\n') : [d])
      .map(d => d.trim()).filter(Boolean);
    setSaving(true);
    try {
      if (editingCat === '__new__') {
        const created = await campusAdminApi.createDocument({ category: form.category, documents: docsArr });
        setDocs(d => [...d, created]);
        toast.success('Category added.');
      } else {
        const updated = await campusAdminApi.updateDocument(editingCat!, { category: form.category, documents: docsArr });
        setDocs(d => d.map(x => x.category === editingCat ? updated : x));
        toast.success('Category updated.');
      }
      cancelEdit();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const remove = async (cat: string) => {
    if (!window.confirm(`Delete category "${cat}"?`)) return;
    try {
      await campusAdminApi.deleteDocument(cat);
      setDocs(d => d.filter(x => x.category !== cat));
      toast.success('Category deleted.');
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Document Categories ({docs.length})</span>
        {editingCat !== '__new__' && (
          <button className="btn btn-primary btn-sm" onClick={startAdd}>
            <Plus size={14} /> Add Category
          </button>
        )}
      </div>

      {/* Add form */}
      {editingCat === '__new__' && (
        <DocForm form={form} setForm={setForm} onSave={save} onCancel={cancelEdit} saving={saving} />
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Category</th><th>Documents</th><th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--ibm-gray-60)', padding: '2rem' }}>No categories yet.</td></tr>
            )}
            {docs.map(d => (
              <React.Fragment key={d.category}>
                <tr>
                  <td><strong>{d.category}</strong></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--ibm-gray-70)' }}>{d.documents.length} document{d.documents.length !== 1 ? 's' : ''}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(d)} title="Edit"><Pencil size={13} /></button>
                      <button className="btn btn-sm" style={{ color: 'var(--ibm-red-50)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} onClick={() => remove(d.category)} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
                {editingCat === d.category && (
                  <tr>
                    <td colSpan={3} style={{ padding: 0 }}>
                      <DocForm form={form} setForm={setForm} onSave={save} onCancel={cancelEdit} saving={saving} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Document category inline form ──────────────────────────────────────────────
function DocForm({ form, setForm, onSave, onCancel, saving }: {
  form: DocumentCategory;
  setForm: React.Dispatch<React.SetStateAction<DocumentCategory>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const docsText = form.documents.join('\n');
  return (
    <div style={{ background: 'var(--ibm-gray-10)', padding: '1rem 1.25rem', borderBottom: '1px solid var(--ibm-gray-20)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <label className="form-label">Category Name*</label>
          <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Registration" />
        </div>
        <div>
          <label className="form-label">Documents (one per line)</label>
          <textarea
            className="form-input"
            rows={5}
            style={{ resize: 'vertical' }}
            value={docsText}
            onChange={e => setForm(f => ({ ...f, documents: e.target.value.split('\n') }))}
            placeholder={"Certified copy of ID\nProof of address\n..."}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? <span className="spinner" /> : <><Check size={13} /> Save</>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}
