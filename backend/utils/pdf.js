const PDFDocument = require('pdfkit');

const generateFeeReceipt = (feeData, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.rect(0, 0, doc.page.width, 100).fill('#1e3a5f');
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text(schoolData.name, 50, 20, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(schoolData.address?.street + ', ' + schoolData.address?.city, { align: 'center' });
    doc.text(`Phone: ${schoolData.phone} | Email: ${schoolData.email}`, { align: 'center' });

    doc.moveDown(2);
    doc.fillColor('#1e3a5f').fontSize(16).font('Helvetica-Bold').text('FEE RECEIPT', { align: 'center' });
    
    // Receipt details
    const y = doc.y + 20;
    doc.fillColor('#333').fontSize(10).font('Helvetica');
    doc.text(`Receipt No: ${feeData.receiptNumber}`, 50, y);
    doc.text(`Date: ${new Date(feeData.date).toLocaleDateString('en-IN')}`, 400, y);
    
    doc.moveTo(50, y + 20).lineTo(545, y + 20).stroke('#ccc');
    
    const y2 = y + 30;
    doc.text(`Student Name: ${feeData.studentName}`, 50, y2);
    doc.text(`Admission No: ${feeData.admissionNumber}`, 50, y2 + 20);
    doc.text(`Class: ${feeData.className} - ${feeData.section}`, 50, y2 + 40);
    doc.text(`Academic Year: ${feeData.academicYear}`, 300, y2);

    doc.moveTo(50, y2 + 65).lineTo(545, y2 + 65).stroke('#ccc');

    // Fee table
    const tableTop = y2 + 80;
    doc.fillColor('#1e3a5f').rect(50, tableTop, 495, 25).fill();
    doc.fillColor('white').text('Description', 60, tableTop + 7);
    doc.text('Amount (Rs.)', 450, tableTop + 7);

    let rowY = tableTop + 30;
    (feeData.breakdown || []).forEach((item, i) => {
      if (i % 2 === 0) doc.fillColor('#f9f9f9').rect(50, rowY - 5, 495, 22).fill();
      doc.fillColor('#333').text(String(item.type || ''), 60, rowY);
      doc.text(Number(item.amount || 0).toFixed(2), 450, rowY);
      rowY += 22;
    });

    doc.moveTo(50, rowY).lineTo(545, rowY).stroke('#999');
    
    if (feeData.discount > 0) {
      doc.fillColor('#e74c3c').text(`Discount (${feeData.discountReason})`, 60, rowY + 10);
      doc.text(`- ${feeData.discount.toFixed(2)}`, 450, rowY + 10);
      rowY += 22;
    }

    if (feeData.lateFee > 0) {
      doc.fillColor('#e74c3c').text('Late Fee', 60, rowY + 10);
      doc.text(feeData.lateFee.toFixed(2), 450, rowY + 10);
      rowY += 22;
    }

    doc.fillColor('#1e3a5f').font('Helvetica-Bold').text('Net Amount', 60, rowY + 10);
    doc.text(`Rs. ${Number(feeData.netAmount || 0).toFixed(2)}`, 440, rowY + 10);

    doc.fillColor('#27ae60').font('Helvetica-Bold').text('Amount Paid', 60, rowY + 30);
    doc.text(`Rs. ${Number(feeData.paidAmount || 0).toFixed(2)}`, 440, rowY + 30);

    if (feeData.pendingAmount > 0) {
      doc.fillColor('#e74c3c').font('Helvetica-Bold').text('Pending Amount', 60, rowY + 50);
      doc.text(`Rs. ${Number(feeData.pendingAmount || 0).toFixed(2)}`, 440, rowY + 50);
    }

    // Footer
    const footerY = doc.page.height - 80;
    doc.moveTo(50, footerY).lineTo(545, footerY).stroke('#ccc');
    doc.fillColor('#666').font('Helvetica').fontSize(9)
      .text('Payment Method: ' + feeData.paymentMethod, 50, footerY + 10)
      .text('This is a computer generated receipt.', { align: 'center' })
      .text('Authorized Signature', 400, footerY + 30);

    doc.end();
  });
};

