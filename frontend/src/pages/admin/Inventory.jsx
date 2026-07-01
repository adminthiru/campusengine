import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2, Edit2, Package, Wrench, CheckCircle, AlertTriangle, Boxes, Tag, X, Link2, ArrowLeft, ChevronRight, ShoppingCart, PackageCheck, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, Pagination, SearchInput, PageLoader, EmptyState, StatCard, FormRow, Avatar } from '../../components/ui';
import { format } from 'date-fns';

const DEFAULT_CATEGORIES = ['Computers', 'Lab Equipment', 'Furniture', 'Electronics', 'Projectors', 'Sports', 'Musical', 'Books & Media', 'Network', 'Other'];
const DEFAULT_LOCATIONS  = ['Computer Lab', 'Science Lab', 'Library', 'Staff Room', 'Classroom', 'Office', 'Sports Room', 'Storeroom', 'Other'];

const STATUS_META = {
  in_use:     { label: 'In Use',     color: '#16a34a', bg: '#f0fdf4' },
  in_storage: { label: 'In Storage', color: '#0891b2', bg: '#ecfeff' },
  in_repair:  { label: 'In Repair',  color: '#d97706', bg: '#fffbeb' },
  damaged:    { label: 'Damaged',    color: '#dc2626', bg: '#fef2f2' },
  disposed:   { label: 'Disposed',   color: '#64748b', bg: '#f1f5f9' },
  lost:       { label: 'Lost',       color: '#b91c1c', bg: '#fef2f2' },
  purchase_requested: { label: 'Purchase Requested', color: '#7c3aed', bg: '#f5f3ff' },
};
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));
// statuses an admin can set manually on an item (in_repair + purchase_requested are driven by their flows)
const ITEM_STATUS_OPTIONS = STATUS_OPTIONS.filter(o => o.value !== 'in_repair' && o.value !== 'purchase_requested');

const REPAIR_STATUS_META = {
  pending:     { label: 'Pending',     color: '#d97706', bg: '#fffbeb' },
  in_progress: { label: 'In Progress', color: '#1a56e8', bg: '#eff6ff' },
  completed:   { label: 'Completed',   color: '#16a34a', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   color: '#64748b', bg: '#f1f5f9' },
};

const REQUEST_STATUS_META = {
  pending:   { label: 'Pending',   color: '#d97706', bg: '#fffbeb' },
  ordered:   { label: 'Ordered',   color: '#1a56e8', bg: '#eff6ff' },
  received:  { label: 'Received',  color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: '#f1f5f9' },
};
const REQUEST_STATUS_OPTIONS = Object.entries(REQUEST_STATUS_META).map(([value, m]) => ({ value, label: m.label }));

function Pill({ meta }) {
  if (!meta) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
}

