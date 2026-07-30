import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { requestsApi } from '../../api/endpoints';

const CATEGORIES = ['academic', 'financial', 'technical', 'administrative', 'other'];
const PRIORITIES = ['low', 'medium', 'high'];

export default function RaiseRequestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<{ title: string; description: string; category: import('../../types').RequestCategory; priority: import('../../types').RequestPriority }>({ title: '', description: '', category: 'academic', priority: 'medium' });
  const [loading, setLoading] = useState(false);

  const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { toast.error('Please fill in all required fields.'); return; }
    setLoading(true);
    try {
      await requestsApi.create(form);
      toast.success('Request submitted successfully!');
      navigate('/track-request');
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Raise a Request</h1>
        <p className="page-subtitle">Submit a support request to university staff</p>
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquarePlus size={18} color="var(--ibm-blue-60)" />
            <span className="card-title">New Support Request</span>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title <span style={{ color: 'var(--ibm-red-50)' }}>*</span></label>
              <input className="form-input" placeholder="Brief summary of your issue" value={form.title} onChange={e => setField('title', e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => setField('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description <span style={{ color: 'var(--ibm-red-50)' }}>*</span></label>
              <textarea
                className="form-textarea"
                placeholder="Describe your issue in detail. Include relevant dates, student ID, or reference numbers."
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                rows={5}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
