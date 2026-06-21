import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select as AntSelect } from 'antd';
import {
  Plus, Edit2, Trash2, Building2, BedDouble, Users, DoorOpen, LayoutGrid,
  UserCog, ArrowLeftRight, LogOut, X, AlertTriangle, CheckCircle, Wrench, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, EmptyState, PageLoader, StatCard, FormRow, DateInput } from '../../components/ui';
import { format } from 'date-fns';

// ── Metadata ─────────────────────────────────────────────────────────────────
const HOSTEL_TYPE = {
  boys:  { label: 'Boys',  color: '#1a56e8', bg: '#eff6ff' },
  girls: { label: 'Girls', color: '#db2777', bg: '#fdf2f8' },
  mixed: { label: 'Mixed', color: '#8b5cf6', bg: '#faf5ff' },
};
const ROOM_STATUS = {
  available:   { label: 'Available',   color: '#16a34a', bg: '#f0fdf4' },
  full:        { label: 'Full',        color: '#dc2626', bg: '#fef2f2' },
  maintenance: { label: 'Maintenance', color: '#d97706', bg: '#fffbeb' },
  reserved:    { label: 'Reserved',    color: '#0891b2', bg: '#ecfeff' },
};
const ALLOC_STATUS = {
  active:      { label: 'Active',      color: '#16a34a', bg: '#f0fdf4' },
  transferred: { label: 'Transferred', color: '#0891b2', bg: '#ecfeff' },
  vacated:     { label: 'Vacated',     color: '#64748b', bg: '#f1f5f9' },
};
const WARDEN_ROLE = { chief_warden: 'Chief Warden', assistant_warden: 'Assistant Warden', warden: 'Warden' };
const ROOM_TYPE_CAP = { single: 1, double: 2, triple: 3 };

const Pill = ({ meta }) => meta
  ? <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
  : <span style={{ color: 'var(--text-muted)' }}>—</span>;

const clsLabel = (c) => c ? `${c.name}${c.section ? ' ' + c.section : ''}` : '—';