const generatePaySlip = (salaryData, employeeData, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 90).fill('#1e3a5f');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text(schoolData.name, 50, 15, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(`${schoolData.address?.street}, ${schoolData.address?.city}`, { align: 'center' });

    doc.moveDown(1.5);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    doc.fillColor('#1e3a5f').fontSize(14).font('Helvetica-Bold').text(`SALARY SLIP - ${months[salaryData.month - 1]} ${salaryData.year}`, { align: 'center' });

    const detY = doc.y + 15;
    doc.fillColor('#333').fontSize(10).font('Helvetica');
    doc.text(`Name: ${employeeData.name}`, 50, detY);
    doc.text(`Employee ID: ${employeeData.employeeId}`, 300, detY);
    doc.text(`Designation: ${employeeData.designation || employeeData.role}`, 50, detY + 18);
    doc.text(`Slip No: ${salaryData.slipNumber}`, 300, detY + 18);
    doc.text(`Working Days: ${salaryData.workingDays} | Present: ${salaryData.presentDays}`, 50, detY + 36);

    doc.moveTo(50, detY + 55).lineTo(545, detY + 55).stroke('#ccc');

    const tableY = detY + 70;
    // Earnings
    doc.fillColor('#27ae60').font('Helvetica-Bold').fontSize(11).text('EARNINGS', 50, tableY);
    doc.fillColor('#e74c3c').text('DEDUCTIONS', 300, tableY);

    const earnings = [
      ['Basic Salary', salaryData.earnings.basic],
      ['HRA', salaryData.earnings.hra],
      ['DA', salaryData.earnings.da],
      ['Other Allowances', salaryData.earnings.otherAllowances],
      ['Overtime', salaryData.earnings.overtime || 0],
      ['Bonus', salaryData.earnings.bonus || 0]
    ];
    const deductions = [
      ['PF', salaryData.deductions.pf],
      ['ESI', salaryData.deductions.esi],
      ['Income Tax', salaryData.deductions.tax || 0],
      ['Loan Recovery', salaryData.deductions.loan || 0],
      ['Loss of Pay', salaryData.deductions.lossOfPay || 0],
      ['Other', salaryData.deductions.other || 0]
    ];

    earnings.forEach((e, i) => {
      const ry = tableY + 20 + i * 20;
      doc.fillColor('#333').font('Helvetica').fontSize(9).text(e[0], 50, ry);
      doc.text(`${(e[1] || 0).toFixed(2)}`, 200, ry);
    });
    deductions.forEach((d, i) => {
      const ry = tableY + 20 + i * 20;
      doc.fillColor('#333').font('Helvetica').fontSize(9).text(d[0], 300, ry);
      doc.text(`${(d[1] || 0).toFixed(2)}`, 470, ry);
    });

    const summaryY = tableY + 160;
    doc.moveTo(50, summaryY).lineTo(545, summaryY).stroke('#ccc');
    doc.fillColor('#27ae60').font('Helvetica-Bold').fontSize(10).text(`Gross: Rs. ${salaryData.grossSalary.toFixed(2)}`, 50, summaryY + 10);
    doc.fillColor('#e74c3c').text(`Deductions: Rs. ${salaryData.totalDeductions.toFixed(2)}`, 200, summaryY + 10);
    doc.fillColor('#1e3a5f').fontSize(12).text(`NET PAY: Rs. ${salaryData.netSalary.toFixed(2)}`, 370, summaryY + 8);

    const footY = doc.page.height - 80;
    doc.moveTo(50, footY).lineTo(545, footY).stroke('#ccc');
    doc.fillColor('#666').font('Helvetica').fontSize(8)
      .text('This is a computer generated payslip.', { align: 'center' }, footY + 10)
      .text('Employer Signature', 400, footY + 25);

    doc.end();
  });
};

const generateAdmissionLetter = (studentData, schoolData, template) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Fill template placeholders
    let content = template
      .replace(/{{student_name}}/g, studentData.name)
      .replace(/{{admission_number}}/g, studentData.admissionNumber)
      .replace(/{{class}}/g, studentData.className)
      .replace(/{{section}}/g, studentData.section)
      .replace(/{{admission_date}}/g, new Date(studentData.admissionDate).toLocaleDateString('en-IN'))
      .replace(/{{school_name}}/g, schoolData.name)
      .replace(/{{academic_year}}/g, studentData.academicYear)
      .replace(/{{date}}/g, new Date().toLocaleDateString('en-IN'));

    doc.rect(0, 0, doc.page.width, 90).fill('#1e3a5f');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text(schoolData.name, 60, 15, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(`${schoolData.address?.street}, ${schoolData.address?.city}`, { align: 'center' });
    doc.text(`Phone: ${schoolData.phone}`, { align: 'center' });

    doc.moveDown(2);
    doc.fillColor('#1e3a5f').fontSize(16).font('Helvetica-Bold').text('ADMISSION LETTER', { align: 'center' });
    doc.moveDown();
    doc.fillColor('#333').fontSize(11).font('Helvetica').text(content, { lineGap: 6 });
    
    const footY = doc.page.height - 100;
    doc.text('Principal / Authorized Signatory', 350, footY);
    doc.moveTo(350, footY + 40).lineTo(540, footY + 40).stroke('#333');
    doc.text(`${schoolData.name}`, 350, footY + 45);

    doc.end();
  });
};

