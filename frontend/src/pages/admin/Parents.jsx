import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UsersRound, Phone, Search, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { PageLoader, EmptyState, Avatar, Modal } from '../../components/ui';

const RELATION_COLORS = {
  father:   { bg: '#eff6ff', color: '#1d4ed8', label: 'Father' },
  mother:   { bg: '#fdf4ff', color: '#7c3aed', label: 'Mother' },
  guardian: { bg: '#f0fdf4', color: '#15803d', label: 'Guardian' },
  other:    { bg: '#f8fafc', color: '#475569', label: 'Other' },
};

export default function Parents() {
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const navigate = useNavigate();

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
                    <tr key={parent._id} onClick={() => setSelectedParent(parent)} style={{ cursor: 'pointer' }}>
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

      {/* Parent Detail Modal */}
      {selectedParent && (() => {
        const rel = RELATION_COLORS[selectedParent.relation] || RELATION_COLORS.other;
        const students = selectedParent.students || [];
        return (
          <Modal
            open
            onClose={() => setSelectedParent(null)}
            title="Parent Details"
            size="md"
          >
            {/* Parent info header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              <Avatar name={selectedParent.name} size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedParent.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: rel.bg, color: rel.color }}>
                    {rel.label}
                  </span>
                  {selectedParent.phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <Phone size={12} />
                      {selectedParent.phone}
                    </span>
                  )}
                  {selectedParent.alternatePhone && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedParent.alternatePhone}</span>
                  )}
                </div>
                {selectedParent.email && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{selectedParent.email}</div>
                )}
              </div>
            </div>

            {/* Students list */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Students ({students.length})
              </div>
              {students.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>No students linked</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {students.map(s => (
                    <div
                      key={s._id}
                      onClick={() => { setSelectedParent(null); navigate(`/students?student=${s._id}`); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: '#fafafa', cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <Avatar src={s.photo} name={s.name} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                        {s.currentClass && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                            {s.currentClass.name}{s.currentClass.section ? ` · ${s.currentClass.section}` : ''}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
