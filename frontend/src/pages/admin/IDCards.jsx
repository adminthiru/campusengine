import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Search } from 'lucide-react';
import api from '../../utils/api';
import { PageLoader, SearchInput } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';
import { format } from 'date-fns';

export default function IDCards() {
  const { user } = useAuth();
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const printRef = useRef();

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: studentData, isLoading } = useQuery({
    queryKey: ['students-idcard', classId],
    enabled: !!classId,
    queryFn: () => api.get(`/students?classId=${classId}&limit=100&status=active`)
  });
  const students = (studentData?.students || []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.admissionNumber?.includes(search)
  );

  const { data: cardData } = useQuery({
    queryKey: ['id-cards', selected],
    enabled: selected.length > 0,
    queryFn: () => api.post('/students/id-card-data', { ids: selected }),
    staleTime: 0
  });
  const cardStudents = cardData?.students || [];
  const school = cardData?.school || user?.school;

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Student ID Cards'
  });

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelected(prev => prev.length === students.length ? [] : students.map(s => s._id));
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">ID Cards</h1><p className="page-subtitle">Generate and print student ID cards</p></div>
        <button className="btn btn-primary" onClick={handlePrint} disabled={selected.length === 0}>
          <Printer size={16} /> Print {selected.length > 0 ? `(${selected.length})` : ''} ID Cards
        </button>
      </div>

      <div className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }} value={classId} onChange={e => { setClassId(e.target.value); setSelected([]); }}>
          <option value="">Select Class</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        {classId && <SearchInput value={search} onChange={setSearch} placeholder="Search students..." />}
        {students.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
            {selected.length === students.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Student selection grid */}
      {classId && (isLoading ? <PageLoader /> : (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {students.map(stu => (
            <div
              key={stu._id}
              onClick={() => toggleSelect(stu._id)}
              style={{
                background: 'white', borderRadius: 12, padding: 14, cursor: 'pointer',
                border: `2px solid ${selected.includes(stu._id) ? 'var(--primary)' : 'var(--border)'}`,
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
              }}
            >
              <div className="text-18-bold" style={{
                width: 50, height: 50, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', marginBottom: 8
              }}>
                {stu.photo ? <img src={stu.photo} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : stu.name.charAt(0)}
              </div>
              <div className="text-14-semibold">{stu.name}</div>
              <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{stu.admissionNumber}</div>
              {selected.includes(stu._id) && (
                <div style={{ marginTop: 6, width: 18, height: 18, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="8" fill="white" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Printable ID Cards */}
      <div ref={printRef} style={{ display: 'none' }} className="id-cards-print">
        <style>{`
          @media print {
            .id-cards-print { display: block !important; }
            body * { visibility: hidden; }
            .id-cards-print, .id-cards-print * { visibility: visible; }
            .id-cards-print { position: absolute; left: 0; top: 0; }
          }
          .id-card-wrap {
            display: inline-block;
            width: 85.6mm;
            height: 53.98mm;
            margin: 4mm;
            page-break-inside: avoid;
          }
        `}</style>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {cardStudents.map(stu => (
            <IDCard key={stu._id} student={stu} school={school} />
          ))}
        </div>
      </div>

      {/* Preview */}
      {selected.length > 0 && cardStudents.length > 0 && (
        <div>
          <h3 className="text-16-bold" style={{ marginBottom: 16 }}>Preview</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {cardStudents.slice(0, 6).map(stu => (
              <IDCard key={stu._id} student={stu} school={school} preview />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IDCard({ student, school, preview }) {
  const cls = student.currentClass;
  const guardian = student.primaryGuardian;

  return (
    <div className="id-card-wrap" style={{
      background: 'white',
      border: '2px solid #1a56e8',
      borderRadius: preview ? 12 : 4,
      overflow: 'hidden',
      width: preview ? 280 : '85.6mm',
      height: preview ? 'auto' : '53.98mm',
      fontFamily: 'Arial, sans-serif',
      fontSize: 9,
      display: 'inline-block',
      margin: preview ? 0 : 4,
    }}>
      {/* Header */}
      <div style={{ background: '#1a56e8', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {school?.logo && <img src={school.logo} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain', background: 'white' }} />}
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: preview ? 11 : 9, lineHeight: 1.2 }}>{school?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: preview ? 9 : 8 }}>{school?.address?.city}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '6px 10px', display: 'flex', gap: 8 }}>
        {/* Photo */}
        <div style={{ width: preview ? 56 : 40, height: preview ? 64 : 48, border: '1px solid #ddd', borderRadius: 4, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {student.photo
            ? <img src={student.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: preview ? 20 : 14, fontWeight: 700, color: '#1a56e8' }}>{student.name?.charAt(0)}</span>}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: preview ? 13 : 10, color: '#1a56e8', marginBottom: 3 }}>{student.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: preview ? 9 : 8 }}>
            <span style={{ color: '#666' }}>Adm No:</span><span style={{ fontWeight: 600 }}>{student.admissionNumber}</span>
            <span style={{ color: '#666' }}>Class:</span><span style={{ fontWeight: 600 }}>{cls ? `${cls.name} ${cls.section}` : '—'}</span>
            <span style={{ color: '#666' }}>DOB:</span><span style={{ fontWeight: 600 }}>{student.dateOfBirth ? format(new Date(student.dateOfBirth), 'dd/MM/yyyy') : '—'}</span>
            <span style={{ color: '#666' }}>Blood:</span><span style={{ fontWeight: 600, color: '#ef4444' }}>{student.bloodGroup || '—'}</span>
          </div>
          {guardian && (
            <div style={{ marginTop: 3, fontSize: preview ? 9 : 7.5, color: '#555' }}>
              <span style={{ color: '#888' }}>Parent: </span>{guardian.name} · {guardian.phone}
            </div>
          )}
          {student.address?.street && (
            <div style={{ fontSize: preview ? 8 : 7, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {student.address.street}, {student.address.city}
            </div>
          )}
        </div>

        {/* QR */}
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={student.admissionNumber || student._id} size={preview ? 40 : 32} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#1a56e8', padding: '3px 10px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: preview ? 8 : 7 }}>Emergency: {student.medicalInfo?.emergencyContact?.phone || school?.phone || '—'}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: preview ? 8 : 7 }}>Govt. issued ID card</span>
      </div>
    </div>
  );
}
