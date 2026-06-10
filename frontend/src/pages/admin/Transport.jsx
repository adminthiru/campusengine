import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bus, Plus, Edit2, Trash2, Users, Phone, Hash, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select as AntSelect } from 'antd';
import api from '../../utils/api';
import { PageLoader, EmptyState, StatCard, Modal, FormRow, ConfirmDialog } from '../../components/ui';

const VEHICLE_TYPES = [
  { value: 'bus',   label: 'Bus',   color: '#1a56e8', bg: '#eff6ff' },
  { value: 'van',   label: 'Van',   color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'car',   label: 'Car',   color: '#0891b2', bg: '#ecfeff' },
  { value: 'auto',  label: 'Auto',  color: '#d97706', bg: '#fffbeb' },
  { value: 'bike',  label: 'Bike',  color: '#059669', bg: '#f0fdf4' },
  { value: 'other', label: 'Other', color: '#6b7280', bg: '#f3f4f6' },
];

const typeInfo = (v) => VEHICLE_TYPES.find(t => t.value === v) || VEHICLE_TYPES[5];

function TypeBadge({ type }) {
  const t = typeInfo(type);
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: t.bg, color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {t.label}
    </span>
  );
}

export default function Transport() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [viewVehicle, setViewVehicle] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transport'],
    queryFn: () => api.get('/transport')
  });
  const vehicles = data?.routes || [];

  const deleteMutation = useMutation({
    mutationFn: () => Promise.all(selected.map(id => api.delete(`/transport/${id}`))),
    onSuccess: () => {
      qc.invalidateQueries(['transport']);
      toast.success(`${selected.length} vehicle${selected.length > 1 ? 's' : ''} deleted`);
      setSelected([]);
      setConfirmDelete(false);
    },
    onError: () => { toast.error('Failed to delete'); setConfirmDelete(false); }
  });

  const allSelected = vehicles.length > 0 && vehicles.every(v => selected.includes(v._id));
  const toggleAll = (checked) => setSelected(checked ? vehicles.map(v => v._id) : []);
  const toggleOne = (id, checked) => setSelected(p => checked ? [...p, id] : p.filter(i => i !== id));

  const totalStudents = vehicles.reduce((s, v) => s + (v.studentCount || 0), 0);
  const busCount = vehicles.filter(v => v.vehicleType === 'bus').length;
  const activeCount = vehicles.filter(v => v.isActive).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transport</h1>
          <p className="page-subtitle">Manage school vehicles and routes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditVehicle(null); setShowModal(true); }}>
            <Plus size={16} /> Add Vehicle
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total Vehicles" value={vehicles.length} icon={Bus} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Buses" value={busCount} icon={Bus} color="#7c3aed" bg="#f5f3ff" sub="registered" />
        <StatCard title="Active" value={activeCount} icon={Bus} color="#10b981" bg="#f0fdf4" sub="in service" />
        <StatCard title="Students Assigned" value={totalStudents} icon={Users} color="#f59e0b" bg="#fffbeb" sub="using transport" />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} /></th>
                  <th>Assign No.</th>
                  <th>Vehicle No.</th>
                  <th>Type</th>
                  <th>Name / Route</th>
                  <th>Driver</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 && (
                  <tr><td colSpan={9}>
                    <EmptyState icon={Bus} message='No vehicles added yet. Click "Add Vehicle" to get started.' />
                  </td></tr>
                )}
                {vehicles.map(v => (
                  <tr key={v._id} onClick={() => setViewVehicle(v)} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(v._id)} onChange={e => toggleOne(v._id, e.target.checked)} />
                    </td>
                    <td>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#1a56e8', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                        {v.routeNumber ? `#${v.routeNumber}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
                        {v.vehicleNumber || '—'}
                      </span>
                    </td>
                    <td><TypeBadge type={v.vehicleType} /></td>
                    <td className="text-14-semibold">{v.routeName}</td>
                    <td>
                      {v.driverName ? (
                        <>
                          <div className="text-14-regular">{v.driverName}</div>
                          {v.driverPhone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                              <Phone size={11} />{v.driverPhone}
                            </div>
                          )}
                        </>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a56e8' }}>{v.studentCount || 0}</span>
                      {v.capacity > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> / {v.capacity}</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: v.isActive ? '#dcfce7' : '#f1f5f9',
                        color: v.isActive ? '#166534' : '#6b7280'
                      }}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => { setEditVehicle(v); setShowModal(true); }} title="Edit">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <VehicleModal
          vehicle={editVehicle}
          onClose={() => { setShowModal(false); setEditVehicle(null); }}
          onSuccess={() => { qc.invalidateQueries(['transport']); setShowModal(false); setEditVehicle(null); }}
        />
      )}

      {viewVehicle && (
        <VehicleDetailModal
          vehicle={viewVehicle}
          onClose={() => setViewVehicle(null)}
          onEdit={() => { setEditVehicle(viewVehicle); setViewVehicle(null); setShowModal(true); }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Vehicles"
        message={`This will permanently delete ${selected.length} vehicle${selected.length > 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function VehicleDetailModal({ vehicle: v, onClose, onEdit }) {
  const [tab, setTab] = useState('details');

  const { data: stuData, isLoading: stuLoading } = useQuery({
    queryKey: ['transport-students', v._id],
    queryFn: () => api.get(`/transport/${v._id}/students`),
    enabled: tab === 'students',
  });
  const students = stuData?.students || [];

  const t = typeInfo(v.vehicleType);

  const InfoRow = ({ label, value }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value}</span>
    </div>
  ) : null;

  const filledPct = v.capacity > 0 ? Math.min(100, Math.round(((v.studentCount || 0) / v.capacity) * 100)) : 0;

  return (
    <Modal open onClose={onClose} title="Vehicle Details" size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={onEdit}><Edit2 size={14} /> Edit</button>
      </>}>

      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, ${t.color} 0%, ${t.color}cc 100%)`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{v.routeName}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>
            {v.vehicleType?.charAt(0).toUpperCase() + v.vehicleType?.slice(1)}
            {v.routeNumber && ` · Route #${v.routeNumber}`}
            {v.vehicleNumber && ` · ${v.vehicleNumber}`}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 700,
              background: v.isActive ? '#dcfce7' : '#f1f5f9',
              color: v.isActive ? '#166534' : '#6b7280'
            }}>{v.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Students</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{v.studentCount || 0}</div>
          {v.capacity > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>of {v.capacity} seats</div>}
        </div>
      </div>

      {/* Capacity bar */}
      {v.capacity > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
            <span>Capacity utilisation</span>
            <span>{filledPct}%</span>
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 8 }}>
            <div style={{ height: '100%', width: `${filledPct}%`, borderRadius: 8,
              background: filledPct >= 90 ? '#ef4444' : filledPct >= 70 ? '#f59e0b' : '#10b981',
              transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[{ key: 'details', label: 'Details' }, { key: 'students', label: `Students (${v.studentCount || 0})` }].map(t => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Vehicle Info</div>
            <InfoRow label="Vehicle Type" value={v.vehicleType?.charAt(0).toUpperCase() + v.vehicleType?.slice(1)} />
            <InfoRow label="Vehicle Number" value={v.vehicleNumber} />
            <InfoRow label="Assign Number" value={v.routeNumber ? `#${v.routeNumber}` : null} />
            <InfoRow label="Capacity" value={v.capacity ? `${v.capacity} seats` : null} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Staff</div>
            <InfoRow label="Driver" value={v.driverName} />
            <InfoRow label="Driver Phone" value={v.driverPhone} />
            <InfoRow label="Conductor" value={v.conductorName} />
            <InfoRow label="Conductor Phone" value={v.conductorPhone} />
            <InfoRow label="Route" value={v.routeDescription} />
          </div>
        </div>
      )}

      {tab === 'students' && (
        stuLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Loading students…</div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Users size={36} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>No students assigned to this vehicle yet.</div>
          </div>
        ) : (
          <div className="table-container" style={{ margin: '0 -8px', borderRadius: 16, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Admission No.</th>
                  <th>Class</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s._id}>
                    <td className="text-14-regular" style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</td>
                    <td className="text-14-medium">{s.name}</td>
                    <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{s.admissionNumber || '—'}</td>
                    <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>
                      {s.currentClass ? `${s.currentClass.name}${s.currentClass.section ? ' ' + s.currentClass.section : ''}` : '—'}
                    </td>
                    <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>
                      {s.phone ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{s.phone}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Modal>
  );
}

function VehicleModal({ vehicle, onClose, onSuccess }) {
  const isEdit = !!vehicle;
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType || 'bus');
  const [routeName, setRouteName] = useState(vehicle?.routeName || '');
  const [routeNumber, setRouteNumber] = useState(vehicle?.routeNumber || '');
  const [vehicleNumber, setVehicleNumber] = useState(vehicle?.vehicleNumber || '');
  const [driverName, setDriverName] = useState(vehicle?.driverName || '');
  const [driverPhone, setDriverPhone] = useState(vehicle?.driverPhone || '');
  const [conductorName, setConductorName] = useState(vehicle?.conductorName || '');
  const [conductorPhone, setConductorPhone] = useState(vehicle?.conductorPhone || '');
  const [routeDescription, setRouteDescription] = useState(vehicle?.routeDescription || '');
  const [capacity, setCapacity] = useState(vehicle?.capacity || '');
  const [isActive, setIsActive] = useState(vehicle?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!routeName.trim()) return toast.error('Vehicle name / route is required');
    setLoading(true);
    const payload = {
      vehicleType, routeName: routeName.trim(), routeNumber, vehicleNumber,
      driverName, driverPhone, conductorName, conductorPhone, routeDescription,
      capacity: capacity ? Number(capacity) : undefined, isActive
    };
    try {
      if (isEdit) {
        await api.put(`/transport/${vehicle._id}`, payload);
        toast.success('Vehicle updated!');
      } else {
        await api.post('/transport', payload);
        toast.success('Vehicle added!');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Vehicle')}
        </button>
      </>}>

      <div className="form-group">
        <label className="form-label">Vehicle Type <span style={{ color: '#ef4444' }}>*</span></label>
        <AntSelect
          style={{ width: '100%' }}
          value={vehicleType}
          onChange={setVehicleType}
          options={VEHICLE_TYPES.map(t => ({ value: t.value, label: t.label, color: t.color, bg: t.bg }))}
          optionRender={(option) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: option.data.color, flexShrink: 0 }} />
              <span>{option.data.label}</span>
            </div>
          )}
          labelRender={({ value: v }) => {
            const t = typeInfo(v);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span>{t.label}</span>
              </div>
            );
          }}
        />
      </div>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Vehicle Name / Route <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="e.g. Route A — Velachery" />
        </div>
        <div className="form-group">
          <label className="form-label">Assign Number</label>
          <input className="form-control" value={routeNumber} onChange={e => setRouteNumber(e.target.value)} placeholder={isEdit ? '' : 'Auto-generated if blank'} />
          {!isEdit && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Leave blank to auto-assign next number</div>}
        </div>
      </FormRow>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Vehicle Number</label>
          <input className="form-control" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. TN 01 AB 1234" />
        </div>
        <div className="form-group">
          <label className="form-label">Capacity (seats)</label>
          <input className="form-control" type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 40" />
        </div>
      </FormRow>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Driver Name</label>
          <input className="form-control" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="form-group">
          <label className="form-label">Driver Phone</label>
          <input className="form-control" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="9876543210" />
        </div>
      </FormRow>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Conductor Name</label>
          <input className="form-control" value={conductorName} onChange={e => setConductorName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="form-group">
          <label className="form-label">Conductor Phone</label>
          <input className="form-control" value={conductorPhone} onChange={e => setConductorPhone(e.target.value)} placeholder="9876543210" />
        </div>
      </FormRow>

      <div className="form-group">
        <label className="form-label">Route</label>
        <input className="form-control" value={routeDescription} onChange={e => setRouteDescription(e.target.value)} placeholder="e.g. Velachery → Tambaram → Chromepet → Central" />
      </div>

      <div className="form-group">
        <label className="form-label">Status</label>
        <AntSelect
          style={{ width: '100%' }}
          value={isActive}
          onChange={setIsActive}
          options={[
            { value: true, label: 'Active' },
            { value: false, label: 'Inactive' },
          ]}
        />
      </div>
    </Modal>
  );
}
