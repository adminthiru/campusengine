import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UsersRound, Phone, Search } from 'lucide-react';
import api from '../../utils/api';
import { PageLoader, EmptyState, Avatar } from '../../components/ui';

const RELATION_COLORS = {
  father:   { bg: '#eff6ff', color: '#1d4ed8', label: 'Father' },
  mother:   { bg: '#fdf4ff', color: '#7c3aed', label: 'Mother' },
  guardian: { bg: '#f0fdf4', color: '#15803d', label: 'Guardian' },
  other:    { bg: '#f8fafc', color: '#475569', label: 'Other' },
};

export default function Parents() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['parents'],
    queryFn: () => api.get('/parents'),
  });
  const allParents = data?.parents || [];

  const parents = search.trim()
    ? allParents.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search)
      )
    : allParents;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Parents</h1>
          <p className="page-subtitle">
            {isLoading ? 'Loading...' : `${allParents.length} parent${allParents.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-control"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, fontSize: 13 }}
          />
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : parents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UsersRound}
            message={
              search
                ? `No parents match "${search}"`
                : 'No parents registered yet. Parents are added automatically when students are enrolled.'
            }
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Mobile</th>
                  <th>Alt Mobile</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {parents.map(parent => {
                  const rel = RELATION_COLORS[parent.relation] || RELATION_COLORS.other;
                  const students = parent.students || [];
                  const visibleStudents = students.slice(0, 3);
                  const extra = students.length - 3;
                  return (
                    <tr key={parent._id}>
                      {/* Name */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={parent.name} size={36} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{parent.name}</div>
                            {parent.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{parent.email}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Relationship */}
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: rel.bg, color: rel.color }}>
                          {rel.label}
                        </span>
                      </td>

                      {/* Mobile */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-primary)' }}>
                          <Phone size={12} color="var(--text-muted)" />
                          {parent.phone || '—'}
                        </div>
                      </td>

                      {/* Alt Mobile */}
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {parent.alternatePhone || '—'}
                      </td>

                      {/* Students */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            {students.length} student{students.length !== 1 ? 's' : ''}
                          </span>
                          {visibleStudents.map(s => (
                            <span key={s._id} style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                              {s.name}{s.currentClass ? ` · ${s.currentClass.name}${s.currentClass.section ? ` ${s.currentClass.section}` : ''}` : ''}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>+{extra} more</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