const generateJobOffer = (employeeData, schoolData, template) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    let content = template
      .replace(/{{employee_name}}/g, employeeData.name)
      .replace(/{{designation}}/g, employeeData.designation || employeeData.role)
      .replace(/{{joining_date}}/g, employeeData.dateOfJoining ? new Date(employeeData.dateOfJoining).toLocaleDateString('en-IN') : '')
      .replace(/{{gross_salary}}/g, (employeeData.salary?.basic + employeeData.salary?.hra + employeeData.salary?.da).toFixed(2))
      .replace(/{{school_name}}/g, schoolData.name)
      .replace(/{{date}}/g, new Date().toLocaleDateString('en-IN'));

    doc.rect(0, 0, doc.page.width, 90).fill('#1e3a5f');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text(schoolData.name, 60, 15, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(`${schoolData.address?.street}, ${schoolData.address?.city}`, { align: 'center' });

    doc.moveDown(2);
    doc.fillColor('#1e3a5f').fontSize(16).font('Helvetica-Bold').text('OFFER LETTER', { align: 'center' });
    doc.moveDown();
    doc.fillColor('#333').fontSize(11).font('Helvetica').text(content, { lineGap: 6 });

    const footY = doc.page.height - 100;
    doc.text('Authorized Signatory', 350, footY);
    doc.moveTo(350, footY + 40).lineTo(540, footY + 40).stroke('#333');
    doc.text(`${schoolData.name}`, 350, footY + 45);

    doc.end();
  });
};

const generateResultCard = (resultData, studentData, schoolData, examData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#1e3a5f');
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke('#2563eb');

    doc.rect(30, 30, doc.page.width - 60, 80).fill('#1e3a5f');
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text(schoolData.name, 50, 40, { align: 'center' });
    doc.fontSize(9).text(`${schoolData.address?.street}, ${schoolData.address?.city} | ${schoolData.phone}`, { align: 'center' });

    doc.fillColor('#1e3a5f').fontSize(14).font('Helvetica-Bold').text(`RESULT CARD - ${examData.name}`, { align: 'center' }, doc.y + 5);

    const infoY = doc.y + 10;
    doc.fillColor('#333').fontSize(9).font('Helvetica');
    doc.text(`Student: ${studentData.name}`, 50, infoY);
    doc.text(`Class: ${resultData.className} - ${resultData.section}`, 300, infoY);
    doc.text(`Admission No: ${studentData.admissionNumber}`, 50, infoY + 15);
    doc.text(`Roll No: ${studentData.rollNumber || '-'}`, 300, infoY + 15);
    doc.text(`Academic Year: ${resultData.academicYear}`, 50, infoY + 30);
    doc.text(`Attendance: ${resultData.attendance || 0}%`, 300, infoY + 30);

    // Marks table
    const tableY = infoY + 55;
    const headers = ['Subject', 'Max', 'Theory', 'Practical', 'Total', 'Grade', 'Remarks'];
    const colX = [50, 190, 245, 305, 365, 420, 460];

    doc.fillColor('#1e3a5f').rect(50, tableY, 495, 22).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    headers.forEach((h, i) => doc.text(h, colX[i], tableY + 7, { width: 50 }));

    let rowY = tableY + 25;
    resultData.marks.forEach((m, i) => {
      if (i % 2 === 0) doc.fillColor('#f5f8ff').rect(50, rowY - 3, 495, 20).fill();
      doc.fillColor(m.isAbsent ? '#e74c3c' : '#333').font('Helvetica').fontSize(9);
      doc.text(m.subjectName || '-', colX[0], rowY, { width: 135 });
      doc.text(String(m.maxMarks || 0), colX[1], rowY);
      doc.text(m.isAbsent ? 'AB' : String(m.theoryMarks || 0), colX[2], rowY);
      doc.text(m.isAbsent ? 'AB' : String(m.practicalMarks || '-'), colX[3], rowY);
      doc.text(m.isAbsent ? 'AB' : String(m.totalMarks || 0), colX[4], rowY);
      doc.text(m.grade || '-', colX[5], rowY);
      doc.text(m.remarks || '', colX[6], rowY, { width: 80 });
      rowY += 20;
    });

    doc.moveTo(50, rowY + 5).lineTo(545, rowY + 5).stroke('#ccc');

    const summaryY = rowY + 15;
    doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(10);
    doc.text(`Total: ${resultData.totalMarksObtained} / ${resultData.totalMaxMarks}`, 50, summaryY);
    doc.text(`Percentage: ${resultData.percentage?.toFixed(1)}%`, 200, summaryY);
    doc.text(`Grade: ${resultData.grade}`, 350, summaryY);
    doc.text(`Rank: ${resultData.rank || '-'}`, 450, summaryY);

    if (resultData.teacherRemarks) {
      doc.fillColor('#555').font('Helvetica').fontSize(9).text(`Remarks: ${resultData.teacherRemarks}`, 50, summaryY + 20);
    }

    const footY = doc.page.height - 80;
    doc.fillColor('#666').font('Helvetica').fontSize(8);
    doc.text("Class Teacher's Signature", 50, footY);
    doc.moveTo(50, footY + 30).lineTo(180, footY + 30).stroke('#999');
    doc.text("Principal's Signature", 380, footY);
    doc.moveTo(380, footY + 30).lineTo(540, footY + 30).stroke('#999');

    doc.end();
  });
};

