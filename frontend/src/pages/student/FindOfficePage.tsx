import React, { useEffect, useState } from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { campusApi } from '../../api/endpoints';
import type { Office } from '../../types';

export default function FindOfficePage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campusApi.offices().then(setOffices).finally(() => setLoading(false));
  }, []);

  const filtered = offices.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.services.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Find an Office</h1>
        <p className="page-subtitle">Office locations, contacts and services</p>
      </div>
      <input
        className="form-input"
        style={{ maxWidth: 360, marginBottom: '1.25rem' }}
        placeholder="Search offices or services…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /><span>Loading offices…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <MapPin size={40} className="empty-state-icon" />
          <p className="empty-state-text">No offices found</p>
        </div>
      ) : (
        <div className="office-grid">
          {filtered.map(office => (
            <div key={office.id} className="office-card">
              <div className="office-card-header">
                <div className="office-card-name">{office.name}</div>
                <div className="office-card-location">{office.block} · {office.room}</div>
              </div>
              <div className="office-card-body">
                <div className="office-detail"><Phone size={14} />{office.phone}</div>
                <div className="office-detail"><Mail size={14} />{office.email}</div>
                <div className="office-detail"><Clock size={14} />{office.hours}</div>
                <div className="office-services">
                  <div className="office-services-label">Services</div>
                  {office.services.map(s => <span key={s} className="service-chip">{s}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