export default function Inventory() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('items');
  const [selectedCategory, setSelectedCategory] = useState(null); // null = category grid; string = drill-in
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [sendRepairItems, setSendRepairItems] = useState(null); // array of items
  const [completeTarget, setCompleteTarget] = useState(null); // { itemId, repair }
  const [damagedTarget, setDamagedTarget] = useState(null);   // { itemId, name } — after a repair is closed as damaged
  const [logVisitTarget, setLogVisitTarget] = useState(null); // { itemId, repair }
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  // Purchase requests
  const [reqSearch, setReqSearch] = useState('');
  const [reqStatus, setReqStatus] = useState('');
  const [reqPage, setReqPage] = useState(1);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editRequest, setEditRequest] = useState(null);
  const [viewRequestId, setViewRequestId] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [deleteRequestId, setDeleteRequestId] = useState(null);

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = schoolData?.school;
  const categories = [...DEFAULT_CATEGORIES, ...((school?.inventoryCategories) || []).filter(c => !DEFAULT_CATEGORIES.includes(c))];
  const locations  = [...DEFAULT_LOCATIONS,  ...((school?.inventoryLocations)  || []).filter(l => !DEFAULT_LOCATIONS.includes(l))];
  // Payment methods = built-ins + the school's custom fee payment categories,
  // so a received purchase's expense deducts from the same running balance.
  const paymentMethods = [
    { value: 'cash',          label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque',        label: 'Cheque' },
    { value: 'online',        label: 'Online (UPI/NEFT)' },
    ...((school?.paymentMethods) || []).filter(Boolean).map(m => ({ value: m, label: m })),
  ];

  const { data: statsData } = useQuery({ queryKey: ['inventory-stats'], queryFn: () => api.get('/inventory/stats') });
  const stats = statsData?.stats || {};

  // Category grid (landing)
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['inventory-category-summary'],
    queryFn: () => api.get('/inventory/category-summary'),
    enabled: tab === 'items' && !selectedCategory,
  });
  const categorySummary = summaryData?.summary || [];

  // Items within the selected category (drill-in)
  const { data, isLoading } = useQuery({
    queryKey: ['inventory', selectedCategory, page, search, locationFilter, statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 20 });
      params.set('category', selectedCategory);
      if (search) params.set('search', search);
      if (locationFilter) params.set('location', locationFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      return api.get(`/inventory?${params}`);
    },
    enabled: tab === 'items' && !!selectedCategory,
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const openCategory = (cat) => { setSelectedCategory(cat); setSelected([]); setSearch(''); setLocationFilter(''); setStatusFilter(''); setPage(1); };
  const backToCategories = () => { setSelectedCategory(null); setSelected([]); setSearch(''); setLocationFilter(''); setStatusFilter(''); setPage(1); };

  const { data: repairData, isLoading: loadingRepairs } = useQuery({
    queryKey: ['inventory-repairs'],
    queryFn: () => api.get('/inventory/repairs'),
    enabled: tab === 'repairs',
  });
  const repairs = repairData?.repairs || [];

  const { data: reqData, isLoading: loadingRequests } = useQuery({
    queryKey: ['purchase-requests', reqPage, reqSearch, reqStatus],
    queryFn: () => {
      const params = new URLSearchParams({ page: reqPage, limit: 20 });
      if (reqSearch) params.set('search', reqSearch);
      if (reqStatus) params.set('status', reqStatus);
      return api.get(`/purchase-requests?${params}`);
    },
    enabled: tab === 'requests',
  });
  const requests = reqData?.requests || [];
  const reqPages = reqData?.pages || 1;

  const refresh = () => {
    qc.invalidateQueries(['inventory']);
    qc.invalidateQueries(['inventory-stats']);
    qc.invalidateQueries(['inventory-repairs']);
    qc.invalidateQueries(['inventory-category-summary']);
    qc.invalidateQueries(['purchase-requests']);
  };

  const deleteRequestMutation = useMutation({
    mutationFn: (id) => api.delete(`/purchase-requests/${id}`),
    onSuccess: () => { refresh(); toast.success('Request deleted'); setDeleteRequestId(null); },
    onError: () => { toast.error('Failed to delete'); setDeleteRequestId(null); },
  });

  const reverseRequestMutation = useMutation({
    mutationFn: (id) => api.post(`/purchase-requests/${id}/reverse`),
    onSuccess: () => { refresh(); qc.invalidateQueries(['fees-method-balances']); toast.success('Purchase reversed — items & expense removed'); setReverseTarget(null); },
    onError: (err) => { toast.error(err.message || 'Failed to reverse'); setReverseTarget(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => Promise.all(selected.map(id => api.delete(`/inventory/${id}`))),
    onSuccess: () => { refresh(); toast.success(`${selected.length} item(s) deleted`); setSelected([]); setBulkDeleteConfirm(false); },
    onError: () => { toast.error('Failed to delete'); setBulkDeleteConfirm(false); },
  });

  const allSelected = items.length > 0 && items.every(i => selected.includes(i._id));
  const selectedRepairable = items.filter(i => selected.includes(i._id) && i.status !== 'in_repair' && i.status !== 'disposed');
  const hasFilters = search || locationFilter || statusFilter || typeFilter;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">School assets, lab equipment &amp; repairs</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'items' && selectedRepairable.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setSendRepairItems(selectedRepairable)}>
              <Wrench size={16} /> Send to Repair ({selectedRepairable.length})
            </button>
          )}
          {selected.length > 0 && tab === 'items' && (
            <button className="btn btn-danger" onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowConfig(true)}>
            <Tag size={16} /> Categories &amp; Locations
          </button>
          <button className="btn btn-secondary" onClick={() => { setEditRequest(null); setShowRequestModal(true); }}>
            <ShoppingCart size={16} /> Create Purchase Request
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Items
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard title="Total Items"     value={stats.total ?? 0}     icon={Boxes}         color="#1a56e8" bg="#eff6ff" />
        <StatCard title="In Use"          value={stats.inUse ?? 0}     icon={CheckCircle}   color="#16a34a" bg="#f0fdf4" />
        <StatCard title="In Repair"       value={stats.inRepair ?? 0}  icon={Wrench}        color="#d97706" bg="#fffbeb" />
        <StatCard title="Needs Attention" value={stats.attention ?? 0} icon={AlertTriangle} color="#dc2626" bg="#fef2f2" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {[
          { key: 'items', label: 'Items' },
          { key: 'repairs', label: 'Repairs', count: stats.inRepair },
          { key: 'requests', label: 'Purchase Requests', count: stats.pendingRequests },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected([]); }}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', marginBottom: -2,
              fontSize: 14, fontWeight: tab === t.key ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: 7,
              color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`,
            }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: tab === t.key ? 'var(--primary)' : '#e2e8f0',
                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'items' ? (
        selectedCategory ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={backToCategories}><ArrowLeft size={15} /> All Categories</button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedCategory}</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total} item{total === 1 ? '' : 's'}</span>
          </div>
          <div className="filter-bar">
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name, code or serial..." />
            <AntSelect style={{ minWidth: 150 }} value={typeFilter || undefined} placeholder="All Types" allowClear
              onChange={v => { setTypeFilter(v ?? ''); setPage(1); }}
              options={[{ value: 'asset', label: 'Assets' }, { value: 'consumable', label: 'Consumables' }]} />
            <AntSelect style={{ minWidth: 140 }} value={statusFilter || undefined} placeholder="All Status" allowClear
              onChange={v => { setStatusFilter(v ?? ''); setPage(1); }} options={STATUS_OPTIONS} />
            {hasFilters && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); }}>
                <X size={14} /> Clear
              </button>
            )}
          </div>

          {isLoading ? <PageLoader /> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={allSelected}
                          onChange={e => setSelected(e.target.checked ? items.map(i => i._id) : [])} />
                      </th>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th>Qty</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={9}>
                        <EmptyState icon={Package} message="No items match the current filters." action={<button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add Items</button>} />
                      </td></tr>
                    )}
                    {items.map(it => (
                      <tr key={it._id} style={{ cursor: 'pointer' }} onClick={() => setViewId(it._id)}>
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.includes(it._id)}
                            onChange={e => setSelected(p => e.target.checked ? [...p, it._id] : p.filter(id => id !== it._id))} />
                        </td>
                        <td><span className="badge badge-info">{it.itemCode}</span></td>
                        <td>
                          <div className="text-14-medium">{it.name}</div>
                          {it.serialNumber && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>SN: {it.serialNumber}</div>}
                        </td>
                        <td style={{ fontSize: 13 }}>{it.category || '—'}</td>
                        <td style={{ fontSize: 13 }}>{it.location || '—'}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{it.quantity ?? 1}</td>
                        <td style={{ fontSize: 13 }}>{it.assignedTo?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td><Pill meta={STATUS_META[it.status]} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {it.status !== 'in_repair' && it.status !== 'disposed' && it.status !== 'purchase_requested' && (
                              <button className="btn btn-secondary btn-sm btn-icon" title="Send to repair" onClick={() => setSendRepairItems([it])}><Wrench size={14} /></button>
                            )}
                            {it.type === 'asset' && it.status !== 'in_repair' && it.status !== 'disposed' && it.status !== 'purchase_requested' && (
                              <button className="btn btn-secondary btn-sm btn-icon" title="Mark damaged" onClick={() => setDamagedTarget({ itemId: it._id, name: it.name })} style={{ color: '#dc2626' }}><AlertTriangle size={14} /></button>
                            )}
                            <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => { setEditItem(it); setShowItemModal(true); }}><Edit2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} onPage={setPage} />
            </div>
          )}
        </>
        ) : (
          // ── Category grid (landing) ──
          loadingSummary ? <PageLoader /> : (
            categorySummary.length === 0 ? (
              <div className="card"><EmptyState icon={Package} message="No items added yet." action={<button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add Items</button>} /></div>
            ) : (
              <div className="grid-3">
                {categorySummary.map(c => (
                  <div key={c.category} className="card" style={{ cursor: 'pointer' }} onClick={() => openCategory(c.category)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Package size={20} color="#1a56e8" />
                        </div>
                        <div>
                          <div className="text-16-bold">{c.category}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.total} item{c.total === 1 ? '' : 's'}</div>
                        </div>
                      </div>
                      <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      <Pill meta={{ label: `${c.inUse} In Use`, color: '#16a34a', bg: '#f0fdf4' }} />
                      {c.inRepair > 0 && <Pill meta={{ label: `${c.inRepair} In Repair`, color: '#d97706', bg: '#fffbeb' }} />}
                      {c.attention > 0 && <Pill meta={{ label: `${c.attention} Attention`, color: '#dc2626', bg: '#fef2f2' }} />}
                    </div>
                  </div>
                ))}
              </div>
            )
          )
        )
      ) : tab === 'repairs' ? (
        // ── Repairs tab ──
        loadingRepairs ? <PageLoader /> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Issue</th>
                    <th>Technician</th>
                    <th>Reported</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Repairman Visit</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {repairs.length === 0 && (
                    <tr><td colSpan={8}><EmptyState icon={Wrench} message="No repairs logged." /></td></tr>
                  )}
                  {repairs.map(r => {
                    const active = r.status !== 'completed' && r.status !== 'cancelled';
                    return (
                      <tr key={r._id}>
                        <td>
                          <div className="text-14-medium">{r.itemName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.itemCode}{r.quantity > 1 ? ` · Qty ${r.quantity}` : ''}</div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.issue || '—'}</td>
                        <td style={{ fontSize: 13 }}>
                          {r.technicianName || '—'}
                          {r.technicianPhone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.technicianPhone}</div>}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.reportedDate ? format(new Date(r.reportedDate), 'dd MMM yyyy') : '—'}</td>
                        <td><Pill meta={REPAIR_STATUS_META[r.status]} /></td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{r.cost != null ? `₹${Number(r.cost).toLocaleString('en-IN')}` : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</td>
                        <td>
                          {r.linkedVisit
                            ? <span style={{ fontSize: 12, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={12} /> Linked</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {active && !r.linkedVisit && (
                              <button className="btn btn-secondary btn-sm" onClick={() => setLogVisitTarget({ itemId: r.itemId, repair: r })}>
                                <Link2 size={13} /> Log Visit
                              </button>
                            )}
                            {active && (
                              <button className="btn btn-success btn-sm" onClick={() => setCompleteTarget({ itemId: r.itemId, repair: r })}>
                                <CheckCircle size={13} /> Complete
                              </button>
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
        )
      ) : (
        // ── Purchase Requests tab ──
        loadingRequests ? <PageLoader /> : (
          <>
            <div className="filter-bar">
              <SearchInput value={reqSearch} onChange={v => { setReqSearch(v); setReqPage(1); }} placeholder="Search by PR no, title or vendor..." />
              <AntSelect style={{ minWidth: 150 }} value={reqStatus || undefined} placeholder="All Status" allowClear
                onChange={v => { setReqStatus(v ?? ''); setReqPage(1); }} options={REQUEST_STATUS_OPTIONS} />
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>PR No</th>
                      <th>Title</th>
                      <th>Items</th>
                      <th>Est. Total</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.length === 0 && (
                      <tr><td colSpan={7}>
                        <EmptyState icon={ShoppingCart} message="No purchase requests." action={<button className="btn btn-primary btn-sm" onClick={() => { setEditRequest(null); setShowRequestModal(true); }}><Plus size={14} /> Create Purchase Request</button>} />
                      </td></tr>
                    )}
                    {requests.map(r => {
                      const lines = r.items || [];
                      const units = lines.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
                      const estTotal = lines.reduce((s, i) => s + (Number(i.estimatedPrice) || 0) * (Number(i.quantity) || 1), 0);
                      const canReceive = r.status !== 'received' && r.status !== 'cancelled';
                      return (
                        <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => setViewRequestId(r._id)}>
                          <td><span className="badge badge-info">{r.requestNumber}</span></td>
                          <td className="text-14-medium">{r.title || '—'}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lines.length} line{lines.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}</td>
                          <td style={{ fontSize: 13 }}>{estTotal > 0 ? `₹${estTotal.toLocaleString('en-IN')}` : '—'}</td>
                          <td><Pill meta={REQUEST_STATUS_META[r.status]} /></td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '—'}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {canReceive && <button className="btn btn-success btn-sm" onClick={() => setReceiveTarget(r)}><PackageCheck size={13} /> Receive</button>}
                              {(r.status === 'received' || r.status === 'cancelled') && <button className="btn btn-secondary btn-sm" title={r.status === 'received' ? 'Reverse this purchase' : 'Reopen this request'} onClick={() => setReverseTarget(r)}><RotateCcw size={13} /> Reverse</button>}
                              <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => { setEditRequest(r); setShowRequestModal(true); }}><Edit2 size={14} /></button>
                              <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => setDeleteRequestId(r._id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={reqPage} pages={reqPages} onPage={setReqPage} />
            </div>
          </>
        )
      )}

      {showAddModal && (
        <AddItemsModal categories={categories} locations={locations} initialCategory={selectedCategory}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { refresh(); setShowAddModal(false); }} />
      )}

      {showItemModal && (
        <ItemModal item={editItem} categories={categories} locations={locations}
          onClose={() => { setShowItemModal(false); setEditItem(null); }}
          onSaved={() => { refresh(); setShowItemModal(false); setEditItem(null); }} />
      )}

      {viewId && (
        <ItemDetailModal id={viewId} onClose={() => setViewId(null)}
          onEdit={(it) => { setViewId(null); setEditItem(it); setShowItemModal(true); }}
          onSendRepair={(it) => { setViewId(null); setSendRepairItems([it]); }}
          onLogVisit={(itemId, repair) => { setViewId(null); setLogVisitTarget({ itemId, repair }); }}
          onComplete={(itemId, repair) => { setViewId(null); setCompleteTarget({ itemId, repair }); }} />
      )}

      {sendRepairItems && (
        <SendToRepairModal items={sendRepairItems} onClose={() => setSendRepairItems(null)} onSaved={() => { refresh(); setSelected([]); setSendRepairItems(null); }} />
      )}

      {completeTarget && (
        <CompleteRepairModal target={completeTarget} methods={paymentMethods}
          onClose={() => setCompleteTarget(null)}
          onSaved={(info) => {
            refresh();
            qc.invalidateQueries(['fees-method-balances']);
            const name = completeTarget.repair?.itemName || 'this asset';
            setCompleteTarget(null);
            if (info?.damaged) setDamagedTarget({ itemId: info.itemId, name });
          }} />
      )}

      {damagedTarget && (
        <DamagedAssetModal target={damagedTarget}
          onClose={() => setDamagedTarget(null)}
          onSaved={() => { refresh(); setDamagedTarget(null); }} />
      )}

      {logVisitTarget && (
        <LogVisitModal target={logVisitTarget} onClose={() => setLogVisitTarget(null)} onSaved={() => { refresh(); setLogVisitTarget(null); }} />
      )}

      {showConfig && (
        <ManageConfigModal school={school} onClose={() => setShowConfig(false)} onSaved={() => qc.invalidateQueries(['school'])} />
      )}

      {showRequestModal && (
        <PurchaseRequestModal request={editRequest} categories={categories} locations={locations}
          onClose={() => { setShowRequestModal(false); setEditRequest(null); }}
          onSaved={() => { refresh(); setShowRequestModal(false); setEditRequest(null); }} />
      )}

      {viewRequestId && (
        <RequestDetailModal id={viewRequestId} onClose={() => setViewRequestId(null)}
          onEdit={(r) => { setViewRequestId(null); setEditRequest(r); setShowRequestModal(true); }}
          onReceive={(r) => { setViewRequestId(null); setReceiveTarget(r); }}
          onReverse={(r) => { setViewRequestId(null); setReverseTarget(r); }} />
      )}

      {receiveTarget && (
        <ReceiveRequestModal request={receiveTarget} methods={paymentMethods} onClose={() => setReceiveTarget(null)} onSaved={() => { refresh(); qc.invalidateQueries(['fees-method-balances']); setReceiveTarget(null); }} />
      )}

      <ConfirmDialog open={!!deleteRequestId} onClose={() => setDeleteRequestId(null)}
        onConfirm={() => deleteRequestMutation.mutate(deleteRequestId)}
        title="Delete Purchase Request" message="This will permanently delete the request. This cannot be undone." danger />

      <ConfirmDialog open={!!reverseTarget} onClose={() => setReverseTarget(null)}
        onConfirm={() => reverseRequestMutation.mutate(reverseTarget._id)}
        title={reverseTarget?.status === 'cancelled' ? 'Reopen Request' : 'Reverse Purchase'}
        message={reverseTarget?.status === 'cancelled'
          ? 'This will reopen the cancelled request as pending. Continue?'
          : 'This will remove the inventory items and the expense created by this purchase, and reopen the request as pending. Continue?'} danger />

      <ConfirmDialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Items" message={`This will permanently delete ${selected.length} item(s). This cannot be undone.`} danger />
    </div>
  );
}

// Asset vs Consumable segmented toggle, reused by Add Items & Purchase Request.
function TypeToggle({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {[['asset', 'Asset'], ['consumable', 'Consumable']].map(([val, label]) => (
        <button key={val} type="button" disabled={disabled} onClick={() => onChange(val)}
          style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            background: value === val ? 'var(--primary)' : '#fff', color: value === val ? '#fff' : 'var(--text-secondary)' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Add Items Modal (multi-unit) ──────────────────────────────────────────────────
function AddItemsModal({ categories, locations, initialCategory, onClose, onSaved }) {
  const { data: empData } = useQuery({ queryKey: ['employees-all-inv'], queryFn: () => api.get('/employees?limit=200') });
  const employees = empData?.employees || [];

  const [type, setType] = useState('asset');
  const isAsset = type === 'asset';
  const [shared, setShared] = useState({ category: initialCategory || undefined, location: undefined, vendor: '', purchaseDate: '', warrantyExpiry: '', assignedTo: undefined, status: 'in_use' });
  const setS = (k, v) => setShared(s => ({ ...s, [k]: v }));
  const blankRow = () => ({ name: '', serialNumber: '', assetTag: '', quantity: 1, purchasePrice: '' });
  const [rows, setRows] = useState([blankRow()]);

  const setRow = (i, k, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, blankRow()]);
  const removeRow = (i) => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs);

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/inventory/bulk', payload),
    onSuccess: (res) => { toast.success(`${res.count} item${res.count > 1 ? 's' : ''} added`); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const lineCount = rows.filter(r => r.name.trim()).length;
  const totalUnits = isAsset ? lineCount : rows.filter(r => r.name.trim()).reduce((s, r) => s + (Number(r.quantity) || 1), 0);
  const totalPrice = rows.reduce((s, r) => s + (Number(r.purchasePrice) || 0) * (isAsset ? 1 : (Number(r.quantity) || 1)), 0);

  const submit = () => {
    const units = rows.filter(r => r.name.trim()).map(r => ({
      name: r.name.trim(),
      serialNumber: isAsset ? (r.serialNumber || undefined) : undefined,
      assetTag: isAsset ? (r.assetTag || undefined) : undefined,
      quantity: isAsset ? 1 : (Number(r.quantity) > 0 ? Number(r.quantity) : 1),
      purchasePrice: r.purchasePrice !== '' ? Number(r.purchasePrice) : undefined,
    }));
    if (units.length === 0) return toast.error('Add at least one unit with a name');
    mutation.mutate({
      shared: {
        type,
        category: shared.category || undefined,
        location: shared.location || undefined,
        vendor: shared.vendor || undefined,
        purchaseDate: shared.purchaseDate || undefined,
        warrantyExpiry: shared.warrantyExpiry || undefined,
        assignedTo: shared.assignedTo || undefined,
        status: shared.status || 'in_use',
      },
      units,
    });
  };

  const cell = { padding: '4px 6px' };
  const cellInput = { fontSize: 13, padding: '6px 8px' };

  return (
    <Modal open onClose={onClose} title="Add Items" size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : `Add ${lineCount || 0} Item${lineCount === 1 ? '' : 's'}`}
        </button>
      </>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <label className="form-label" style={{ margin: 0 }}>Inventory Type</label>
        <TypeToggle value={type} onChange={setType} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
        {isAsset
          ? <>Each row is <strong>one physical asset</strong> tracked individually (its own status, repairs, assignment). No quantity — add a row per unit.</>
          : <>Consumables are stocked by <strong>quantity</strong> (markers, chalk, paper…). Add a row per item with how many.</>}
      </p>

      {/* Shared fields */}
      <FormRow>
        <div className="form-group">
          <label className="form-label">Category</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear placeholder="Select category"
            value={shared.category} onChange={v => setS('category', v)} options={categories.map(c => ({ value: c, label: c }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Location</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear placeholder="Select location"
            value={shared.location} onChange={v => setS('location', v)} options={locations.map(l => ({ value: l, label: l }))} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Vendor / Supplier</label>
          <input className="form-control" value={shared.vendor} onChange={e => setS('vendor', e.target.value)} placeholder="Optional" />
        </div>
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear optionFilterProp="label" placeholder="Staff responsible (optional)"
            value={shared.assignedTo} onChange={v => setS('assignedTo', v)}
            options={employees.map(e => ({ value: e._id, label: `${e.name}${e.designation ? ' — ' + e.designation : ''}` }))} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Purchase Date</label>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Select date"
            value={shared.purchaseDate ? dayjs(shared.purchaseDate) : null}
            onChange={(d) => setS('purchaseDate', d ? d.format('YYYY-MM-DD') : '')}
            disabledDate={(d) => d && d > dayjs().endOf('day')} getPopupContainer={() => document.body} />
        </div>
        <div className="form-group">
          <label className="form-label">Initial Status</label>
          <AntSelect style={{ width: '100%' }} value={shared.status} onChange={v => setS('status', v)} options={ITEM_STATUS_OPTIONS} />
        </div>
      </FormRow>

      {/* Units table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ ...cell, width: 30, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>#</th>
              <th style={{ ...cell, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Name *</th>
              {isAsset ? (
                <>
                  <th style={{ ...cell, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Serial No.</th>
                  <th style={{ ...cell, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Asset Tag</th>
                </>
              ) : (
                <th style={{ ...cell, width: 90, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Qty</th>
              )}
              <th style={{ ...cell, width: 110, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Unit Price (₹)</th>
              <th style={{ ...cell, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                <td style={cell}><input className="form-control" style={cellInput} value={r.name} onChange={e => setRow(i, 'name', e.target.value)} placeholder={isAsset ? 'Unit name' : 'Item name'} /></td>
                {isAsset ? (
                  <>
                    <td style={cell}><input className="form-control" style={cellInput} value={r.serialNumber} onChange={e => setRow(i, 'serialNumber', e.target.value)} placeholder="Optional" /></td>
                    <td style={cell}><input className="form-control" style={cellInput} value={r.assetTag} onChange={e => setRow(i, 'assetTag', e.target.value)} placeholder="Optional" /></td>
                  </>
                ) : (
                  <td style={cell}><input className="form-control" style={cellInput} type="number" min={1} value={r.quantity} onChange={e => setRow(i, 'quantity', e.target.value)} /></td>
                )}
                <td style={cell}><input className="form-control" style={cellInput} type="number" min={0} value={r.purchasePrice} onChange={e => setRow(i, 'purchasePrice', e.target.value)} placeholder="0" /></td>
                <td style={cell}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => removeRow(i)} disabled={rows.length === 1} title="Remove"><X size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <button className="btn btn-secondary btn-sm" onClick={addRow}><Plus size={14} /> Add Row</button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {totalUnits} unit{totalUnits === 1 ? '' : 's'}{totalPrice > 0 ? ` · Total ₹${totalPrice.toLocaleString('en-IN')}` : ''}
        </span>
      </div>
    </Modal>
  );
}

// ── Edit Item Modal ────────────────────────────────────────────────────────────
function ItemModal({ item, categories, locations, onClose, onSaved }) {
  const isEdit = !!item;
  const { data: empData } = useQuery({ queryKey: ['employees-all-inv'], queryFn: () => api.get('/employees?limit=200') });
  const employees = empData?.employees || [];

  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || undefined,
    location: item?.location || undefined,
    serialNumber: item?.serialNumber || '',
    assetTag: item?.assetTag || '',
    quantity: item?.quantity || 1,
    purchaseDate: item?.purchaseDate || '',
    purchasePrice: item?.purchasePrice || '',
    vendor: item?.vendor || '',
    warrantyExpiry: item?.warrantyExpiry || '',
    assignedTo: item?.assignedTo?._id || item?.assignedTo || undefined,
    status: item?.status === 'in_repair' ? 'in_use' : (item?.status || 'in_use'),
    remarks: item?.remarks || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? api.put(`/inventory/${item._id}`, payload) : api.post('/inventory', payload),
    onSuccess: () => { toast.success(isEdit ? 'Item updated!' : 'Item added!'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = () => {
    if (!form.name.trim()) return toast.error('Item name is required');
    const payload = {
      name: form.name.trim(),
      category: form.category || undefined,
      location: form.location || undefined,
      serialNumber: form.serialNumber || undefined,
      assetTag: form.assetTag || undefined,
      quantity: Number(form.quantity) || 1,
      purchaseDate: form.purchaseDate || undefined,
      purchasePrice: form.purchasePrice !== '' ? Number(form.purchasePrice) : undefined,
      vendor: form.vendor || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
      assignedTo: form.assignedTo || undefined,
      status: form.status,
      remarks: form.remarks || undefined,
    };
    saveMutation.mutate(payload);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Item · ${item.itemCode}` : 'Add Item'} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </>}>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Item Name *</label>
          <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Dell Desktop i5" />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear placeholder="Select category"
            value={form.category} onChange={v => set('category', v)} options={categories.map(c => ({ value: c, label: c }))} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Location</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear placeholder="Select location"
            value={form.location} onChange={v => set('location', v)} options={locations.map(l => ({ value: l, label: l }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear optionFilterProp="label" placeholder="Staff responsible (optional)"
            value={form.assignedTo} onChange={v => set('assignedTo', v)}
            options={employees.map(e => ({ value: e._id, label: `${e.name}${e.designation ? ' — ' + e.designation : ''}` }))} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Serial Number</label>
          <input className="form-control" value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} placeholder="Optional" />
        </div>
        <div className="form-group">
          <label className="form-label">Asset Tag</label>
          <input className="form-control" value={form.assetTag} onChange={e => set('assetTag', e.target.value)} placeholder="Optional" />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Status</label>
          <AntSelect style={{ width: '100%' }} value={form.status} onChange={v => set('status', v)} options={ITEM_STATUS_OPTIONS} />
        </div>
        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input className="form-control" type="number" min={1} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Purchase Date</label>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Select date"
            value={form.purchaseDate ? dayjs(form.purchaseDate) : null}
            onChange={(d) => set('purchaseDate', d ? d.format('YYYY-MM-DD') : '')}
            disabledDate={(d) => d && d > dayjs().endOf('day')} getPopupContainer={() => document.body} />
        </div>
        <div className="form-group">
          <label className="form-label">Warranty Expiry</label>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Select date"
            value={form.warrantyExpiry ? dayjs(form.warrantyExpiry) : null}
            onChange={(d) => set('warrantyExpiry', d ? d.format('YYYY-MM-DD') : '')} getPopupContainer={() => document.body} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Purchase Price (₹)</label>
          <input className="form-control" type="number" min={0} value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} placeholder="Optional" />
        </div>
        <div className="form-group">
          <label className="form-label">Vendor / Supplier</label>
          <input className="form-control" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="Optional" />
        </div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Remarks</label>
        <textarea className="form-control" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional notes" style={{ resize: 'vertical' }} />
      </div>
    </Modal>
  );
}