const generateHallTicket = (studentData, examData, scheduleRows, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;

    // Header band
    doc.rect(0, 0, W, 90).fill('#1e3a5f');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text(schoolData.name, 50, 16, { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#cbd5e1')
      .text([schoolData.address?.street, schoolData.address?.city, schoolData.phone].filter(Boolean).join('  |  '), 50, 42, { align: 'center' });
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#fbbf24').text('HALL TICKET', 50, 62, { align: 'center' });

    // Exam title strip
    doc.rect(0, 90, W, 28).fill('#e2e8f0');
    doc.fillColor('#1e3a5f').fontSize(12).font('Helvetica-Bold')
      .text(examData.name + (examData.academicYear ? `  —  ${examData.academicYear}` : ''), 50, 98, { align: 'center' });

    // Student info box
    const boxY = 132;
    doc.rect(50, boxY, W - 100, 80).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#1e3a5f').fontSize(10).font('Helvetica-Bold').text('Student Information', 65, boxY + 10);
    doc.fillColor('#333').font('Helvetica').fontSize(10);
    const col1 = 65, col2 = 320;
    doc.text(`Name : ${studentData.name}`, col1, boxY + 26);
    doc.text(`Admission No : ${studentData.admissionNumber}`, col2, boxY + 26);
    doc.text(`Class : ${studentData.className || ''} ${studentData.section || ''}`, col1, boxY + 42);
    doc.text(`Roll No : ${studentData.rollNumber || '—'}`, col2, boxY + 42);
    doc.text(`Academic Year : ${examData.academicYear || '—'}`, col1, boxY + 58);

    // Schedule table
    const tableY = boxY + 98;
    const cols = [50, 210, 330, 400, 470];
    const headers = ['Subject', 'Date', 'Start', 'End', 'Room'];
    const widths = [160, 120, 70, 70, 75];

    doc.rect(50, tableY, W - 100, 22).fill('#1e3a5f');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, cols[i] + 4, tableY + 7, { width: widths[i] }));

    let rowY = tableY + 22;
    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    scheduleRows.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(50, rowY, W - 100, 22).fill('#f1f5f9');
      else doc.rect(50, rowY, W - 100, 22).fill('white');
      doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(9).text(row.subjectName, cols[0] + 4, rowY + 7, { width: widths[0] });
      doc.fillColor('#333').font('Helvetica').fontSize(9);
      doc.text(fmt(row.date), cols[1] + 4, rowY + 7, { width: widths[1] });
      doc.text(row.startTime || '—', cols[2] + 4, rowY + 7, { width: widths[2] });
      doc.text(row.endTime || '—', cols[3] + 4, rowY + 7, { width: widths[3] });
      doc.text(row.room || '—', cols[4] + 4, rowY + 7, { width: widths[4] });
      doc.moveTo(50, rowY + 22).lineTo(W - 50, rowY + 22).stroke('#e2e8f0');
      rowY += 22;
    });

    if (scheduleRows.length === 0) {
      doc.rect(50, rowY, W - 100, 30).fill('#fff');
      doc.fillColor('#999').font('Helvetica').fontSize(10).text('No exam dates have been set yet.', 50, rowY + 9, { align: 'center', width: W - 100 });
      rowY += 30;
    }

    // Bottom border of table
    doc.rect(50, tableY, W - 100, rowY - tableY).stroke('#e2e8f0');

    // Instructions
    const instrY = rowY + 20;
    doc.fillColor('#1e3a5f').fontSize(9).font('Helvetica-Bold').text('Instructions:', 50, instrY);
    doc.fillColor('#555').font('Helvetica').fontSize(8)
      .text('1. This hall ticket must be produced at the examination hall.', 50, instrY + 14)
      .text('2. Students must arrive at least 15 minutes before the exam starts.', 50, instrY + 26)
      .text('3. Mobile phones and electronic devices are not permitted in the exam hall.', 50, instrY + 38)
      .text('4. This is a computer generated hall ticket.', 50, instrY + 50);

    // Signature line
    const sigY = doc.page.height - 80;
    doc.moveTo(50, sigY).lineTo(180, sigY).stroke('#999');
    doc.fillColor('#666').fontSize(8).text("Student's Signature", 50, sigY + 5);
    doc.moveTo(380, sigY).lineTo(540, sigY).stroke('#999');
    doc.text("Principal's Signature", 380, sigY + 5);

    doc.end();
  });
};