function OccBar({ occupied, capacity }) {
  const pct = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
  const color = pct >= 100 ? '#dc2626' : pct >= 75 ? '#d97706' : '#16a34a';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{occupied}/{capacity} beds</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: '#eef2f8', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 7, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

export default function Hostel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('dashboard');

  // filters
  const [roomHostel, setRoomHostel] = useState('');
  const [roomFloor, setRoomFloor] = useState('');
  const [roomStatus, setRoomStatus] = useState('');
  const [allocStatus, setAllocStatus] = useState('active');

  // modals
  const [hostelModal, setHostelModal] = useState(null); // {} new | {data} edit
  const [roomModal, setRoomModal] = useState(null);
  const [wardenModal, setWardenModal] = useState(false);
  const [allocModal, setAllocModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [vacateTarget, setVacateTarget] = useState(null);
  const [roomStudents, setRoomStudents] = useState(null); // room object
  const [deleteHostelId, setDeleteHostelId] = useState(null);
  const [deleteRoomId, setDeleteRoomId] = useState(null);
  const [removeWardenId, setRemoveWardenId] = useState(null);

  const refresh = () => {
    ['hostel-dashboard', 'hostel-hostels', 'hostel-rooms', 'hostel-wardens', 'hostel-allocations', 'hostel-available-rooms', 'hostel-room-students'].forEach(k => qc.invalidateQueries([k]));
  };

  const { data: hostelsData } = useQuery({ queryKey: ['hostel-hostels'], queryFn: () => api.get('/hostel/hostels') });
  const hostels = hostelsData?.hostels || [];
  const hostelOpts = hostels.map(h => ({ value: h._id, label: `${h.name} (${HOSTEL_TYPE[h.type]?.label || h.type})` }));

  const { data: dashData, isLoading: loadingDash } = useQuery({ queryKey: ['hostel-dashboard'], queryFn: () => api.get('/hostel/dashboard'), enabled: tab === 'dashboard' });
  const stats = dashData?.stats || {};

  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ['hostel-rooms', roomHostel, roomFloor, roomStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (roomHostel) p.set('hostel', roomHostel);
      if (roomFloor !== '') p.set('floor', roomFloor);
      if (roomStatus) p.set('status', roomStatus);
      return api.get(`/hostel/rooms?${p}`);
    },
    enabled: tab === 'rooms' || tab === 'occupancy',
  });
  const rooms = roomsData?.rooms || [];

  const { data: wardensData, isLoading: loadingWardens } = useQuery({ queryKey: ['hostel-wardens'], queryFn: () => api.get('/hostel/wardens'), enabled: tab === 'wardens' });
  const wardens = wardensData?.wardens || [];

  const { data: allocData, isLoading: loadingAllocs } = useQuery({
    queryKey: ['hostel-allocations', allocStatus],
    queryFn: () => api.get(`/hostel/allocations?status=${allocStatus}`),
    enabled: tab === 'allocation',
  });
  const allocations = allocData?.allocations || [];

  const delHostel = useMutation({
    mutationFn: (id) => api.delete(`/hostel/hostels/${id}`),
    onSuccess: () => { refresh(); toast.success('Hostel deleted'); setDeleteHostelId(null); },
    onError: (e) => { toast.error(e.message || 'Failed'); setDeleteHostelId(null); },
  });
  const delRoom = useMutation({
    mutationFn: (id) => api.delete(`/hostel/rooms/${id}`),
    onSuccess: () => { refresh(); toast.success('Room deleted'); setDeleteRoomId(null); },
    onError: (e) => { toast.error(e.message || 'Failed'); setDeleteRoomId(null); },
  });
  const delWarden = useMutation({
    mutationFn: (id) => api.delete(`/hostel/wardens/${id}`),
    onSuccess: () => { refresh(); toast.success('Warden removed'); setRemoveWardenId(null); },
    onError: (e) => { toast.error(e.message || 'Failed'); setRemoveWardenId(null); },
  });

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { key: 'hostels', label: 'Hostels', icon: Building2 },
    { key: 'rooms', label: 'Rooms', icon: DoorOpen },
    { key: 'allocation', label: 'Allocation', icon: BedDouble },
    { key: 'wardens', label: 'Wardens', icon: UserCog },
    { key: 'occupancy', label: 'Occupancy', icon: LayoutGrid },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hostel</h1>
          <p className="page-subtitle">Hostels, rooms, bed allocation &amp; wardens</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setHostelModal({})}><Plus size={16} /> Add Hostel</button>
          <button className="btn btn-secondary" onClick={() => setRoomModal({})}><Plus size={16} /> Add Room</button>
          <button className="btn btn-primary" onClick={() => setAllocModal(true)}><BedDouble size={16} /> Allocate Student</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', marginBottom: -2,
              fontSize: 14, fontWeight: tab === t.key ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`,
            }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (loadingDash ? <PageLoader /> : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <StatCard title="Total Hostels"     value={stats.totalHostels ?? 0}   icon={Building2}  color="#1a56e8" bg="#eff6ff" />
            <StatCard title="Total Rooms"        value={stats.totalRooms ?? 0}     icon={DoorOpen}   color="#0891b2" bg="#ecfeff" />
            <StatCard title="Occupied Beds"      value={stats.occupiedBeds ?? 0}   icon={BedDouble}  color="#16a34a" bg="#f0fdf4" />
            <StatCard title="Available Beds"     value={stats.availableBeds ?? 0}  icon={CheckCircle} color="#d97706" bg="#fffbeb" />
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 className="text-16-bold" style={{ marginBottom: 16 }}>Occupancy Summary</h3>
              {(dashData?.occupancySummary || []).length === 0
                ? <EmptyState icon={Building2} message="No hostels yet." action={<button className="btn btn-primary btn-sm" onClick={() => setHostelModal({})}><Plus size={14} /> Add Hostel</button>} />
                : (dashData.occupancySummary).map(h => (
                  <div key={h._id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Pill meta={HOSTEL_TYPE[h.type]} />
                      <span className="text-14-medium">{h.hostel}</span>
                    </div>
                    <OccBar occupied={h.occupied} capacity={h.capacity} />
                  </div>
                ))}
            </div>
            <div className="card">
              <h3 className="text-16-bold" style={{ marginBottom: 16 }}>Rooms with Free Beds</h3>
              {(dashData?.availableRooms || []).length === 0
                ? <EmptyState icon={DoorOpen} message="No free beds available right now." />
                : (dashData.availableRooms).map(r => (
                  <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <span className="text-14-medium">Room {r.room}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{r.hostel}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{r.available} bed{r.available === 1 ? '' : 's'} free</span>
                  </div>
                ))}
              <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={() => setAllocModal(true)}><BedDouble size={14} /> Allocate Student</button>
            </div>
          </div>
        </>
      ))}

      {/* ── HOSTELS ── */}
      {tab === 'hostels' && (
        hostels.length === 0 ? (
          <div className="card"><EmptyState icon={Building2} message="No hostels yet. Create your first hostel block." action={<button className="btn btn-primary btn-sm" onClick={() => setHostelModal({})}><Plus size={14} /> Add Hostel</button>} /></div>
        ) : (
          <div className="grid-3">
            {hostels.map(h => (
              <div key={h._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: HOSTEL_TYPE[h.type]?.bg || '#eff6ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Building2 size={22} color={HOSTEL_TYPE[h.type]?.color || '#1a56e8'} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="text-16-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</div>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 4 }}>
                        <Pill meta={HOSTEL_TYPE[h.type]} />
                        {h.block && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.block}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => setHostelModal({ data: h })}><Edit2 size={14} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => setDeleteHostelId(h._id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, flexWrap: 'wrap' }}>
                  <span>{h.totalFloors ?? 0} floor{h.totalFloors === 1 ? '' : 's'}</span>
                  <span>{h.rooms ?? 0} room{h.rooms === 1 ? '' : 's'}</span>
                  {h.contactNumber && <span>{h.contactNumber}</span>}
                </div>
                <OccBar occupied={h.occupied ?? 0} capacity={h.capacity ?? 0} />
                <div style={{ marginTop: 12 }}>
                  <Pill meta={{ active: { label: 'Active', color: '#16a34a', bg: '#f0fdf4' }, inactive: { label: 'Inactive', color: '#64748b', bg: '#f1f5f9' } }[h.status]} />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── ROOMS ── */}
      {tab === 'rooms' && (
        <>
          <div className="filter-bar">
            <AntSelect style={{ minWidth: 200 }} value={roomHostel || undefined} placeholder="All Hostels" allowClear options={hostelOpts} onChange={v => setRoomHostel(v ?? '')} />
            <AntSelect style={{ minWidth: 120 }} value={roomStatus || undefined} placeholder="All Status" allowClear onChange={v => setRoomStatus(v ?? '')}
              options={Object.entries(ROOM_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
            <input className="form-control" style={{ maxWidth: 120 }} type="number" placeholder="Floor" value={roomFloor} onChange={e => setRoomFloor(e.target.value)} />
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setRoomModal({})}><Plus size={14} /> Add Room</button>
          </div>
          {loadingRooms ? <PageLoader /> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead><tr><th>Room</th><th>Hostel</th><th>Floor</th><th>Type</th><th>Capacity</th><th>Occupied</th><th>Available</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                  <tbody>
                    {rooms.length === 0 && <tr><td colSpan={9}><EmptyState icon={DoorOpen} message="No rooms match the filters." action={<button className="btn btn-primary btn-sm" onClick={() => setRoomModal({})}><Plus size={14} /> Add Room</button>} /></td></tr>}
                    {rooms.map(r => (
                      <tr key={r._id}>
                        <td className="text-14-medium">{r.roomNumber}</td>
                        <td style={{ fontSize: 13 }}>{r.hostel?.name || '—'}</td>
                        <td style={{ fontSize: 13 }}>{r.floor}</td>
                        <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{r.roomType}</td>
                        <td style={{ fontSize: 13 }}>{r.capacity}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{r.occupied}</td>
                        <td style={{ fontSize: 13, fontWeight: 600, color: r.available > 0 ? '#16a34a' : 'var(--text-muted)' }}>{r.available}</td>
                        <td><Pill meta={ROOM_STATUS[r.status]} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm btn-icon" title="View students" onClick={() => setRoomStudents(r)}><Users size={14} /></button>
                            <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => setRoomModal({ data: r })}><Edit2 size={14} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => setDeleteRoomId(r._id)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ALLOCATION ── */}
      {tab === 'allocation' && (
        <>
          <div className="filter-bar">
            <AntSelect style={{ minWidth: 150 }} value={allocStatus} onChange={setAllocStatus}
              options={Object.entries(ALLOC_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAllocModal(true)}><BedDouble size={14} /> Allocate Student</button>
          </div>
          {loadingAllocs ? <PageLoader /> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead><tr><th>Student</th><th>Class</th><th>Hostel</th><th>Room</th><th>Bed</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                  <tbody>
                    {allocations.length === 0 && <tr><td colSpan={8}><EmptyState icon={BedDouble} message={`No ${allocStatus} allocations.`} action={<button className="btn btn-primary btn-sm" onClick={() => setAllocModal(true)}><BedDouble size={14} /> Allocate Student</button>} /></td></tr>}
                    {allocations.map(a => (
                      <tr key={a._id}>
                        <td>
                          <div className="text-14-medium">{a.student?.name || '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.student?.admissionNumber}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{clsLabel(a.student?.currentClass)}</td>
                        <td style={{ fontSize: 13 }}>{a.hostel?.name || '—'}</td>
                        <td style={{ fontSize: 13 }}>{a.room?.roomNumber || '—'}</td>
                        <td style={{ fontSize: 13 }}>{a.bedNumber || '—'}</td>
                        <td style={{ fontSize: 13 }}>{a.allocationDate ? format(new Date(a.allocationDate), 'dd MMM yyyy') : '—'}</td>
                        <td><Pill meta={ALLOC_STATUS[a.status]} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {a.status === 'active' && <>
                              <button className="btn btn-secondary btn-sm btn-icon" title="Transfer" onClick={() => setTransferTarget(a)}><ArrowLeftRight size={14} /></button>
                              <button className="btn btn-secondary btn-sm btn-icon" title="Vacate" onClick={() => setVacateTarget(a)}><LogOut size={14} /></button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── WARDENS ── */}
      {tab === 'wardens' && (
        <>
          <div className="filter-bar">
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setWardenModal(true)}><Plus size={14} /> Assign Warden</button>
          </div>
          {loadingWardens ? <PageLoader /> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead><tr><th>Warden</th><th>Role</th><th>Hostel</th><th>Contact</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                  <tbody>
                    {wardens.length === 0 && <tr><td colSpan={5}><EmptyState icon={UserCog} message="No wardens assigned yet." action={<button className="btn btn-primary btn-sm" onClick={() => setWardenModal(true)}><Plus size={14} /> Assign Warden</button>} /></td></tr>}
                    {wardens.map(w => (
                      <tr key={w._id}>
                        <td className="text-14-medium">{w.employee?.name || '—'}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.employee?.designation || w.employee?.employeeId}</div></td>
                        <td style={{ fontSize: 13 }}>{WARDEN_ROLE[w.role] || w.role}</td>
                        <td><span style={{ fontSize: 13 }}>{w.hostel?.name || '—'}</span></td>
                        <td style={{ fontSize: 13 }}>{w.employee?.phone || '—'}</td>
                        <td><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm btn-icon" title="Remove" onClick={() => setRemoveWardenId(w._id)}><Trash2 size={14} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── OCCUPANCY ── */}
      {tab === 'occupancy' && (
        <>
          <div className="filter-bar">
            <AntSelect style={{ minWidth: 200 }} value={roomHostel || undefined} placeholder="All Hostels" allowClear options={hostelOpts} onChange={v => setRoomHostel(v ?? '')} />
            <AntSelect style={{ minWidth: 120 }} value={roomStatus || undefined} placeholder="All Status" allowClear onChange={v => setRoomStatus(v ?? '')}
              options={Object.entries(ROOM_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
            <input className="form-control" style={{ maxWidth: 120 }} type="number" placeholder="Floor" value={roomFloor} onChange={e => setRoomFloor(e.target.value)} />
          </div>
          {loadingRooms ? <PageLoader /> : (
            rooms.length === 0 ? <div className="card"><EmptyState icon={LayoutGrid} message="No rooms match the filters." /></div> : (
              <div className="grid-4">
                {rooms.map(r => (
                  <div key={r._id} className="card" style={{ cursor: 'pointer' }} onClick={() => setRoomStudents(r)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div className="text-16-bold">Room {r.roomNumber}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.hostel?.name} · Floor {r.floor}</div>
                      </div>
                      <Pill meta={ROOM_STATUS[r.status]} />
                    </div>
                    <OccBar occupied={r.occupied} capacity={r.capacity} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      <span>View students</span><ChevronRight size={15} />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* ── Modals ── */}
      {hostelModal && <HostelModal data={hostelModal.data} onClose={() => setHostelModal(null)} onSaved={() => { refresh(); setHostelModal(null); }} />}
      {roomModal && <RoomModal data={roomModal.data} hostelOpts={hostelOpts} defaultHostel={roomHostel} onClose={() => setRoomModal(null)} onSaved={() => { refresh(); setRoomModal(null); }} />}
      {wardenModal && <WardenModal hostelOpts={hostelOpts} onClose={() => setWardenModal(false)} onSaved={() => { refresh(); setWardenModal(false); }} />}
      {allocModal && <AllocateModal hostels={hostels} hostelOpts={hostelOpts} onClose={() => setAllocModal(false)} onSaved={() => { refresh(); setAllocModal(false); }} />}
      {transferTarget && <TransferModal alloc={transferTarget} hostelOpts={hostelOpts} onClose={() => setTransferTarget(null)} onSaved={() => { refresh(); setTransferTarget(null); }} />}
      {vacateTarget && <VacateModal alloc={vacateTarget} onClose={() => setVacateTarget(null)} onSaved={() => { refresh(); setVacateTarget(null); }} />}
      {roomStudents && <RoomStudentsModal room={roomStudents} onClose={() => setRoomStudents(null)}
        onTransfer={(a) => { setRoomStudents(null); setTransferTarget(a); }} onVacate={(a) => { setRoomStudents(null); setVacateTarget(a); }} />}

      <ConfirmDialog open={!!deleteHostelId} onClose={() => setDeleteHostelId(null)} onConfirm={() => delHostel.mutate(deleteHostelId)} danger title="Delete hostel?" message="This removes the hostel and its rooms. Vacate all students first." />
      <ConfirmDialog open={!!deleteRoomId} onClose={() => setDeleteRoomId(null)} onConfirm={() => delRoom.mutate(deleteRoomId)} danger title="Delete room?" message="This permanently removes the room. Vacate students first." />
      <ConfirmDialog open={!!removeWardenId} onClose={() => setRemoveWardenId(null)} onConfirm={() => delWarden.mutate(removeWardenId)} danger title="Remove warden?" message="This removes the warden assignment." />
    </div>
  );
}

// ── Hostel add/edit ──────────────────────────────────────────────────────────
function HostelModal({ data, onClose, onSaved }) {
  const isEdit = !!data;
  const [f, setF] = useState({
    name: data?.name || '', type: data?.type || 'boys', block: data?.block || '',
    totalFloors: data?.totalFloors ?? 1, contactNumber: data?.contactNumber || '', status: data?.status || 'active',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => isEdit ? api.put(`/hostel/hostels/${data._id}`, f) : api.post('/hostel/hostels', f),
    onSuccess: () => { toast.success(isEdit ? 'Hostel updated' : 'Hostel created'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });
  const submit = () => { if (!f.name.trim()) return toast.error('Hostel name is required'); m.mutate(); };
  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Hostel' : 'Add Hostel'}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button></>}>
      <FormRow>
        <div className="form-group"><label className="form-label">Hostel Name *</label><input className="form-control" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SKV Boys Hostel" /></div>
        <div className="form-group"><label className="form-label">Type *</label>
          <AntSelect style={{ width: '100%' }} value={f.type} onChange={v => set('type', v)} options={Object.entries(HOSTEL_TYPE).map(([value, mt]) => ({ value, label: mt.label }))} /></div>
      </FormRow>
      <FormRow>
        <div className="form-group"><label className="form-label">Building / Block</label><input className="form-control" value={f.block} onChange={e => set('block', e.target.value)} placeholder="e.g. A Block" /></div>
        <div className="form-group"><label className="form-label">Total Floors</label><input className="form-control" type="number" min={1} value={f.totalFloors} onChange={e => set('totalFloors', e.target.value)} /></div>
      </FormRow>
      <FormRow>
        <div className="form-group"><label className="form-label">Contact Number</label><input className="form-control" value={f.contactNumber} onChange={e => set('contactNumber', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <AntSelect style={{ width: '100%' }} value={f.status} onChange={v => set('status', v)} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div>
      </FormRow>
    </Modal>
  );
}

// ── Room add/edit ────────────────────────────────────────────────────────────
function RoomModal({ data, hostelOpts, defaultHostel, onClose, onSaved }) {
  const isEdit = !!data;
  const [f, setF] = useState({
    hostel: data?.hostel?._id || data?.hostel || defaultHostel || '', floor: data?.floor ?? 0,
    roomNumber: data?.roomNumber || '', roomType: data?.roomType || 'single',
    capacity: data?.capacity ?? 1, status: data?.status || 'available',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setType = (t) => setF(p => ({ ...p, roomType: t, capacity: ROOM_TYPE_CAP[t] || p.capacity }));
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, floor: Number(f.floor) || 0, capacity: Number(f.capacity) || 1 };
      return isEdit ? api.put(`/hostel/rooms/${data._id}`, body) : api.post('/hostel/rooms', body);
    },
    onSuccess: () => { toast.success(isEdit ? 'Room updated' : 'Room created'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });
  const submit = () => { if (!f.hostel) return toast.error('Select a hostel'); if (!f.roomNumber.trim()) return toast.error('Room number is required'); m.mutate(); };
  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Room' : 'Add Room'}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button></>}>
      <FormRow>
        <div className="form-group"><label className="form-label">Hostel *</label>
          <AntSelect style={{ width: '100%' }} value={f.hostel || undefined} placeholder="Select hostel" options={hostelOpts} onChange={v => set('hostel', v)} disabled={isEdit} /></div>
        <div className="form-group"><label className="form-label">Floor</label><input className="form-control" type="number" min={0} value={f.floor} onChange={e => set('floor', e.target.value)} /></div>
      </FormRow>
      <FormRow>
        <div className="form-group"><label className="form-label">Room Number *</label><input className="form-control" value={f.roomNumber} onChange={e => set('roomNumber', e.target.value)} placeholder="e.g. 201" /></div>
        <div className="form-group"><label className="form-label">Room Type</label>
          <AntSelect style={{ width: '100%' }} value={f.roomType} onChange={setType} options={['single', 'double', 'triple', 'custom'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} /></div>
      </FormRow>
      <FormRow>
        <div className="form-group"><label className="form-label">Capacity *</label><input className="form-control" type="number" min={1} value={f.capacity} onChange={e => set('capacity', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <AntSelect style={{ width: '100%' }} value={f.status} onChange={v => set('status', v)} options={Object.entries(ROOM_STATUS).map(([value, mt]) => ({ value, label: mt.label }))} /></div>
      </FormRow>
    </Modal>
  );
}

// ── Assign warden ────────────────────────────────────────────────────────────
function WardenModal({ hostelOpts, onClose, onSaved }) {
  const [f, setF] = useState({ employee: '', hostel: '', role: 'warden', startDate: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const { data: empData } = useQuery({ queryKey: ['employees-min'], queryFn: () => api.get('/employees?limit=1000') });
  const empOpts = (empData?.employees || []).map(e => ({ value: e._id, label: `${e.name}${e.designation ? ' · ' + e.designation : ''}` }));
  const m = useMutation({
    mutationFn: () => api.post('/hostel/wardens', f),
    onSuccess: () => { toast.success('Warden assigned'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });
  const submit = () => { if (!f.employee) return toast.error('Select an employee'); if (!f.hostel) return toast.error('Select a hostel'); m.mutate(); };
  return (
    <Modal open onClose={onClose} title="Assign Warden"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Assign'}</button></>}>
      <div className="form-group"><label className="form-label">Employee *</label>
        <AntSelect showSearch optionFilterProp="label" style={{ width: '100%' }} value={f.employee || undefined} placeholder="Select employee" options={empOpts} onChange={v => set('employee', v)} /></div>
      <FormRow>
        <div className="form-group"><label className="form-label">Warden Role</label>
          <AntSelect style={{ width: '100%' }} value={f.role} onChange={v => set('role', v)} options={Object.entries(WARDEN_ROLE).map(([value, label]) => ({ value, label }))} /></div>
        <div className="form-group"><label className="form-label">Assigned Hostel *</label>
          <AntSelect style={{ width: '100%' }} value={f.hostel || undefined} placeholder="Select hostel" options={hostelOpts} onChange={v => set('hostel', v)} /></div>
      </FormRow>
      <div className="form-group"><label className="form-label">Start Date</label><DateInput value={f.startDate} onChange={v => set('startDate', v)} /></div>
    </Modal>
  );
}

// shared room+bed picker for allocate/transfer
function RoomBedPicker({ hostel, room, bed, onRoom, onBed }) {
  const { data, isFetching } = useQuery({
    queryKey: ['hostel-available-rooms', hostel],
    queryFn: () => api.get(`/hostel/available-rooms?hostel=${hostel}`),
    enabled: !!hostel,
  });
  const avail = data?.rooms || [];
  const roomOpts = avail.map(r => ({ value: r._id, label: `Room ${r.roomNumber} · Floor ${r.floor} · ${r.available} free` }));
  const selected = avail.find(r => r._id === room);
  const bedOpts = (selected?.freeBeds || []).map(b => ({ value: b, label: b }));
  return (
    <FormRow>
      <div className="form-group"><label className="form-label">Room *</label>
        <AntSelect style={{ width: '100%' }} value={room || undefined} placeholder={hostel ? (isFetching ? 'Loading…' : 'Select room') : 'Select hostel first'}
          notFoundContent={hostel ? 'No rooms with free beds' : null} options={roomOpts} onChange={onRoom} disabled={!hostel} /></div>
      <div className="form-group"><label className="form-label">Bed Number</label>
        <AntSelect style={{ width: '100%' }} value={bed || undefined} placeholder="Auto-assign" allowClear options={bedOpts} onChange={v => onBed(v ?? '')} disabled={!room} /></div>
    </FormRow>
  );
}

// ── Allocate student ─────────────────────────────────────────────────────────
function AllocateModal({ hostels, hostelOpts, onClose, onSaved }) {
  const [f, setF] = useState({ student: '', hostel: '', room: '', bedNumber: '', allocationDate: new Date().toISOString().split('T')[0], remarks: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const { data: stuData } = useQuery({ queryKey: ['students-active'], queryFn: () => api.get('/students?status=active&limit=1000') });
  const students = stuData?.students || [];
  const stuOpts = students.map(s => ({ value: s._id, label: `${s.name} · ${s.admissionNumber}` }));
  const student = students.find(s => s._id === f.student);
  const hostelObj = hostels.find(h => h._id === f.hostel);
  // gender hint
  let genderWarn = '';
  if (student && hostelObj) {
    if (hostelObj.type === 'boys' && student.gender !== 'male') genderWarn = 'This is a boys hostel — only male students can be allocated.';
    if (hostelObj.type === 'girls' && student.gender !== 'female') genderWarn = 'This is a girls hostel — only female students can be allocated.';
  }
  const m = useMutation({
    mutationFn: () => api.post('/hostel/allocations', f),
    onSuccess: () => { toast.success('Student allocated'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });
  const submit = () => {
    if (!f.student) return toast.error('Select a student');
    if (!f.hostel) return toast.error('Select a hostel');
    if (!f.room) return toast.error('Select a room');
    if (genderWarn) return toast.error(genderWarn);
    m.mutate();
  };
  return (
    <Modal open onClose={onClose} title="Allocate Student"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>{m.isPending ? 'Allocating…' : 'Allocate'}</button></>}>
      <div className="form-group"><label className="form-label">Student *</label>
        <AntSelect showSearch optionFilterProp="label" style={{ width: '100%' }} value={f.student || undefined} placeholder="Search student by name or admission no"
          options={stuOpts} onChange={v => set('student', v)} /></div>
      {student && <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)', margin: '-6px 0 12px' }}>
        <span>Class: <b>{clsLabel(student.currentClass)}</b></span>
        <span>Gender: <b style={{ textTransform: 'capitalize' }}>{student.gender}</b></span>
      </div>}
      <div className="form-group"><label className="form-label">Hostel *</label>
        <AntSelect style={{ width: '100%' }} value={f.hostel || undefined} placeholder="Select hostel" options={hostelOpts} onChange={v => setF(p => ({ ...p, hostel: v, room: '', bedNumber: '' }))} /></div>
      <RoomBedPicker hostel={f.hostel} room={f.room} bed={f.bedNumber} onRoom={v => setF(p => ({ ...p, room: v, bedNumber: '' }))} onBed={v => set('bedNumber', v)} />
      {genderWarn && <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}><AlertTriangle size={15} /> {genderWarn}</div>}
      <FormRow>
        <div className="form-group"><label className="form-label">Allocation Date</label><DateInput value={f.allocationDate} onChange={v => set('allocationDate', v)} /></div>
        <div className="form-group"><label className="form-label">Remarks</label><input className="form-control" value={f.remarks} onChange={e => set('remarks', e.target.value)} /></div>
      </FormRow>
    </Modal>
  );
}

// ── Transfer ─────────────────────────────────────────────────────────────────
function TransferModal({ alloc, hostelOpts, onClose, onSaved }) {
  const [f, setF] = useState({ hostel: alloc.hostel?._id || alloc.hostel || '', room: '', bedNumber: '', reason: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => api.post(`/hostel/allocations/${alloc._id}/transfer`, f),
    onSuccess: () => { toast.success('Student transferred'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });
  const submit = () => { if (!f.hostel) return toast.error('Select a hostel'); if (!f.room) return toast.error('Select a room'); m.mutate(); };
  return (
    <Modal open onClose={onClose} title="Transfer Student"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>{m.isPending ? 'Transferring…' : 'Transfer'}</button></>}>
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>
        <b>{alloc.student?.name}</b> · {alloc.student?.admissionNumber}
        <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Currently: {alloc.hostel?.name || '—'} · Room {alloc.room?.roomNumber || '—'} · Bed {alloc.bedNumber || '—'}</div>
      </div>
      <div className="form-group"><label className="form-label">New Hostel *</label>
        <AntSelect style={{ width: '100%' }} value={f.hostel || undefined} placeholder="Select hostel" options={hostelOpts} onChange={v => setF(p => ({ ...p, hostel: v, room: '', bedNumber: '' }))} /></div>
      <RoomBedPicker hostel={f.hostel} room={f.room} bed={f.bedNumber} onRoom={v => setF(p => ({ ...p, room: v, bedNumber: '' }))} onBed={v => set('bedNumber', v)} />
      <div className="form-group"><label className="form-label">Reason</label><input className="form-control" value={f.reason} onChange={e => set('reason', e.target.value)} placeholder="Reason for transfer" /></div>
    </Modal>
  );
}

// ── Vacate ───────────────────────────────────────────────────────────────────
function VacateModal({ alloc, onClose, onSaved }) {
  const [f, setF] = useState({ vacateDate: new Date().toISOString().split('T')[0], reason: '' });
  const m = useMutation({
    mutationFn: () => api.post(`/hostel/allocations/${alloc._id}/vacate`, f),
    onSuccess: () => { toast.success('Bed released'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });
  return (
    <Modal open onClose={onClose} title="Vacate Student"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? 'Releasing…' : 'Release Bed'}</button></>}>
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>
        <b>{alloc.student?.name}</b> · {alloc.student?.admissionNumber}
        <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{alloc.hostel?.name || ''} {alloc.room?.roomNumber ? `· Room ${alloc.room.roomNumber}` : ''} {alloc.bedNumber ? `· Bed ${alloc.bedNumber}` : ''}</div>
      </div>
      <FormRow>
        <div className="form-group"><label className="form-label">Vacate Date</label><DateInput value={f.vacateDate} onChange={v => setF(p => ({ ...p, vacateDate: v }))} /></div>
        <div className="form-group"><label className="form-label">Reason</label><input className="form-control" value={f.reason} onChange={e => setF(p => ({ ...p, reason: e.target.value }))} /></div>
      </FormRow>
    </Modal>
  );
}

// ── Room students ────────────────────────────────────────────────────────────
function RoomStudentsModal({ room, onClose, onTransfer, onVacate }) {
  const { data, isLoading } = useQuery({ queryKey: ['hostel-room-students', room._id], queryFn: () => api.get(`/hostel/rooms/${room._id}/students`) });
  const list = data?.students || [];
  return (
    <Modal open onClose={onClose} title={`Room ${room.roomNumber} · ${room.hostel?.name || ''}`}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span>Capacity: <b>{room.capacity}</b></span>
        <span>Occupied: <b>{room.occupied}</b></span>
        <span>Available: <b style={{ color: '#16a34a' }}>{room.available}</b></span>
      </div>
      {isLoading ? <div style={{ padding: 20 }}><PageLoader rows={3} /></div> : (
        list.length === 0 ? <EmptyState icon={BedDouble} message="No students in this room yet." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(a => (
              <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#eff6ff', color: '#1a56e8', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{a.bedNumber || '—'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-14-medium">{a.student?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.student?.admissionNumber} · {clsLabel(a.student?.currentClass)}</div>
                </div>
                <button className="btn btn-secondary btn-sm btn-icon" title="Transfer" onClick={() => onTransfer(a)}><ArrowLeftRight size={14} /></button>
                <button className="btn btn-secondary btn-sm btn-icon" title="Vacate" onClick={() => onVacate(a)}><LogOut size={14} /></button>
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}
