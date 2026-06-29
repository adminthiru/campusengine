const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');

// ── Shared helpers ────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r, g, b];
};

const lighten = (hex, factor = 0.92) => {
  const [r,g,b] = hexToRgb(hex);
  const l = (c) => Math.round((c + (1-c)*factor)*255);
  return `#${l(r).toString(16).padStart(2,'0')}${l(g).toString(16).padStart(2,'0')}${l(b).toString(16).padStart(2,'0')}`;
};

const tryLogo = (doc, schoolData, x, y, size) => {
  const cfg = schoolData.pdfConfig || {};
  if (cfg.showLogo === false || !schoolData.logo) return false;
  try {
    const logoPath = path.join(__dirname, '..', schoolData.logo.replace(/^\//, ''));
    if (!fs.existsSync(logoPath)) return false;
    doc.image(logoPath, x, y, { width: size, height: size, fit: [size, size] });
    return true;
  } catch (_) { return false; }
};

const drawHeader = (doc, schoolData, title) => {
  const cfg        = schoolData.pdfConfig || {};
  const primary    = cfg.primaryColor    || '#1a56e8';
  const style      = cfg.headerStyle     || 'solid';
  const displayName = cfg.pdfName?.trim() || schoolData.name || 'School';
  const W = doc.page.width;
  const L = 50, R = W - 50;
  const logoSize = 44;
  const hasLogo  = cfg.showLogo !== false && !!schoolData.logo;

  if (style === 'minimal') {
    let nameX = L + 14;
    if (hasLogo) {
      tryLogo(doc, schoolData, L, 24, logoSize);
      nameX = L + logoSize + 10;
    }
    doc.rect(L, 30, 4, 60).fill(primary);
    doc.fillColor(primary).fontSize(20).font('Helvetica-Bold')
      .text(displayName, nameX, 32, { width: R - nameX });
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text([schoolData.address?.street, schoolData.address?.city, schoolData.phone].filter(Boolean).join('  ·  '), nameX, 56, { width: R - nameX });
    doc.moveTo(L, 96).lineTo(R, 96).lineWidth(2).stroke(primary);
    doc.lineWidth(1);
    doc.fillColor(primary).fontSize(13).font('Helvetica-Bold')
      .text(title, L, 104, { width: R - L, align: 'right' });
    return 124;
  } else if (style === 'stripe') {
    doc.rect(0, 0, W, 6).fill(primary);
    doc.rect(0, 6, W, 88).fill('#f8fafc');
    const contentLeft = hasLogo ? L + logoSize + 14 : L;
    const contentW    = hasLogo ? R - L - logoSize - 14 : R - L;
    if (hasLogo) tryLogo(doc, schoolData, L, 14, logoSize);
    doc.fillColor(primary).fontSize(20).font('Helvetica-Bold')
      .text(displayName, contentLeft, 16, { width: contentW, align: hasLogo ? 'left' : 'center' });
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text([schoolData.address?.street, schoolData.address?.city, schoolData.phone].filter(Boolean).join('  ·  '), contentLeft, 42, { width: contentW, align: hasLogo ? 'left' : 'center' });
    const bW = Math.min(doc.widthOfString(title) + 32, R - L);
    const bX = (W - bW) / 2;
    doc.rect(bX, 66, bW, 22).fill(primary);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text(title, bX, 72, { width: bW, align: 'center' });
    return 102;
  } else {
    // solid (default)
    doc.rect(0, 0, W, 82).fill(primary);
    const contentLeft = hasLogo ? L + logoSize + 14 : L;
    const contentW    = hasLogo ? R - L - logoSize - 14 : R - L;
    if (hasLogo) tryLogo(doc, schoolData, L, 14, logoSize);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text(displayName, contentLeft, hasLogo ? 14 : 16, { width: contentW, align: hasLogo ? 'left' : 'center' });
    doc.fillColor('rgba(255,255,255,0.8)').fontSize(9).font('Helvetica')
      .text([schoolData.address?.street, schoolData.address?.city, schoolData.phone].filter(Boolean).join('  ·  '), contentLeft, hasLogo ? 40 : 44, { width: contentW, align: hasLogo ? 'left' : 'center' });
    doc.rect(0, 82, W, 26).fill(lighten(primary, 0.85));
    doc.fillColor(primary).fontSize(12).font('Helvetica-Bold')
      .text(title, L, 89, { width: R - L, align: 'center' });
    return 122;
  }
};

const drawFooter = (doc, schoolData) => {
  const cfg    = schoolData.pdfConfig || {};
  const primary = cfg.primaryColor   || '#1a56e8';
  const sigLabel = cfg.signatureLabel || 'Principal / Authorized Signatory';
  const footerText = cfg.footerText  || 'This is a computer generated document.';
  const W = doc.page.width, L = 50, R = W - 50;
  const footY = doc.page.height - 80;

  doc.moveTo(L, footY).lineTo(R, footY).stroke('#e2e8f0');

  // Signature line right side
  doc.moveTo(370, footY + 36).lineTo(R, footY + 36).stroke('#94a3b8');
  doc.fillColor('#64748b').fontSize(8).font('Helvetica')
    .text(sigLabel, 370, footY + 40, { width: R - 370, align: 'center' });

  doc.fillColor('#94a3b8').fontSize(8)
    .text(footerText, L, footY + 10, { width: 300 })
    .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, L, footY + 22, { width: 300 });
};

// ── Fee Receipt ───────────────────────────────────────────────────────────────
const generateFeeReceipt = (feeData, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const cfg     = schoolData.pdfConfig || {};
    const primary = cfg.primaryColor    || '#1a56e8';
    const light   = lighten(primary);
    const W = doc.page.width, L = 50, R = W - 50;

    // When nothing has been paid yet, this is a pending statement, not a receipt.
    const isStatement = !(Number(feeData.paidAmount) > 0);

    let y = drawHeader(doc, schoolData, isStatement ? 'FEE STATEMENT' : 'FEE RECEIPT');

    // Meta row
    doc.rect(L, y, R - L, 28).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold')
      .text(isStatement ? 'Fee Statement' : `Receipt No: ${feeData.receiptNumber || '—'}`, L + 10, y + 9);
    doc.font('Helvetica').fillColor('#64748b')
      .text(`Date: ${new Date(feeData.date || Date.now()).toLocaleDateString('en-IN')}`, R - 150, y + 9, { width: 140, align: 'right' });
    y += 38;

    // Student info grid
    const infoItems = [
      ['Student Name', feeData.studentName || '—'],
      ['Admission No', feeData.admissionNumber || '—'],
      ['Class', `${feeData.className || ''} ${feeData.section ? '– ' + feeData.section : ''}`.trim() || '—'],
      ['Academic Year', feeData.academicYear || '—'],
    ];
    const halfW = (R - L - 10) / 2;
    infoItems.forEach((item, i) => {
      const col  = i % 2 === 0 ? L : L + halfW + 10;
      const rowY = y + Math.floor(i / 2) * 24;
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(item[0].toUpperCase(), col, rowY);
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(item[1], col, rowY + 10);
    });
    y += 60;

    doc.moveTo(L, y).lineTo(R, y).stroke('#e2e8f0');
    y += 14;

    // Fee table header
    doc.rect(L, y, R - L, 24).fill(primary);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
      .text('DESCRIPTION', L + 10, y + 7)
      .text('AMOUNT (Rs.)', R - 110, y + 7, { width: 100, align: 'right' });
    y += 24;

    // Fee rows
    (feeData.breakdown || []).forEach((item, i) => {
      if (i % 2 === 0) doc.rect(L, y, R - L, 22).fill(light);
      doc.fillColor('#374151').fontSize(9).font('Helvetica')
        .text(String(item.type || ''), L + 10, y + 6)
        .text(`Rs. ${Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, R - 110, y + 6, { width: 100, align: 'right' });
      y += 22;
    });

    if (feeData.discount > 0) {
      doc.rect(L, y, R - L, 22).fill('#fff7ed');
      doc.fillColor('#c2410c').fontSize(9).font('Helvetica')
        .text(`Discount${feeData.discountReason ? ' (' + feeData.discountReason + ')' : ''}`, L + 10, y + 6)
        .text(`- Rs. ${Number(feeData.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, R - 110, y + 6, { width: 100, align: 'right' });
      y += 22;
    }
    if (feeData.lateFee > 0) {
      doc.rect(L, y, R - L, 22).fill('#fff7ed');
      doc.fillColor('#c2410c').fontSize(9).font('Helvetica')
        .text('Late Fee', L + 10, y + 6)
        .text(`Rs. ${Number(feeData.lateFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, R - 110, y + 6, { width: 100, align: 'right' });
      y += 22;
    }

    y += 8;
    // Summary strip
    const summaryItems = [
      { label: 'Net Amount', val: feeData.netAmount || 0, color: '#1e293b', bg: '#f1f5f9' },
      { label: 'Amount Paid', val: feeData.paidAmount || 0, color: '#166534', bg: '#dcfce7' },
      ...(feeData.pendingAmount > 0 ? [{ label: 'Pending', val: feeData.pendingAmount, color: '#991b1b', bg: '#fee2e2' }] : []),
    ];
    const sW = (R - L) / summaryItems.length;
    summaryItems.forEach((s, i) => {
      const sx = L + i * sW;
      doc.rect(sx + (i === 0 ? 0 : 2), y, sW - (summaryItems.length > 1 ? 4 : 0), 44).fill(s.bg).stroke('#e2e8f0');
      doc.fillColor(s.color).fontSize(8).font('Helvetica').text(s.label.toUpperCase(), sx + 8, y + 8, { width: sW - 16, align: 'center' });
      doc.fillColor(s.color).fontSize(14).font('Helvetica-Bold')
        .text(`Rs. ${Number(s.val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sx + 8, y + 22, { width: sW - 16, align: 'center' });
    });
    y += 54;

    // Payment method (only meaningful once something is paid)
    if (!isStatement) {
      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text(`Payment Method: ${(feeData.paymentMethod || '').replace(/_/g,' ')}`, L, y);
    } else {
      doc.fillColor('#991b1b').fontSize(9).font('Helvetica-Bold')
        .text(`Amount Payable: Rs. ${Number(feeData.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, L, y);
    }

    drawFooter(doc, schoolData);
    doc.end();
  });
};

// ── Pay Slip ──────────────────────────────────────────────────────────────────
const generatePaySlip = (salaryData, employeeData, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const cfg     = schoolData.pdfConfig || {};
    const primary = cfg.primaryColor    || '#1a56e8';
    const light   = lighten(primary);
    const W = doc.page.width, L = 50, R = W - 50;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const title = `SALARY SLIP  —  ${months[(salaryData.month || 1) - 1].toUpperCase()} ${salaryData.year}`;
    let y = drawHeader(doc, schoolData, title);

    // Employee info band
    doc.rect(L, y, R - L, 56).fill('#f8fafc').stroke('#e2e8f0');
    const empFields = [
      ['Employee Name', employeeData.name || '—'],
      ['Employee ID',   employeeData.employeeId || '—'],
      ['Designation',   employeeData.designation || employeeData.role || '—'],
      ['Slip No.',      salaryData.slipNumber || '—'],
    ];
    empFields.forEach((f, i) => {
      const col = i < 2 ? L + 10 : L + (R - L) / 2 + 10;
      const fy  = y + (i % 2) * 28 + 8;
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(f[0].toUpperCase(), col, fy);
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(f[1], col, fy + 10);
    });
    y += 66;

    // Attendance chips
    const present = salaryData.presentDays || 0;
    const working = salaryData.workingDays || 0;
    const lop     = salaryData.leaveDays   || 0;
    const attChips = [
      { label: 'Working Days', val: working, bg: '#eff6ff', fg: primary },
      { label: 'Present Days', val: present, bg: '#f0fdf4', fg: '#166534' },
      { label: 'LOP Days',     val: lop,     bg: lop > 0 ? '#fff7ed' : '#f0fdf4', fg: lop > 0 ? '#c2410c' : '#166534' },
    ];
    const chipW = (R - L) / attChips.length;
    attChips.forEach((c, i) => {
      const cx = L + i * chipW;
      doc.rect(cx + (i>0?2:0), y, chipW - (i>0?4:2), 34).fill(c.bg).stroke('#e2e8f0');
      doc.fillColor(c.fg).fontSize(16).font('Helvetica-Bold')
        .text(String(c.val), cx, y + 4, { width: chipW, align: 'center' });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(c.label, cx, y + 22, { width: chipW, align: 'center' });
    });
    y += 44;

    // Earnings | Deductions table
    const colMid = L + (R - L) / 2;
    const rowH = 22;

    // Column headers
    doc.rect(L,       y, colMid - L - 2, rowH).fill(primary);
    doc.rect(colMid + 2, y, R - colMid - 2, rowH).fill('#ef4444');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
      .text('EARNINGS', L, y + 6, { width: colMid - L - 2, align: 'center' })
      .text('DEDUCTIONS', colMid + 2, y + 6, { width: R - colMid - 2, align: 'center' });
    y += rowH;

    const earnings   = [
      ['Basic Salary',    salaryData.earnings?.basic || 0],
      ['HRA',             salaryData.earnings?.hra   || 0],
      ['DA',              salaryData.earnings?.da    || 0],
      ['Other Allowances',salaryData.earnings?.otherAllowances || 0],
      ['Overtime',        salaryData.earnings?.overtime || 0],
      ['Bonus',           salaryData.earnings?.bonus    || 0],
    ];
    const deductions = [
      ['Provident Fund',  salaryData.deductions?.pf          || 0],
      ['ESI',             salaryData.deductions?.esi         || 0],
      ['Income Tax',      salaryData.deductions?.tax         || 0],
      ['Loan Recovery',   salaryData.deductions?.loan        || 0],
      ['Loss of Pay',     salaryData.deductions?.lossOfPay   || 0],
      ['Other',           salaryData.deductions?.other       || 0],
    ];
    const rows = Math.max(earnings.length, deductions.length);
    for (let i = 0; i < rows; i++) {
      const ry = y + i * rowH;
      if (i % 2 === 0) {
        doc.rect(L,         ry, colMid - L - 2, rowH).fill(light);
        doc.rect(colMid + 2,ry, R - colMid - 2, rowH).fill('#fff5f5');
      } else {
        doc.rect(L,         ry, colMid - L - 2, rowH).fill('white');
        doc.rect(colMid + 2,ry, R - colMid - 2, rowH).fill('white');
      }
      if (earnings[i]) {
        doc.fillColor('#374151').fontSize(9).font('Helvetica')
          .text(earnings[i][0], L + 8, ry + 6, { width: 130 });
        doc.fillColor((earnings[i][1] || 0) > 0 ? '#166534' : '#94a3b8').font('Helvetica-Bold')
          .text(fmt(earnings[i][1]), colMid - 90, ry + 6, { width: 80, align: 'right' });
      }
      if (deductions[i]) {
        doc.fillColor('#374151').fontSize(9).font('Helvetica')
          .text(deductions[i][0], colMid + 10, ry + 6, { width: 130 });
        doc.fillColor((deductions[i][1] || 0) > 0 ? '#991b1b' : '#94a3b8').font('Helvetica-Bold')
          .text(fmt(deductions[i][1]), R - 90, ry + 6, { width: 80, align: 'right' });
      }
    }
    y += rows * rowH + 4;

    // Totals row
    doc.rect(L, y, colMid - L - 2, rowH).fill('#dcfce7');
    doc.rect(colMid + 2, y, R - colMid - 2, rowH).fill('#fee2e2');
    doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold')
      .text('GROSS SALARY', L + 8, y + 6)
      .text(fmt(salaryData.grossSalary || 0), colMid - 90, y + 6, { width: 80, align: 'right' });
    doc.fillColor('#991b1b').fontSize(9).font('Helvetica-Bold')
      .text('TOTAL DEDUCTIONS', colMid + 10, y + 6)
      .text(fmt(salaryData.totalDeductions || 0), R - 90, y + 6, { width: 80, align: 'right' });
    y += rowH + 10;

    // Net Pay box
    doc.rect(L, y, R - L, 44).fill(primary);
    doc.fillColor('white').fontSize(11).font('Helvetica').text('NET PAY', L, y + 8, { width: R - L, align: 'center' });
    doc.fontSize(20).font('Helvetica-Bold').text(fmt(salaryData.netSalary || 0), L, y + 22, { width: R - L, align: 'center' });
    y += 54;

    drawFooter(doc, schoolData);
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

    const y = drawHeader(doc, schoolData, 'ADMISSION LETTER');
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(11).font('Helvetica').text(content, 60, y + 10, { lineGap: 7, width: doc.page.width - 120 });
    drawFooter(doc, schoolData);

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

    const y = drawHeader(doc, schoolData, 'OFFER LETTER');
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(11).font('Helvetica').text(content, 60, y + 10, { lineGap: 7, width: doc.page.width - 120 });
    drawFooter(doc, schoolData);

    doc.end();
  });
};

// ── Result Card ───────────────────────────────────────────────────────────────
const generateResultCard = (resultData, studentData, schoolData, examData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const cfg     = schoolData.pdfConfig || {};
    const primary = cfg.primaryColor    || '#1a56e8';
    const light   = lighten(primary);
    const W = doc.page.width, L = 50, R = W - 50;

    // Optional border frame
    if (cfg.showBorderFrame) {
      doc.rect(15, 15, W - 30, doc.page.height - 30).stroke(primary);
      doc.rect(20, 20, W - 40, doc.page.height - 40).stroke(lighten(primary, 0.6));
    }

    let y = drawHeader(doc, schoolData, `RESULT CARD  —  ${(examData.name || 'Exam').toUpperCase()}`);

    // Student info grid
    const infoFields = [
      ['Student Name',   studentData.name || '—'],
      ['Class',          `${resultData.className || ''} ${resultData.section ? '– ' + resultData.section : ''}`.trim() || '—'],
      ['Admission No.',  studentData.admissionNumber || '—'],
      ['Roll No.',       studentData.rollNumber || '—'],
      ['Academic Year',  resultData.academicYear || '—'],
      ['Attendance',     `${resultData.attendance || 0}%`],
    ];
    doc.rect(L, y, R - L, 70).fill('#f8fafc').stroke('#e2e8f0');
    infoFields.forEach((f, i) => {
      const col = i % 2 === 0 ? L + 10 : L + (R - L) / 2 + 10;
      const fy  = y + Math.floor(i / 2) * 24 + 6;
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(f[0].toUpperCase(), col, fy);
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(f[1], col, fy + 10);
    });
    y += 80;

    // Marks table
    const headers = ['Subject', 'Max', 'Theory', 'Practical', 'Total', 'Grade', 'Remarks'];
    const colX    = [L, L + 145, L + 200, L + 263, L + 326, L + 383, L + 428];
    const colW    = [140, 50, 58, 58, 52, 40, 87];
    const rowH    = 22;

    doc.rect(L, y, R - L, rowH).fill(primary);
    doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i] + 3, y + 6, { width: colW[i] - 4, align: i > 0 ? 'center' : 'left' }));
    y += rowH;

    (resultData.marks || []).forEach((m, i) => {
      if (i % 2 === 0) doc.rect(L, y, R - L, rowH).fill(light);
      const isAb = m.isAbsent;
      const fgColor = isAb ? '#ef4444' : '#1e293b';
      doc.fillColor(fgColor).fontSize(9).font(isAb ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(m.subjectName || '—', colX[0] + 3, y + 6, { width: colW[0] - 4 });
      doc.text(String(m.maxMarks || 0),                             colX[1] + 3, y + 6, { width: colW[1] - 4, align: 'center' });
      doc.text(isAb ? 'AB' : String(m.theoryMarks ?? '—'),           colX[2] + 3, y + 6, { width: colW[2] - 4, align: 'center' });
      doc.text(isAb ? 'AB' : String(m.practicalMarks ?? '—'),        colX[3] + 3, y + 6, { width: colW[3] - 4, align: 'center' });
      doc.fillColor(isAb ? '#ef4444' : (m.totalMarks >= m.maxMarks * 0.35 ? '#166534' : '#991b1b'))
        .font('Helvetica-Bold')
        .text(isAb ? 'AB' : String(m.totalMarks || 0),               colX[4] + 3, y + 6, { width: colW[4] - 4, align: 'center' });
      doc.fillColor(fgColor).font('Helvetica')
        .text(m.grade || '—',                                         colX[5] + 3, y + 6, { width: colW[5] - 4, align: 'center' })
        .text(m.remarks || '',                                         colX[6] + 3, y + 6, { width: colW[6] - 4 });
      y += rowH;
    });
    doc.rect(L, y - (resultData.marks || []).length * rowH - rowH, R - L, (resultData.marks || []).length * rowH + rowH).stroke('#e2e8f0');

    y += 8;
    // Summary stat boxes
    const pct    = resultData.percentage || 0;
    const passed = pct >= 35;
    const stats  = [
      { label: 'Total Marks',  val: `${resultData.totalMarksObtained || 0} / ${resultData.totalMaxMarks || 0}`, fg: primary,   bg: light },
      { label: 'Percentage',   val: `${pct.toFixed(1)}%`,                                                        fg: primary,   bg: light },
      { label: 'Grade',        val: resultData.grade || '—',                                                      fg: primary,   bg: light },
      { label: 'Rank',         val: resultData.rank ? `#${resultData.rank}` : '—',                                fg: primary,   bg: light },
      { label: 'Result',       val: passed ? 'PASS' : 'FAIL',  fg: passed ? '#166534' : '#991b1b', bg: passed ? '#dcfce7' : '#fee2e2' },
    ];
    const sW = (R - L) / stats.length;
    stats.forEach((s, i) => {
      const sx = L + i * sW;
      doc.rect(sx + (i>0?2:0), y, sW - (i>0?4:2), 42).fill(s.bg).stroke('#e2e8f0');
      doc.fillColor(s.fg).fontSize(14).font('Helvetica-Bold')
        .text(s.val, sx, y + 6, { width: sW, align: 'center' });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(s.label, sx, y + 26, { width: sW, align: 'center' });
    });
    y += 52;

    if (resultData.teacherRemarks) {
      doc.rect(L, y, R - L, 28).fill('#fffbeb').stroke('#fde68a');
      doc.fillColor('#92400e').fontSize(9).font('Helvetica-Bold').text('Teacher Remarks: ', L + 8, y + 9, { continued: true });
      doc.font('Helvetica').text(resultData.teacherRemarks, { width: R - L - 80 });
      y += 38;
    }

    // Signatures
    const sigY = doc.page.height - 80;
    doc.moveTo(L,     sigY).lineTo(L + 140,   sigY).stroke('#94a3b8');
    doc.moveTo(R - 140, sigY).lineTo(R, sigY).stroke('#94a3b8');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text("Class Teacher's Signature", L, sigY + 5, { width: 140, align: 'center' })
      .text("Principal's Signature", R - 140, sigY + 5, { width: 140, align: 'center' });

    drawFooter(doc, schoolData);
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

// ── Student Out Pass / Gate Pass ────────────────────────────────────────────────
const generateOutPass = (passData, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const cfg     = schoolData.pdfConfig || {};
    const primary = cfg.primaryColor    || '#1a56e8';
    const light   = lighten(primary);
    const W = doc.page.width, L = 50, R = W - 50;

    let y = drawHeader(doc, schoolData, 'STUDENT OUT PASS');

    // Pass meta row (pass no + issue date/time)
    doc.rect(L, y, R - L, 28).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold')
      .text(`Pass No: ${passData.passNumber || '—'}`, L + 10, y + 9);
    const exit = passData.exitDate ? new Date(passData.exitDate) : new Date();
    doc.font('Helvetica').fillColor('#64748b').fontSize(9)
      .text(`Exit: ${exit.toLocaleDateString('en-IN')}  ${exit.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, R - 220, y + 9, { width: 210, align: 'right' });
    y += 40;

    // Optional student photo (top-right) from a data URL
    let photoShown = false;
    if (passData.studentPhoto && /^data:image\//.test(passData.studentPhoto)) {
      try {
        const b64 = passData.studentPhoto.split(',')[1];
        const imgBuf = Buffer.from(b64, 'base64');
        doc.image(imgBuf, R - 90, y, { width: 80, height: 80, fit: [80, 80] });
        doc.rect(R - 90, y, 80, 80).stroke('#e2e8f0');
        photoShown = true;
      } catch (_) { /* ignore bad image */ }
    }

    const contentW = photoShown ? R - L - 100 : R - L;
    // Section: Student
    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold').text('STUDENT DETAILS', L, y);
    y += 18;
    const stuRows = [
      ['Name', passData.studentName || '—'],
      ['Admission No', passData.admissionNumber || '—'],
      ['Class', passData.className || '—'],
    ];
    stuRows.forEach(([k, v]) => {
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(k.toUpperCase(), L, y);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(v, L + 110, y - 1, { width: contentW - 110 });
      y += 20;
    });

    y = Math.max(y, photoShown ? (y) : y) + 6;
    doc.moveTo(L, y).lineTo(R, y).stroke('#e2e8f0');
    y += 14;

    // Section: Pickup person
    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold').text('COLLECTED BY', L, y);
    y += 18;
    const pickupRows = [
      ['Name', passData.pickupName || '—'],
      ['Relation', (passData.pickupRelation || '—')],
      ['Type', passData.pickupType === 'guardian' ? 'Guardian (not registered parent)' : 'Registered Parent'],
      ['Phone', passData.pickupPhone || '—'],
      ...(passData.pickupIdProof ? [['ID Proof No.', passData.pickupIdProof]] : []),
    ];
    pickupRows.forEach(([k, v]) => {
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(k.toUpperCase(), L, y);
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(String(v), L + 110, y - 1, { width: R - L - 110, textTransform: 'capitalize' });
      y += 19;
    });

    y += 4;
    doc.moveTo(L, y).lineTo(R, y).stroke('#e2e8f0');
    y += 14;

    // Section: Reason
    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold').text('REASON FOR LEAVING', L, y);
    y += 18;
    const reasonLabel = (passData.reason || 'early_leave').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    doc.rect(L, y, R - L, 44).fill(light).stroke('#e2e8f0');
    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold').text(reasonLabel, L + 12, y + 8);
    if (passData.reasonDetail) {
      doc.fillColor('#475569').fontSize(9).font('Helvetica').text(passData.reasonDetail, L + 12, y + 25, { width: R - L - 24 });
    }
    y += 56;

    if (passData.expectedReturn) {
      const er = new Date(passData.expectedReturn);
      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text(`Expected return: ${er.toLocaleDateString('en-IN')} ${er.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, L, y);
      y += 16;
    }

    // Security note
    doc.rect(L, y, R - L, 30).fill('#fffbeb').stroke('#fde68a');
    doc.fillColor('#92400e').fontSize(8.5).font('Helvetica')
      .text('Security: Please verify the collecting person’s identity and phone number against this pass before allowing the student to exit.', L + 10, y + 8, { width: R - L - 20 });

    drawFooter(doc, schoolData);
    doc.end();
  });
};

// ── Promotion Certificate ─────────────────────────────────────────────────────
const generatePromotionCard = (data, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const cfg     = schoolData.pdfConfig || {};
    const primary = cfg.primaryColor    || '#1a56e8';
    const light   = lighten(primary);
    const W = doc.page.width, L = 50, R = W - 50;

    // Outer decorative border
    doc.rect(20, 20, W - 40, doc.page.height - 40).lineWidth(3).stroke(primary);
    doc.rect(26, 26, W - 52, doc.page.height - 52).lineWidth(1).stroke(lighten(primary, 0.6));

    let y = drawHeader(doc, schoolData, 'PROMOTION CERTIFICATE');

    y += 24;

    // "This is to certify that"
    doc.fillColor('#64748b').fontSize(12).font('Helvetica')
      .text('This is to certify that', L, y, { width: R - L, align: 'center' });
    y += 26;

    // Student name — large
    doc.fillColor(primary).fontSize(30).font('Helvetica-Bold')
      .text(data.studentName || '—', L, y, { width: R - L, align: 'center' });
    y += 46;

    // Admission number
    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      .text(`Admission No: ${data.admissionNumber || '—'}`, L, y, { width: R - L, align: 'center' });
    y += 28;

    // Underline
    const lineW = 200;
    doc.moveTo((W - lineW) / 2, y).lineTo((W + lineW) / 2, y).lineWidth(1.5).stroke(lighten(primary, 0.5));
    y += 22;

    // Promotion description
    doc.fillColor('#374151').fontSize(12).font('Helvetica')
      .text('has been successfully promoted from', L, y, { width: R - L, align: 'center' });
    y += 30;

    // FROM → TO boxes
    const boxW = (R - L - 44) / 2;

    // FROM box
    doc.rect(L, y, boxW, 68).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('FROM', L, y + 8, { width: boxW, align: 'center' });
    doc.fillColor('#1e293b').fontSize(18).font('Helvetica-Bold')
      .text(`${data.fromClassName}${data.fromSection ? ' ' + data.fromSection : ''}`, L, y + 24, { width: boxW, align: 'center' });
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text(data.fromAcademicYear || '—', L, y + 50, { width: boxW, align: 'center' });

    // Arrow
    const arrowCX = L + boxW + 22;
    doc.fillColor(primary).fontSize(22).font('Helvetica-Bold')
      .text('→', arrowCX, y + 24, { width: 22, align: 'center' });

    // TO box
    const toX = L + boxW + 44;
    doc.rect(toX, y, boxW, 68).fill(primary).stroke(primary);
    doc.fillColor('rgba(255,255,255,0.75)').fontSize(9).font('Helvetica').text('PROMOTED TO', toX, y + 8, { width: boxW, align: 'center' });
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      .text(`${data.toClassName}${data.toSection ? ' ' + data.toSection : ''}`, toX, y + 24, { width: boxW, align: 'center' });
    doc.fillColor('rgba(255,255,255,0.8)').fontSize(9).font('Helvetica')
      .text(data.toAcademicYear || '—', toX, y + 50, { width: boxW, align: 'center' });

    y += 88;

    if (data.isDoublePromotion) {
      doc.rect(L, y, R - L, 26).fill('#fff7ed').stroke('#fed7aa');
      doc.fillColor('#9a3412').fontSize(10).font('Helvetica-Bold')
        .text('⚡ Double Promotion', L, y + 8, { width: R - L, align: 'center' });
      y += 36;
    }

    // Date
    const promotedDate = data.promotedAt
      ? new Date(data.promotedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.fillColor('#64748b').fontSize(10).font('Helvetica')
      .text(`Date of Promotion: ${promotedDate}`, L, y, { width: R - L, align: 'center' });
    y += 32;

    // Congratulations banner
    doc.rect(L, y, R - L, 38).fill(light);
    doc.fillColor(primary).fontSize(12).font('Helvetica-Bold')
      .text('Congratulations! Wishing you continued success in your academic journey.', L, y + 13, { width: R - L, align: 'center' });

    drawFooter(doc, schoolData);
    doc.end();
  });
};

const generateTransferCertificate = (data, schoolData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const cfg     = schoolData.pdfConfig || {};
    const primary = cfg.primaryColor    || '#1a56e8';
    const light   = lighten(primary);
    const W = doc.page.width, L = 50, R = W - 50;

    // Decorative double border
    doc.rect(12, 12, W - 24, doc.page.height - 24).lineWidth(3).stroke(primary);
    doc.rect(18, 18, W - 36, doc.page.height - 36).lineWidth(1).stroke(lighten(primary, 0.6));

    let y = drawHeader(doc, schoolData, 'TRANSFER CERTIFICATE');

    // TC Number strip
    doc.rect(L, y, R - L, 24).fill(light);
    doc.fillColor(primary).fontSize(10).font('Helvetica-Bold')
      .text(`TC No: ${data.tcNumber}`, L, y + 7, { width: R - L, align: 'center' });
    y += 36;

    // Student name (large)
    doc.fillColor('#1e293b').fontSize(24).font('Helvetica-Bold')
      .text(data.studentName, L, y, { width: R - L, align: 'center' });
    y += 42;

    doc.fillColor('#374151').fontSize(11).font('Helvetica')
      .text('has hereby been granted a Transfer Certificate from this institution.', L, y, { width: R - L, align: 'center' });
    y += 40;

    // Info grid
    const fields = [
      ['Admission Number',  data.admissionNumber || '—'],
      ['Date of Admission', data.admissionDate ? new Date(data.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
      ['Class at Transfer', `${data.classAtTransfer || '—'}${data.sectionAtTransfer ? ' — ' + data.sectionAtTransfer : ''}`],
      ['Academic Year',     data.academicYearAtTransfer || '—'],
      ['Date of Birth',     data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
      ['Date of Transfer',  data.transferredAt ? new Date(data.transferredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
    ];

    const rowH = 30, colMid = L + (R - L) / 2;
    fields.forEach((f, i) => {
      const fy = y + i * rowH;
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(L, fy, R - L, rowH).fill(bg);
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica')
        .text(f[0].toUpperCase(), L + 12, fy + 6);
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
        .text(f[1], L + 12, fy + 16);
      // right column: separator
      doc.moveTo(colMid, fy).lineTo(colMid, fy + rowH).stroke('#e5e7eb');
    });
    doc.rect(L, y, R - L, fields.length * rowH).stroke('#e2e8f0');
    y += fields.length * rowH + 16;

    if (data.reason) {
      doc.rect(L, y, R - L, 32).fill('#fffbeb').stroke('#fde68a');
      doc.fillColor('#92400e').fontSize(9).font('Helvetica-Bold').text('Reason for Transfer: ', L + 10, y + 8, { continued: true });
      doc.font('Helvetica').text(data.reason);
      y += 44;
    }

    // Conduct/Character note
    doc.rect(L, y, R - L, 36).fill(light);
    doc.fillColor(primary).fontSize(10).font('Helvetica-Bold')
      .text('This is to certify that the above student has been a student of this institution and', L, y + 6, { width: R - L, align: 'center' });
    doc.fillColor(primary).fontSize(10).font('Helvetica-Bold')
      .text('has maintained good conduct and character during the period of study.', L, y + 20, { width: R - L, align: 'center' });
    y += 52;

    // Signature area
    const sigY = Math.max(y + 30, doc.page.height - 130);
    doc.moveTo(L, sigY).lineTo(L + 140, sigY).stroke('#94a3b8');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text("Class Teacher's Signature", L, sigY + 5, { width: 140, align: 'center' });
    doc.moveTo(R - 160, sigY).lineTo(R, sigY).stroke('#94a3b8');
    doc.text("Principal's Signature & Seal", R - 160, sigY + 5, { width: 160, align: 'center' });

    drawFooter(doc, schoolData);
    doc.end();
  });
};

module.exports = { generateFeeReceipt, generatePaySlip, generateAdmissionLetter, generateJobOffer, generateResultCard, generateHallTicket, generateFeesReport, generateExpensesReport, generateOutPass, generatePromotionCard, generateTransferCertificate };