const generateFeesReport = (feesData, schoolData, filters = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;   // ~841
    const L = 30;                // left margin
    const usableW = W - L * 2;  // ~781

    // Collect unique term names from all fee records
    const termNames = [];
    feesData.forEach(f => (f.terms || []).forEach(t => {
      if (!termNames.includes(t.name)) termNames.push(t.name);
    }));

    // Column widths
    const fixedW = { sno: 28, name: 130, mobile: 82, cls: 62, total: 58, paid: 58, pending: 62, status: 52 };
    const fixedTotal = Object.values(fixedW).reduce((a, b) => a + b, 0);
    const termW = termNames.length > 0 ? Math.max(38, Math.floor((usableW - fixedTotal) / termNames.length)) : 0;
    const tableW = fixedTotal + termW * termNames.length;

    // Column X positions
    const colX = {};
    let cx = L;
    colX.sno = cx; cx += fixedW.sno;
    colX.name = cx; cx += fixedW.name;
    colX.mobile = cx; cx += fixedW.mobile;
    colX.cls = cx; cx += fixedW.cls;
    colX.terms = termNames.map((_, i) => { const x = cx + i * termW; return x; });
    cx += termW * termNames.length;
    colX.total = cx; cx += fixedW.total;
    colX.paid = cx; cx += fixedW.paid;
    colX.pending = cx; cx += fixedW.pending;
    colX.status = cx;

    const ROW_H = 22;
    const HEAD_H = 40;

    // ── School header band ──
    doc.rect(0, 0, W, 72).fill('#1e3a5f');
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
      .text(schoolData.name || 'School', L, 12, { align: 'center', width: usableW });
    doc.fontSize(8).font('Helvetica')
      .text([schoolData.address?.street, schoolData.address?.city, schoolData.phone].filter(Boolean).join('  |  '), L, 34, { align: 'center', width: usableW });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#fbbf24')
      .text('FEES COLLECTION REPORT', L, 50, { align: 'center', width: usableW });

    // ── Filter info strip ──
    const infoY = 78;
    doc.rect(L, infoY, tableW, 20).fill('#f1f5f9');
    doc.fillColor('#334155').fontSize(8).font('Helvetica');
    const filterParts = [];
    if (filters.className) filterParts.push(`Class: ${filters.className}`);
    if (filters.status) filterParts.push(`Status: ${filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}`);
    if (filters.academicYear) filterParts.push(`Year: ${filters.academicYear}`);
    filterParts.push(`Total Records: ${feesData.length}`);
    filterParts.push(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);
    doc.text(filterParts.join('   ·   '), L + 6, infoY + 6, { width: tableW - 12 });

    // ── Summary chips ──
    const sumY = infoY + 28;
    const paid = feesData.filter(f => f.status === 'paid').length;
    const partial = feesData.filter(f => f.status === 'partial').length;
    const pending = feesData.filter(f => f.status === 'pending' || f.status === 'overdue').length;
    const totalCol = feesData.reduce((s, f) => s + (f.paidAmount || 0), 0);
    const totalPend = feesData.reduce((s, f) => s + (f.pendingAmount || 0), 0);
    const sumChips = [
      { label: 'Paid', val: paid, color: '#166534', bg: '#dcfce7' },
      { label: 'Partial', val: partial, color: '#92400e', bg: '#fef9c3' },
      { label: 'Pending/Overdue', val: pending, color: '#991b1b', bg: '#fee2e2' },
      { label: 'Total Collected', val: `Rs.${totalCol.toLocaleString('en-IN')}`, color: '#1d4ed8', bg: '#dbeafe' },
      { label: 'Total Pending', val: `Rs.${totalPend.toLocaleString('en-IN')}`, color: '#991b1b', bg: '#fee2e2' },
    ];
    let chipX = L;
    sumChips.forEach(chip => {
      const chipText = `${chip.label}: ${chip.val}`;
      const chipW = Math.max(90, doc.widthOfString(chipText) + 16);
      doc.roundedRect(chipX, sumY, chipW, 18, 4).fill(chip.bg);
      doc.fillColor(chip.color).fontSize(8).font('Helvetica-Bold').text(chipText, chipX + 6, sumY + 5, { width: chipW - 8 });
      chipX += chipW + 6;
    });

    // ── Table header ──
    const tableTopY = sumY + 26;
    doc.rect(L, tableTopY, tableW, HEAD_H).fill('#1e3a5f');
    doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
    const hY = tableTopY + 7;
    doc.text('#', colX.sno + 2, hY, { width: fixedW.sno - 2 });
    doc.text('Student Name', colX.name + 2, hY, { width: fixedW.name - 4 });
    doc.text('Mobile', colX.mobile + 2, hY, { width: fixedW.mobile - 4 });
    doc.text('Class', colX.cls + 2, hY, { width: fixedW.cls - 4 });
    termNames.forEach((tn, i) => {
      doc.text(tn, colX.terms[i] + 2, hY, { width: termW - 4 });
    });
    doc.text('Total (Rs.)', colX.total + 2, hY, { width: fixedW.total - 2 });
    doc.text('Paid (Rs.)', colX.paid + 2, hY, { width: fixedW.paid - 2 });
    doc.text('Pending (Rs.)', colX.pending + 2, hY, { width: fixedW.pending - 2 });
    doc.text('Status', colX.status + 2, hY, { width: fixedW.status - 2 });

    // ── Vertical lines in header ──
    doc.strokeColor('#3b82f6');
    [colX.name, colX.mobile, colX.cls, ...colX.terms, colX.total, colX.paid, colX.pending, colX.status].forEach(x => {
      doc.moveTo(x, tableTopY).lineTo(x, tableTopY + HEAD_H).stroke();
    });

    // ── Data rows ──
    let rowY = tableTopY + HEAD_H;
    const fmt = n => (n || 0).toLocaleString('en-IN');
    const statusColors = {
      paid:    { bg: '#dcfce7', fg: '#166534' },
      partial: { bg: '#fef9c3', fg: '#92400e' },
      pending: { bg: '#fee2e2', fg: '#991b1b' },
      overdue: { bg: '#fce7f3', fg: '#9d174d' },
    };

    feesData.forEach((fee, idx) => {
      // Page break check
      if (rowY + ROW_H > doc.page.height - 50) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        rowY = 30;
        // Repeat header
        doc.rect(L, rowY, tableW, 18).fill('#1e3a5f');
        doc.fillColor('white').fontSize(7).font('Helvetica-Bold');
        doc.text('#', colX.sno+2, rowY+5, { width: fixedW.sno-2 });
        doc.text('Student Name', colX.name+2, rowY+5, { width: fixedW.name-4 });
        doc.text('Mobile', colX.mobile+2, rowY+5, { width: fixedW.mobile-4 });
        doc.text('Class', colX.cls+2, rowY+5, { width: fixedW.cls-4 });
        termNames.forEach((tn, i) => doc.text(tn, colX.terms[i]+2, rowY+5, { width: termW-4 }));
        doc.text('Total', colX.total+2, rowY+5, { width: fixedW.total-2 });
        doc.text('Paid', colX.paid+2, rowY+5, { width: fixedW.paid-2 });
        doc.text('Pending', colX.pending+2, rowY+5, { width: fixedW.pending-2 });
        doc.text('Status', colX.status+2, rowY+5, { width: fixedW.status-2 });
        rowY += 18;
      }

      const rowBg = idx % 2 === 0 ? 'white' : '#f8fafc';
      doc.rect(L, rowY, tableW, ROW_H).fill(rowBg);

      // Vertical dividers
      doc.strokeColor('#e2e8f0');
      [colX.name, colX.mobile, colX.cls, ...colX.terms, colX.total, colX.paid, colX.pending, colX.status].forEach(x => {
        doc.moveTo(x, rowY).lineTo(x, rowY + ROW_H).stroke();
      });
      // Bottom border
      doc.moveTo(L, rowY + ROW_H).lineTo(L + tableW, rowY + ROW_H).stroke();

      const textY = rowY + 7;
      doc.fillColor('#1e3a5f').fontSize(7.5).font('Helvetica-Bold');
      doc.text(String(idx + 1), colX.sno + 2, textY, { width: fixedW.sno - 2 });

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
        .text(fee.student?.name || '—', colX.name + 2, textY, { width: fixedW.name - 6, ellipsis: true });
      doc.fillColor('#475569').font('Helvetica').fontSize(7)
        .text(fee.student?.admissionNumber || '', colX.name + 2, textY + 9, { width: fixedW.name - 6 });

      doc.fillColor('#334155').font('Helvetica').fontSize(7.5)
        .text(fee.student?.phone || '—', colX.mobile + 2, textY, { width: fixedW.mobile - 4 });

      const cls = fee.student?.currentClass;
      const clsStr = cls ? `${cls.name}${cls.section ? ' ' + cls.section : ''}` : '—';
      doc.text(clsStr, colX.cls + 2, textY, { width: fixedW.cls - 4 });

      // Term amounts
      termNames.forEach((tn, i) => {
        const term = (fee.terms || []).find(t => t.name === tn);
        if (term) {
          const termAmt = (term.feeBreakdown || []).reduce((s, b) => s + (b.amount || 0), 0);
          const sc = statusColors[term.status] || statusColors.pending;
          doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
            .text(`Rs.${fmt(termAmt)}`, colX.terms[i] + 2, textY, { width: termW - 4 });
          // Small status dot
          doc.circle(colX.terms[i] + termW - 8, textY + 4, 3).fill(sc.fg);
        } else {
          doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
            .text('—', colX.terms[i] + 2, textY, { width: termW - 4 });
        }
      });

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
        .text(`Rs.${fmt(fee.netAmount)}`, colX.total + 2, textY, { width: fixedW.total - 4 });
      doc.fillColor('#166534').font('Helvetica-Bold').fontSize(7.5)
        .text(`Rs.${fmt(fee.paidAmount)}`, colX.paid + 2, textY, { width: fixedW.paid - 4 });

      const pendColor = (fee.pendingAmount || 0) > 0 ? '#991b1b' : '#166534';
      doc.fillColor(pendColor).font('Helvetica-Bold').fontSize(7.5)
        .text(`Rs.${fmt(fee.pendingAmount)}`, colX.pending + 2, textY, { width: fixedW.pending - 4 });

      // Status badge
      const sc = statusColors[fee.status] || statusColors.pending;
      const badgeX = colX.status + 2;
      const badgeW = fixedW.status - 6;
      doc.roundedRect(badgeX, textY - 1, badgeW, 14, 3).fill(sc.bg);
      doc.fillColor(sc.fg).font('Helvetica-Bold').fontSize(7)
        .text((fee.status || 'pending').toUpperCase(), badgeX + 2, textY + 2, { width: badgeW - 2, align: 'center' });

      rowY += ROW_H;
    });

    // Outer border
    doc.rect(L, tableTopY, tableW, rowY - tableTopY).stroke('#cbd5e1');

    // Footer
    const footY = doc.page.height - 30;
    doc.moveTo(L, footY - 10).lineTo(L + tableW, footY - 10).stroke('#e2e8f0');
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
      .text(`Generated on ${new Date().toLocaleString('en-IN')} · ${schoolData.name}`, L, footY - 6, { width: usableW, align: 'center' });

    doc.end();
  });
};

