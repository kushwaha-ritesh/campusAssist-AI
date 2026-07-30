import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { campusApi } from '../../api/endpoints';
import type { DocumentCategory } from '../../types';

export default function RequiredDocsPage() {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campusApi.documents().then(setCategories).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Required Documents</h1>
        <p className="page-subtitle">Documents needed for common university processes</p>
      </div>
      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /><span>Loading…</span></div>
      ) : (
        <div style={{ maxWidth: 720 }}>
          {categories.map(cat => (
            <div key={cat.category} className="doc-category card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} color="var(--ibm-blue-60)" />
                  <span className="card-title">{cat.category}</span>
                </div>
                <span className="badge badge-blue">{cat.documents.length} items</span>
              </div>
              <ul className="doc-list">
                {cat.documents.map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          ))}
          <div style={{
            marginTop: '1rem',
            background: 'var(--ibm-blue-10)',
            border: '1px solid var(--ibm-blue-20)',
            borderRadius: 6,
            padding: '1rem 1.25rem',
            fontSize: '0.813rem',
            color: 'var(--ibm-blue-70)',
          }}>
            <strong>Note:</strong> Requirements may vary by department. Contact the relevant office to confirm document requirements before submitting.
          </div>
        </div>
      )}
    </div>
  );
}