// ── Send to Repair Modal ──────────────────────────────────────────────────────────
function SendToRepairModal({ items, onClose, onSaved }) {
  const multi = items.length > 1;
  const [form, setForm] = useState({ issue: '', reportedDate: dayjs().format('YYYY-MM-DD'), expectedDate: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/inventory/repairs/bulk', payload),
    onSuccess: () => { toast.success(`${items.length} item${items.length > 1 ? 's' : ''} sent to repair`); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = () => {
    if (!form.issue.trim()) return toast.error('Please describe the issue');
    mutation.mutate({
      itemIds: items.map(i => i._id),
      issue: form.issue.trim(),
      reportedDate: form.reportedDate || undefined,
      expectedDate: form.expectedDate || undefined,
    });
  };

  return (
    <Modal open onClose={onClose} title={multi ? `Send ${items.length} Items to Repair` : `Send to Repair · ${items[0].name}`}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : <><Wrench size={14} /> Send to Repair</>}
        </button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 12 }}>
        {multi
          ? <>These <strong>{items.length}</strong> units will be marked <em>In Repair</em> with the same issue. You can log the repairman as a visit afterwards.</>
          : <>This will mark <strong>{items[0].itemCode}</strong> as <em>In Repair</em>. You can log the repairman as a visit afterwards.</>}
      </p>
      {multi && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {items.map(i => (
            <span key={i._id} style={{ fontSize: 12, background: '#f1f5f9', borderRadius: 6, padding: '3px 8px', color: 'var(--text-secondary)' }}>
              {i.itemCode} · {i.name}
            </span>
          ))}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Issue / Problem *</label>
        <textarea className="form-control" rows={2} value={form.issue} onChange={e => set('issue', e.target.value)} placeholder="e.g. Monitor not turning on" style={{ resize: 'vertical' }} />
      </div>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Reported Date</label>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY"
            value={form.reportedDate ? dayjs(form.reportedDate) : null}
            onChange={(d) => set('reportedDate', d ? d.format('YYYY-MM-DD') : '')} getPopupContainer={() => document.body} />
        </div>
        <div className="form-group">
          <label className="form-label">Expected Repair Date</label>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="When it should return"
            value={form.expectedDate ? dayjs(form.expectedDate) : null}
            onChange={(d) => set('expectedDate', d ? d.format('YYYY-MM-DD') : '')} getPopupContainer={() => document.body} />
        </div>
      </FormRow>
    </Modal>
  );
}

// ── Complete Repair Modal ───────────────────────────────────────────────────────
function CompleteRepairModal({ target, methods = [], onClose, onSaved }) {
  const { itemId, repair } = target;
  const [form, setForm] = useState({ resolutionNotes: repair.resolutionNotes || '', cost: repair.cost ?? '', itemStatus: 'in_use', paymentMethod: 'cash' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const req = <span style={{ color: '#dc2626' }}> *</span>;
  const isDamaged = form.itemStatus === 'damaged';

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/inventory/${itemId}/repairs/${repair._id}/complete`, payload),
    // Tell the parent whether the item was closed as damaged so it can prompt
    // for a replacement / removal next.
    onSuccess: () => { toast.success('Repair completed'); onSaved(form.itemStatus === 'damaged' ? { damaged: true, itemId } : undefined); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = () => {
    if (!form.resolutionNotes.trim()) return toast.error('Enter the resolution notes');
    // Damaged/unrepairable items were not fixed — no cost or payment is booked.
    if (!isDamaged) {
      if (form.cost === '' || Number(form.cost) < 0) return toast.error('Enter the repair cost');
      if (!form.paymentMethod) return toast.error('Select a payment method');
    }
    mutation.mutate({
      resolutionNotes: form.resolutionNotes.trim(),
      cost: isDamaged ? undefined : Number(form.cost),
      itemStatus: form.itemStatus,
      paymentMethod: isDamaged ? undefined : form.paymentMethod,
    });
  };

  return (
    <Modal open onClose={onClose} title="Complete Repair"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-success" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Complete Repair'}
        </button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
        Closing the repair for <strong>{repair.itemName || 'this item'}</strong>. If a repairman visit is linked, it will also be marked completed.
      </p>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Resulting Item Status{req}</label>
          <AntSelect style={{ width: '100%' }} value={form.itemStatus} onChange={v => set('itemStatus', v)}
            options={[
              { value: 'in_use', label: 'Back in Use' },
              { value: 'damaged', label: 'Damaged (unrepairable)' },
            ]} />
        </div>
        {!isDamaged && (
          <div className="form-group">
            <label className="form-label">Repair Cost (₹){req}</label>
            <input className="form-control" type="number" min={0} value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="e.g. 500 (enter 0 if free)" />
          </div>
        )}
      </FormRow>
      {!isDamaged && (
        <div className="form-group">
          <label className="form-label">Payment Method{req}</label>
          <AntSelect style={{ width: '100%' }} value={form.paymentMethod} onChange={v => set('paymentMethod', v)} options={methods} />
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            The repair cost is booked as an expense and deducted from this account's balance.
          </p>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Resolution Notes{req}</label>
        <textarea className="form-control" rows={3} value={form.resolutionNotes} onChange={e => set('resolutionNotes', e.target.value)} placeholder="What was done?" style={{ resize: 'vertical' }} />
      </div>
    </Modal>
  );
}

// After a repair is closed as "Damaged (unrepairable)", ask whether to raise a
// replacement purchase request (asset → 'purchase_requested', revived to
// 'in_use' when received) or remove the asset from the register.
function DamagedAssetModal({ target, onClose, onSaved }) {
  const { itemId, name } = target;
  const requestMutation = useMutation({
    mutationFn: () => api.post(`/inventory/${itemId}/request-replacement`),
    onSuccess: () => { toast.success('Replacement purchase request created'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });
  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/inventory/${itemId}`),
    onSuccess: () => { toast.success('Asset removed'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });
  const busy = requestMutation.isPending || removeMutation.isPending;

  return (
    <Modal open onClose={onClose} title="Asset Damaged — What Next?"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" onClick={() => removeMutation.mutate()} disabled={busy}>
              <Trash2 size={14} /> {removeMutation.isPending ? 'Removing…' : 'Remove Asset'}
            </button>
            <button className="btn btn-primary" onClick={() => requestMutation.mutate()} disabled={busy}>
              <PackageCheck size={14} /> {requestMutation.isPending ? 'Requesting…' : 'Confirm Purchase Request'}
            </button>
          </div>
        </div>
      }>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>
        <strong>{name}</strong> is marked damaged / unrepairable. Choose what to do:
      </p>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
        <li><strong>Confirm Purchase Request</strong> — raises a replacement request (appears in the Purchase Requests tab). The asset shows <em>Purchase Requested</em> and flips back to <em>In Use</em> once the purchase is received.</li>
        <li><strong>Remove Asset</strong> — permanently deletes this asset from the register.</li>
      </ul>
    </Modal>
  );
}

// ── Log Repairman Visit Modal ─────────────────────────────────────────────────────
function LogVisitModal({ target, onClose, onSaved }) {
  const { itemId, repair } = target;
  const [form, setForm] = useState({
    visitorName: repair.technicianName || '',
    phone: repair.technicianPhone || '',
    designation: repair.technicianDesignation || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/inventory/${itemId}/repairs/${repair._id}/visit`, payload),
    onSuccess: () => { toast.success('Repairman logged as a visit'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = () => {
    if (!form.visitorName.trim()) return toast.error('Repairman name is required');
    if (!/^[0-9]{10}$/.test(form.phone)) return toast.error('Enter a valid 10-digit phone');
    mutation.mutate({
      visitorName: form.visitorName.trim(),
      phone: form.phone,
      designation: form.designation || undefined,
    });
  };

  return (
    <Modal open onClose={onClose} title="Log Repairman Visit"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : <><Link2 size={14} /> Log Visit</>}
        </button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
        Record the repairman's details. This creates an entry in the <strong>Visits</strong> module (purpose: Repair) linked to this repair.
      </p>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Repairman Name *</label>
          <input className="form-control" value={form.visitorName} onChange={e => set('visitorName', e.target.value)} placeholder="Full name" />
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number *</label>
          <input className="form-control" type="tel" maxLength={10} value={form.phone}
            onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
        </div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Designation / Company</label>
        <input className="form-control" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. AC Technician, ABC Electronics" />
      </div>
    </Modal>
  );
}

// ── Item Detail Modal (with repair history) ──────────────────────────────────────
function ItemDetailModal({ id, onClose, onEdit, onSendRepair, onLogVisit, onComplete }) {
  const { data, isLoading } = useQuery({ queryKey: ['inventory-item', id], queryFn: () => api.get(`/inventory/${id}`) });
  const it = data?.item;

  const rows = it ? [
    { label: 'Code', value: it.itemCode },
    { label: 'Category', value: it.category || '—' },
    { label: 'Location', value: it.location || '—' },
    { label: 'Quantity', value: it.quantity ?? 1 },
    { label: 'Serial No.', value: it.serialNumber || '—' },
    { label: 'Asset Tag', value: it.assetTag || '—' },
    { label: 'Assigned To', value: it.assignedTo?.name || '—' },
    { label: 'Vendor', value: it.vendor || '—' },
    { label: 'Purchase Date', value: it.purchaseDate ? format(new Date(it.purchaseDate), 'dd MMM yyyy') : '—' },
    { label: 'Warranty Expiry', value: it.warrantyExpiry ? format(new Date(it.warrantyExpiry), 'dd MMM yyyy') : '—' },
    { label: 'Purchase Price', value: it.purchasePrice != null ? `₹${Number(it.purchasePrice).toLocaleString('en-IN')}` : '—' },
    { label: 'Remarks', value: it.remarks || '—', full: true },
  ] : [];

  return (
    <Modal open onClose={onClose} title="Item Details" size="lg"
      footer={it ? <>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {it.status !== 'in_repair' && it.status !== 'disposed' && (
          <button className="btn btn-secondary" onClick={() => onSendRepair(it)}><Wrench size={14} /> Send to Repair</button>
        )}
        <button className="btn btn-primary" onClick={() => onEdit(it)}>Edit</button>
      </> : null}>
      {isLoading || !it ? <PageLoader /> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{it.name}</h3>
            <Pill meta={STATUS_META[it.status]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {rows.map(({ label, value, full }) => (
              <div key={label} style={full ? { gridColumn: '1 / -1' } : {}}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 500 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Repair history */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Repair History
            </div>
            {(!it.repairs || it.repairs.length === 0) ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No repairs logged for this item.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...it.repairs].reverse().map(r => {
                  const active = r.status !== 'completed' && r.status !== 'cancelled';
                  return (
                    <div key={r._id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="text-14-medium">{r.issue || 'Repair'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {r.reportedDate ? format(new Date(r.reportedDate), 'dd MMM yyyy') : ''}
                            {r.quantity > 1 ? ` · Qty ${r.quantity}` : ''}
                            {r.technicianName ? ` · ${r.technicianName}` : ''}
                            {r.cost != null ? ` · ₹${Number(r.cost).toLocaleString('en-IN')}` : ''}
                          </div>
                          {r.resolutionNotes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{r.resolutionNotes}</div>}
                        </div>
                        <Pill meta={REPAIR_STATUS_META[r.status]} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        {active && !r.linkedVisit && (
                          <button className="btn btn-secondary btn-sm" onClick={() => onLogVisit(it._id, r)}><Link2 size={13} /> Log Visit</button>
                        )}
                        {active && (
                          <button className="btn btn-success btn-sm" onClick={() => onComplete(it._id, { ...r, itemName: it.name })}><CheckCircle size={13} /> Complete</button>
                        )}
                        {r.linkedVisit && <span style={{ fontSize: 12, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={12} /> Visit linked</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Manage Categories & Locations Modal ───────────────────────────────────────────
function ManageConfigModal({ school, onClose, onSaved }) {
  const [cats, setCats] = useState([...(school?.inventoryCategories || [])]);
  const [locs, setLocs] = useState([...(school?.inventoryLocations || [])]);
  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [saving, setSaving] = useState(false);

  const addCat = () => {
    const t = newCat.trim();
    if (!t) return;
    if (DEFAULT_CATEGORIES.includes(t) || cats.includes(t)) return toast.error('Already exists');
    setCats(p => [...p, t]); setNewCat('');
  };
  const addLoc = () => {
    const t = newLoc.trim();
    if (!t) return;
    if (DEFAULT_LOCATIONS.includes(t) || locs.includes(t)) return toast.error('Already exists');
    setLocs(p => [...p, t]); setNewLoc('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/school/inventory-categories', { categories: cats });
      await api.put('/school/inventory-locations', { locations: locs });
      toast.success('Saved');
      onSaved(); onClose();
    } catch (err) { toast.error(err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const Chips = ({ defaults, custom, onRemove }) => (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {defaults.map(c => <span key={c} style={{ padding: '4px 12px', borderRadius: 20, background: '#f1f5f9', fontSize: 13, color: 'var(--text-secondary)' }}>{c}</span>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {custom.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No custom entries yet.</span>}
        {custom.map(c => (
          <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 13, color: '#1d4ed8' }}>
            {c}
            <button onClick={() => onRemove(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#1d4ed8' }}><X size={12} /></button>
          </span>
        ))}
      </div>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Manage Categories & Locations"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </>}>
      <div className="form-group">
        <label className="form-label">Categories</label>
        <Chips defaults={DEFAULT_CATEGORIES} custom={cats} onRemove={(c) => setCats(p => p.filter(x => x !== c))} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-control" placeholder="Add category..." value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} />
          <button className="btn btn-secondary" onClick={addCat} disabled={!newCat.trim()}><Plus size={14} /> Add</button>
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Locations</label>
        <Chips defaults={DEFAULT_LOCATIONS} custom={locs} onRemove={(l) => setLocs(p => p.filter(x => x !== l))} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-control" placeholder="Add location..." value={newLoc} onChange={e => setNewLoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLoc()} />
          <button className="btn btn-secondary" onClick={addLoc} disabled={!newLoc.trim()}><Plus size={14} /> Add</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Create / Edit Purchase Request Modal ──────────────────────────────────────────
function PurchaseRequestModal({ request, categories, locations, onClose, onSaved }) {
  const isEdit = !!request;
  const received = request?.status === 'received'; // already fulfilled — only details editable
  const [type, setType] = useState(request?.type || 'asset');
  const isAsset = type === 'asset';
  const [head, setHead] = useState({
    title: request?.title || '', vendor: request?.vendor || '',
    category: request?.category || undefined, location: request?.location || undefined,
    expectedDate: request?.expectedDate || '', notes: request?.notes || '',
  });
  const setH = (k, v) => setHead(h => ({ ...h, [k]: v }));
  const blankRow = () => ({ name: '', quantity: 1, estimatedPrice: '' });
  const [rows, setRows] = useState(
    request?.items?.length
      ? request.items.map(i => ({ name: i.name || '', quantity: i.quantity || 1, estimatedPrice: i.estimatedPrice ?? '' }))
      : [blankRow()]
  );
  const setRow = (i, k, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, blankRow()]);
  const removeRow = (i) => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs);

  const mutation = useMutation({
    mutationFn: (payload) => isEdit ? api.put(`/purchase-requests/${request._id}`, payload) : api.post('/purchase-requests', payload),
    onSuccess: () => { toast.success(isEdit ? 'Request updated!' : 'Purchase request created!'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = () => {
    const items = rows.filter(r => r.name.trim()).map(r => ({
      name: r.name.trim(), quantity: isAsset ? 1 : (Number(r.quantity) || 1),
      estimatedPrice: r.estimatedPrice !== '' ? Number(r.estimatedPrice) : undefined,
    }));
    if (items.length === 0) return toast.error('Add at least one item with a name');
    mutation.mutate({
      title: head.title || undefined, vendor: head.vendor || undefined, type,
      category: head.category || undefined, location: head.location || undefined,
      expectedDate: head.expectedDate || undefined, notes: head.notes || undefined, items,
    });
  };

  const estTotal = rows.reduce((s, r) => s + (Number(r.estimatedPrice) || 0) * (isAsset ? 1 : (Number(r.quantity) || 1)), 0);
  const cell = { padding: '4px 6px' };
  const cellInput = { fontSize: 13, padding: '6px 8px' };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Request · ${request.requestNumber}` : 'Create Purchase Request'} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Request'}
        </button>
      </>}>
      {received && (
        <div style={{ fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          This request has been received. Only the title, vendor, date and description can be edited — items and category are locked.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <label className="form-label" style={{ margin: 0 }}>Procuring</label>
        <TypeToggle value={type} onChange={setType} disabled={received} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {isAsset ? 'Trackable assets — one line per unit' : 'Consumables — stocked by quantity'}
        </span>
      </div>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-control" value={head.title} onChange={e => setH('title', e.target.value)} placeholder="e.g. Computer Lab upgrade" />
        </div>
        <div className="form-group">
          <label className="form-label">Expected Date</label>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Optional"
            value={head.expectedDate ? dayjs(head.expectedDate) : null}
            onChange={(d) => setH('expectedDate', d ? d.format('YYYY-MM-DD') : '')} getPopupContainer={() => document.body} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Category</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear placeholder="Select category" disabled={received}
            value={head.category} onChange={v => setH('category', v)} options={categories.map(c => ({ value: c, label: c }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Location</label>
          <AntSelect style={{ width: '100%' }} showSearch allowClear placeholder="Select location" disabled={received}
            value={head.location} onChange={v => setH('location', v)} options={locations.map(l => ({ value: l, label: l }))} />
        </div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Vendor / Supplier</label>
        <input className="form-control" value={head.vendor} onChange={e => setH('vendor', e.target.value)} placeholder="Optional" />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={2} value={head.notes} onChange={e => setH('notes', e.target.value)} placeholder="Optional notes about this request" style={{ resize: 'vertical' }} />
      </div>

      <label className="form-label">Items to Purchase</label>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ ...cell, width: 26, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>#</th>
              <th style={{ ...cell, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Item *</th>
              {!isAsset && <th style={{ ...cell, width: 90, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Qty</th>}
              <th style={{ ...cell, width: 140, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Est. Price (₹)</th>
              <th style={{ ...cell, width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                <td style={cell}><input className="form-control" style={cellInput} value={r.name} onChange={e => setRow(i, 'name', e.target.value)} placeholder="Item name" disabled={received} /></td>
                {!isAsset && <td style={cell}><input className="form-control" style={cellInput} type="number" min={1} value={r.quantity} onChange={e => setRow(i, 'quantity', e.target.value)} disabled={received} /></td>}
                <td style={cell}><input className="form-control" style={cellInput} type="number" min={0} value={r.estimatedPrice} onChange={e => setRow(i, 'estimatedPrice', e.target.value)} placeholder="0" disabled={received} /></td>
                <td style={cell}><button className="btn btn-secondary btn-sm btn-icon" onClick={() => removeRow(i)} disabled={received || rows.length === 1} title="Remove"><X size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        {received ? <span /> : <button className="btn btn-secondary btn-sm" onClick={addRow}><Plus size={14} /> Add Row</button>}
        {estTotal > 0 && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Est. total ₹{estTotal.toLocaleString('en-IN')}</span>}
      </div>
    </Modal>
  );
}

// ── Receive Request Modal ───────────────────────────────────────────────────────
function ReceiveRequestModal({ request, methods = [], onClose, onSaved }) {
  const lines = request.items || [];
  const isAsset = request.type !== 'consumable';
  const [prices, setPrices] = useState(() => {
    const m = {}; lines.forEach(i => { m[i._id] = (i.actualPrice ?? i.estimatedPrice ?? ''); }); return m;
  });
  const setPrice = (id, v) => setPrices(p => ({ ...p, [id]: v }));
  const [vendor, setVendor] = useState(request.vendor || '');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const mutation = useMutation({
    mutationFn: () => api.post(`/purchase-requests/${request._id}/receive`, {
      items: lines.map(i => ({ _id: i._id, actualPrice: prices[i._id] !== '' ? Number(prices[i._id]) : undefined })),
      vendor: vendor.trim(),
      paymentMethod,
    }),
    onSuccess: () => { toast.success('Received — units added to inventory & expense booked'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/purchase-requests/${request._id}`, { status: 'cancelled' }),
    onSuccess: () => { toast.success('Purchase request cancelled'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });
  const busy = mutation.isPending || cancelMutation.isPending;

  const grand = lines.reduce((s, i) => s + (Number(prices[i._id]) || 0) * (Number(i.quantity) || 1), 0);
  const cell = { padding: '6px 8px', fontSize: 13 };

  return (
    <Modal open onClose={onClose} title={`Receive · ${request.requestNumber}`} size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-danger" onClick={() => cancelMutation.mutate()} disabled={busy}>
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-success" onClick={() => mutation.mutate()} disabled={busy}>
              {mutation.isPending ? 'Saving...' : <><PackageCheck size={14} /> Receive &amp; Add to Inventory</>}
            </button>
          </div>
        </div>
      }>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 14 }}>
        Enter the actual <strong>unit price</strong> paid. On receive, each line is created as inventory units under its category, and one expense is booked for the total.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Vendor</label>
          <input className="form-control" value={vendor} onChange={e => setVendor(e.target.value)}
            placeholder="Who you purchased from" />
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Pre-filled from the request — update it if you bought from a different vendor.
          </p>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Payment Method</label>
          <AntSelect style={{ width: '100%' }} value={paymentMethod} onChange={setPaymentMethod} options={methods} />
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            The purchase total is deducted from this account's balance.
          </p>
        </div>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ ...cell, color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>Item</th>
              {!isAsset && <th style={{ ...cell, width: 60, color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>Qty</th>}
              <th style={{ ...cell, width: 130, color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>Unit Price (₹)</th>
              <th style={{ ...cell, width: 110, color: 'var(--text-muted)', fontSize: 11, textAlign: 'right' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(i => {
              const qty = isAsset ? 1 : (Number(i.quantity) || 1);
              const lineTotal = (Number(prices[i._id]) || 0) * qty;
              return (
                <tr key={i._id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={cell}>{i.name}</td>
                  {!isAsset && <td style={cell}>{i.quantity || 1}</td>}
                  <td style={cell}><input className="form-control" style={{ fontSize: 13, padding: '6px 8px' }} type="number" min={0} value={prices[i._id]} onChange={e => setPrice(i._id, e.target.value)} placeholder="0" /></td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{lineTotal > 0 ? `₹${lineTotal.toLocaleString('en-IN')}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'right', marginTop: 12, fontSize: 15, fontWeight: 700 }}>
        Grand Total: ₹{grand.toLocaleString('en-IN')}
      </div>
    </Modal>
  );
}

// ── Purchase Request Detail Modal ─────────────────────────────────────────────────
function RequestDetailModal({ id, onClose, onEdit, onReceive, onReverse }) {
  const { data, isLoading } = useQuery({ queryKey: ['purchase-request', id], queryFn: () => api.get(`/purchase-requests/${id}`) });
  const r = data?.request;
  const canReceive = r && r.status !== 'received' && r.status !== 'cancelled';
  const received = r?.status === 'received';
  const cell = { padding: '6px 8px', fontSize: 13 };

  return (
    <Modal open onClose={onClose} title="Purchase Request" size="lg"
      footer={r ? <>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {(received || r.status === 'cancelled') && <button className="btn btn-secondary" onClick={() => onReverse(r)}><RotateCcw size={14} /> Reverse</button>}
        <button className="btn btn-secondary" onClick={() => onEdit(r)}>Edit</button>
        {canReceive && <button className="btn btn-success" onClick={() => onReceive(r)}><PackageCheck size={14} /> Receive</button>}
      </> : null}>
      {isLoading || !r ? <PageLoader /> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="badge badge-info">{r.requestNumber}</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{r.title || 'Purchase Request'}</h3>
            <Pill meta={REQUEST_STATUS_META[r.status]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 16 }}>
            {[
              ['Category', r.category || '—'],
              ['Location', r.location || '—'],
              ['Vendor', r.vendor || '—'],
              ['Expected Date', r.expectedDate ? format(new Date(r.expectedDate), 'dd MMM yyyy') : '—'],
              ['Requested By', r.requestedBy?.name || '—'],
              ['Received', r.receivedAt ? format(new Date(r.receivedAt), 'dd MMM yyyy') : '—'],
              ['Description', r.notes || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 500 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ ...cell, color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>Item</th>
                  <th style={{ ...cell, color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>Qty</th>
                  <th style={{ ...cell, color: 'var(--text-muted)', fontSize: 11, textAlign: 'right' }}>{received ? 'Unit Price' : 'Est. Price'}</th>
                </tr>
              </thead>
              <tbody>
                {(r.items || []).map(i => (
                  <tr key={i._id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={cell}>{i.name}</td>
                    <td style={cell}>{i.quantity || 1}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>
                      {received
                        ? (i.actualPrice != null ? `₹${Number(i.actualPrice).toLocaleString('en-IN')}` : '—')
                        : (i.estimatedPrice != null ? `₹${Number(i.estimatedPrice).toLocaleString('en-IN')}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