const generateExpensesReport = (expensesData, schoolData, filters = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;
    const L = 50, R = 545, usableW = R - L;
    const rowH = 20;

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const fmtAmt  = (n) => `Rs.${(n || 0).toLocaleString('en-IN')}`;

    // ── Header ──
    doc.rect(0, 0, W, 88).fill('#1e3a5f');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text(schoolData.name || 'School', L, 16, { width: usableW, align: 'center' });
    doc.fontSize(9).font('Helvetica')
      .text([schoolData.address?.street, schoolData.address?.city].filter(Boolean).join(', '), L, 42, { width: usableW, align: 'center' });
    doc.text(`Phone: ${schoolData.phone || '—'}  |  Email: ${schoolData.email || '—'}`, L, 56, { width: usableW, align: 'center' });

    // ── Title + date range ──
    doc.fillColor('#1e3a5f').fontSize(15).font('Helvetica-Bold')
      .text('EXPENSE REPORT', L, 102, { width: usableW, align: 'center' });

    const { startDate, endDate, category } = filters;
    let subtitle = '';
    if (startDate && endDate) subtitle = `${fmtDate(startDate)}  —  ${fmtDate(endDate)}`;
    else if (startDate) subtitle = `From ${fmtDate(startDate)}`;
    else if (endDate)   subtitle = `Up to ${fmtDate(endDate)}`;
    if (subtitle) doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(subtitle, L, 122, { width: usableW, align: 'center' });
    if (category) doc.fillColor('#64748b').fontSize(9).text(`Category: ${category.charAt(0).toUpperCase() + category.slice(1)}`, L, 136, { width: usableW, align: 'center' });

    // ── Summary strip ──
    const total = expensesData.reduce((s, e) => s + (e.amount || 0), 0);
    const catMap = {};
    expensesData.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const sumY = 152;
    doc.rect(L, sumY, usableW, 32).fillAndStroke('#eff6ff', '#bfdbfe');
    doc.fillColor('#1e3a5f').fontSize(10).font('Helvetica-Bold')
      .text(`Total: ${fmtAmt(total)}`, L + 12, sumY + 6);
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text(`${expensesData.length} record${expensesData.length !== 1 ? 's' : ''}`, L + 12, sumY + 19);
    // Category chips inline
    let chipX = L + 100;
    catEntries.slice(0, 5).forEach(([cat, amt]) => {
      const label = `${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${fmtAmt(amt)}`;
      doc.fillColor('#1d4ed8').fontSize(8).text(label, chipX, sumY + 12, { lineBreak: false });
      chipX += doc.widthOfString(label) + 18;
    });

    // ── Table ──
    const cols = { date: 64, title: 148, category: 68, vendor: 68, amount: 72, method: 75 };
    const cx = {
      date:     L,
      title:    L + cols.date,
      category: L + cols.date + cols.title,
      vendor:   L + cols.date + cols.title + cols.category,
      amount:   L + cols.date + cols.title + cols.category + cols.vendor,
      method:   L + cols.date + cols.title + cols.category + cols.vendor + cols.amount,
    };

    const drawHeader = (y) => {
      doc.rect(L, y, usableW, rowH).fill('#1e3a5f');
      doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
      [['DATE', 'date'], ['TITLE', 'title'], ['CATEGORY', 'category'],
       ['VENDOR', 'vendor'], ['AMOUNT', 'amount'], ['METHOD', 'method']].forEach(([lbl, key]) => {
        const align = key === 'amount' ? 'right' : 'left';
        doc.text(lbl, cx[key] + 4, y + 6, { width: cols[key] - 8, align, lineBreak: false });
      });
    };

    let rowY = sumY + 46;
    drawHeader(rowY);
    rowY += rowH;

    const pageBottom = doc.page.height - 110;

    expensesData.forEach((exp, i) => {
      if (rowY + rowH > pageBottom) {
        doc.addPage();
        rowY = 50;
        drawHeader(rowY);
        rowY += rowH;
      }
      if (i % 2 === 0) doc.rect(L, rowY, usableW, rowH).fill('#f8fafc');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      const dateStr = exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
      const cat    = exp.category ? exp.category.charAt(0).toUpperCase() + exp.category.slice(1) : '';
      const method = exp.paymentMethod ? exp.paymentMethod.replace('_', ' ') : '';
      doc.text(dateStr,          cx.date     + 4, rowY + 6, { width: cols.date     - 8, lineBreak: false });
      doc.text(exp.title || '',  cx.title    + 4, rowY + 6, { width: cols.title    - 8, lineBreak: false });
      doc.text(cat,              cx.category + 4, rowY + 6, { width: cols.category - 8, lineBreak: false });
      doc.text(exp.vendor || '—',cx.vendor   + 4, rowY + 6, { width: cols.vendor   - 8, lineBreak: false });
      doc.fillColor('#dc2626').font('Helvetica-Bold')
        .text(fmtAmt(exp.amount), cx.amount + 4, rowY + 6, { width: cols.amount - 8, align: 'right', lineBreak: false });
      doc.fillColor('#1e293b').font('Helvetica')
        .text(method, cx.method + 4, rowY + 6, { width: cols.method - 8, lineBreak: false });
      rowY += rowH;
    });

    // Total row
    doc.rect(L, rowY, usableW, rowH).fill('#1e3a5f');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('TOTAL', cx.date + 4, rowY + 6, { width: cols.date + cols.title + cols.category + cols.vendor - 8, lineBreak: false });
    doc.text(fmtAmt(total), cx.amount + 4, rowY + 6, { width: cols.amount - 8, align: 'right', lineBreak: false });
    rowY += rowH + 22;

    // ── Category summary ──
    if (catEntries.length > 1) {
      if (rowY + 20 + catEntries.length * 18 > doc.page.height - 60) { doc.addPage(); rowY = 50; }
      doc.fillColor('#1e3a5f').fontSize(11).font('Helvetica-Bold').text('Category Summary', L, rowY);
      rowY += 16;
      catEntries.forEach(([cat, amt], i) => {
        if (i % 2 === 0) doc.rect(L, rowY, usableW, 18).fill('#f8fafc');
        const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '0.0';
        doc.fillColor('#334155').fontSize(9).font('Helvetica')
          .text(cat.charAt(0).toUpperCase() + cat.slice(1), L + 8, rowY + 4, { width: 220, lineBreak: false });
        doc.fillColor('#64748b').text(`${pct}%`, L + 230, rowY + 4, { width: 60, lineBreak: false });
        doc.fillColor('#dc2626').font('Helvetica-Bold')
          .text(fmtAmt(amt), L + 300, rowY + 4, { width: usableW - 308, align: 'right', lineBreak: false });
        rowY += 18;
      });
    }

    // ── Footer ──
    const footY = doc.page.height - 28;
    doc.moveTo(L, footY - 10).lineTo(R, footY - 10).stroke('#e2e8f0');
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
      .text(`Generated on ${new Date().toLocaleString('en-IN')} · ${schoolData.name}`, L, footY - 5, { width: usableW, align: 'center' });

    doc.end();
  });
};

module.exports = { generateFeeReceipt, generatePaySlip, generateAdmissionLetter, generateJobOffer, generateResultCard, generateHallTicket, generateFeesReport, generateExpensesReport };
