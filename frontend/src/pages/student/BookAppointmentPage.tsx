import React, { useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentsApi, campusApi } from '../../api/endpoints';
import type { Appointment, Office } from '../../types';

const TIME_SLOTS = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM',
];

const APPT_BADGE: Record<string, string> = { pending: 'badge-yellow', confirmed: 'badge-green', cancelled: 'badge-red' };

export default function BookAppointmentPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ office: '', purpose: '', date: '', time_slot: '', notes: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    campusApi.offices().then(setOffices);
    loadAppointments();
  }, []);

  const loadAppointments = () => {
    appointmentsApi.list().then(setAppointments);
  };

  const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.office || !form.purpose || !form.date || !form.time_slot) { toast.error('Please fill all required fields.'); return; }
    setLoading(true);
    try {
      await appointmentsApi.create(form);
      toast.success('Appointment booked successfully!');
      setForm({ office: '', purpose: '', date: '', time_slot: '', notes: '' });
      setShowForm(false);
      loadAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to book appointment.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await appointmentsApi.cancel(id);
      toast.success('Appointment cancelled.');
      loadAppointments();
    } catch { toast.error('Failed to cancel appointment.'); }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Book Appointment</h1>
          <p className="page-subtitle">Schedule a meeting with a university office</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          <CalendarPlus size={16} /> {showForm ? 'Hide Form' : 'New Appointment'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ maxWidth: 580, marginBottom: '1.5rem' }}>
          <div className="card-header"><span className="card-title">New Appointment</span></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Office *</label>
                <select className="form-select" value={form.office} onChange={e => setField('office', e.target.value)} required>
                  <option value="">Select office…</option>
                  {offices.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Purpose *</label>
                <input className="form-input" placeholder="Reason for appointment" value={form.purpose} onChange={e => setField('purpose', e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input className="form-input" type="date" min={minDate} value={form.date} onChange={e => setField('date', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot *</label>
                  <select className="form-select" value={form.time_slot} onChange={e => setField('time_slot', e.target.value)} required>
                    <option value="">Select time…</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea className="form-textarea" placeholder="Optional details…" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">My Appointments</span></div>
        {appointments.length === 0 ? (
          <div className="empty-state">
            <CalendarPlus size={36} className="empty-state-icon" />
            <p className="empty-state-text">No appointments yet</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Office</th><th>Purpose</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.office}</td>
                    <td>{a.purpose}</td>
                    <td>{a.date}</td>
                    <td>{a.time_slot}</td>
                    <td><span className={`badge ${APPT_BADGE[a.status]}`}>{a.status}</span></td>
                    <td>
                      {a.status === 'pending' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleCancel(a.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
