import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './index';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const CONFIG = {
  student: {
    endpoint: '/students/bulk',
    payloadKey: 'students',
    filename: 'student_bulk_template.xlsx',
    sheetName: 'Students',
    headers: ['name', 'gender', 'dateOfBirth', 'rollNumber', 'bloodGroup', 'religion', 'caste', 'category', 'phone', 'email', 'address', 'city', 'state', 'pincode'],
    notes:   ['Required', 'male/female/other  [Required]', 'YYYY-MM-DD  [Required]', 'Optional', 'e.g. O+, A+', 'Optional', 'Optional', 'general/obc/sc/st/other', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional'],
    sample:  ['John Doe', 'male', '2010-05-15', '101', 'O+', 'Hindu', 'General', 'general', '9876543210', 'john@example.com', '123 Main St', 'Chennai', 'Tamil Nadu', '600001'],
  },
  employee: {
    endpoint: '/employees/bulk',
    payloadKey: 'employees',
    filename: 'employee_bulk_template.xlsx',
    sheetName: 'Employees',
    headers: ['name', 'email', 'phone', 'role', 'department', 'designation', 'dateOfJoining', 'dateOfBirth', 'gender', 'bloodGroup', 'basicSalary', 'hra', 'da'],
    notes:   ['Required', 'Required', 'Required', 'teacher/principal/accountant/maintenance/other  [Required]', 'Optional', 'Optional', 'YYYY-MM-DD', 'YYYY-MM-DD', 'male/female/other', 'e.g. O+', 'Number', 'Number', 'Number'],
    sample:  ['Jane Smith', 'jane@school.com', '9876543210', 'teacher', 'Science', 'Science Teacher', '2024-01-15', '1990-03-20', 'female', 'A+', '25000', '5000', '2500'],
  },
};

function StepBadge({ num }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
      {num}
    </div>
  );
}

export function BulkUploadModal({ open, onClose, type, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const cfg = CONFIG[type] || CONFIG.student;
  const label = type === 'student' ? 'Students' : 'Employees';

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [cfg.headers, cfg.notes, cfg.sample];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = cfg.headers.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
    XLSX.writeFile(wb, cfg.filename);
  };

  const handleFile = (e) => {
    setFile(e.target.files[0] || null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 3) {
        toast.error('No data rows found. Please use the downloaded template.');
        setUploading(false);
        return;
      }

      const headers = raw[0];
      // row 0 = headers, row 1 = notes/hints, rows 2+ = actual data
      const dataRows = raw.slice(2).filter(r => r.some(c => String(c).trim() !== ''));

      if (!dataRows.length) {
        toast.error('No data found. Fill in data starting from row 3.');
        setUploading(false);
        return;
      }

      const records = dataRows.map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          if (h) obj[String(h).trim()] = row[i] !== undefined ? String(row[i]).trim() : '';
        });
        return obj;
      });

      const res = await api.post(cfg.endpoint, { [cfg.payloadKey]: records });
      setResult(res);
      if (res.created > 0) {
        onSuccess?.();
        toast.success(`${res.created} ${label.toLowerCase()} uploaded successfully!`);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Bulk Upload ${label}`}>
      {/* Step 1 — Download template */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <StepBadge num={1} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Download Template</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Download the Excel template, fill in your data starting from row 3 (do not modify the first two rows), then upload.
        </p>
        <button className="btn btn-secondary" onClick={downloadTemplate}>
          <Download size={14} /> Download Template
        </button>
      </div>

      {/* Step 2 — Upload */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <StepBadge num={2} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Upload Filled File</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Accepts .xlsx / .xls files only. Keep the header row and notes row as-is.
        </p>
        <label style={{ display: 'block', border: `2px dashed ${file ? 'var(--primary)' : '#cbd5e1'}`, borderRadius: 8, padding: '18px 16px', textAlign: 'center', cursor: 'pointer', background: file ? '#eff6ff' : '#fff', transition: 'border-color 0.15s, background 0.15s' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          <FileSpreadsheet size={26} style={{ color: file ? 'var(--primary)' : '#94a3b8', display: 'block', margin: '0 auto 6px' }} />
          <div style={{ fontSize: 13, color: file ? 'var(--primary)' : 'var(--text-muted)', fontWeight: file ? 600 : 400 }}>
            {file ? file.name : 'Click to choose .xlsx / .xls file'}
          </div>
        </label>
        {file && (
          <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={handleUpload} disabled={uploading}>
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Now'}
          </button>
        )}
      </div>

      {/* Result summary */}
      {result && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: result.created > 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.created > 0 ? '#86efac' : '#fca5a5'}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: result.errors?.length ? 8 : 0 }}>
            {result.created > 0 ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
            <span style={{ fontWeight: 600, fontSize: 13 }}>{result.created} created, {result.failed} failed</span>
          </div>
          {result.errors?.slice(0, 6).map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>• {e}</div>
          ))}
          {result.errors?.length > 6 && (
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>...and {result.errors.length - 6} more errors</div>
          )}
        </div>
      )}
    </Modal>
  );
}
