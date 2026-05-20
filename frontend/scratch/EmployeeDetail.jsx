
// -- Employee Detail Page -------------------------------------------------------
function EmployeeDetail({ employee, onBack, onDelete, onDownload, onEdit, onTasks }) {
  const [activeTab, setActiveTab] = useState('personal');

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="page-title">Employee Details</h1>
            <p className="page-subtitle">{employee.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {employee.role === 'maintenance' && (
            <button className="btn btn-secondary" onClick={() => onTasks(employee)}><ClipboardList size={15} /> Tasks</button>
          )}
          <button className="btn btn-secondary" onClick={() => onEdit(employee)}><Edit size={15} /> Edit</button>
          <button className="btn btn-secondary" onClick={() => onDownload(employee._id)}><Download size={15} /> Job Offer</button>
          <button className="btn btn-danger" onClick={() => onDelete(employee._id)}><Trash2 size={15} /> Delete</button>
        </div>
      </div>

      {/* Profile card */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Avatar src={employee.photo} name={employee.name} size={80} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 className="text-24-bold">{employee.name}</h2>
              {employee.employeeId && <span className="badge badge-info">{employee.employeeId}</span>}
              <StatusBadge status={employee.status} />
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {employee.role && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)', textTransform: 'capitalize' }}><Briefcase size={14} /> {employee.role}</span>}
              {employee.department && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Dept: {employee.department}</span>}
              {employee.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)' }}><Phone size={14} /> {employee.phone || employee.mobile}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {DETAIL_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400, fontSize: 14, transition: 'all 0.15s',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 24 }}>
          {/* Personal tab */}
          {activeTab === 'personal' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Basic Information</SectionTitle>
                <DetailRow label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB') : null} />
                <DetailRow label="Gender" value={employee.gender} capitalize />
                <DetailRow label="Blood Group" value={employee.bloodGroup} />
              </div>
              <div>
                <SectionTitle>Contact & Address</SectionTitle>
                {employee.email && <ContactItem icon={Mail} value={employee.email} />}
                {(employee.phone || employee.mobile) && <ContactItem icon={Phone} value={employee.phone || employee.mobile} />}
                {employee.address && <ContactItem icon={MapPin} value={employee.address} />}
                {employee.city && <DetailRow label="City" value={employee.city} />}
                {employee.state && <DetailRow label="State" value={employee.state} />}
                {employee.country && <DetailRow label="Country" value={employee.country} />}
              </div>
              <div>
                <SectionTitle>Emergency Contacts</SectionTitle>
                {employee.emergencyContacts?.length > 0 ? employee.emergencyContacts.map((contact, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{contact.name} ({contact.relationship})</div>
                    <ContactItem icon={Phone} value={contact.contactNumber} />
                    {contact.alternateContactNumber && <ContactItem icon={Phone} value={contact.alternateContactNumber + ' (Alt)'} />}
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No emergency contacts added.</p>}
              </div>
            </div>
          )}

          {/* Work tab */}
          {activeTab === 'work' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Employment Details</SectionTitle>
                <DetailRow label="Employee ID" value={employee.employeeId} />
                <DetailRow label="Designation" value={employee.designation} />
                <DetailRow label="Department" value={employee.department} />
                <DetailRow label="Employment Type" value={employee.employmentType} />
                <DetailRow label="Date of Joining" value={employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString('en-GB') : null} />
                <DetailRow label="Work Location" value={employee.workLocation} />
              </div>
              <div>
                <SectionTitle>Academics</SectionTitle>
                {employee.academics?.length > 0 ? employee.academics.map((acad, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{acad.qualification} in {acad.fieldOfStudy}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acad.institutionName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acad.startYear} - {acad.endYear} • {acad.grade}</div>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No academics added.</p>}
              </div>
              <div>
                <SectionTitle>Experience</SectionTitle>
                {employee.experience?.length > 0 ? employee.experience.map((exp, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{exp.designation}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.organizationName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-GB') : ''} to {exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-GB') : ''}</div>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No experience added.</p>}
              </div>
            </div>
          )}

          {/* Financial tab */}
          {activeTab === 'financial' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Salary Details</SectionTitle>
                <DetailRow label="Salary Type" value={employee.salary?.salaryType} />
                <DetailRow label="Basic Salary" value={employee.salary?.basic ? '?' + employee.salary.basic.toLocaleString('en-IN') : null} />
                <DetailRow label="Allowances" value={employee.salary?.allowances ? '?' + employee.salary.allowances.toLocaleString('en-IN') : null} />
                <DetailRow label="Deductions" value={employee.salary?.deductions ? '?' + employee.salary.deductions.toLocaleString('en-IN') : null} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4, background: '#eff6ff', borderRadius: 8, paddingLeft: 12, paddingRight: 12 }}>
                  <span className="text-14-bold">Net Salary</span>
                  <span className="text-14-bold" style={{ color: 'var(--primary)' }}>
                    ?{((employee.salary?.basic || 0) + (employee.salary?.allowances || 0) - (employee.salary?.deductions || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <div>
                <SectionTitle>Bank Information</SectionTitle>
                <DetailRow label="Payment Mode" value={employee.salary?.paymentMode} />
                <DetailRow label="Bank Name" value={employee.bank?.bankName} />
                <DetailRow label="Account Holder" value={employee.bank?.accountHolderName} />
                <DetailRow label="Account Number" value={employee.bank?.accountNumber} />
                <DetailRow label="IFSC Code" value={employee.bank?.ifscCode} />
                <DetailRow label="Branch Name" value={employee.bank?.branchName} />
                <DetailRow label="UPI ID" value={employee.bank?.upiId} />
              </div>
            </div>
          )}

          {/* Documents tab */}
          {activeTab === 'documents' && (
            <div>
              <SectionTitle>Uploaded Documents</SectionTitle>
              {employee.documents?.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {employee.documents.map((doc, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{doc.documentType}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{doc.fileName || 'Uploaded file'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No documents uploaded.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h4 className="text-12-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{children}</h4>;
}

function DetailRow({ label, value, capitalize }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-14-medium" style={capitalize ? { textTransform: 'capitalize' } : {}}>{value}</span>
    </div>
  );
}

function ContactItem({ icon: Icon, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
      <Icon size={13} style={{ flexShrink: 0 }} /> {value}
    </div>
  );
}
