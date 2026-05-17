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
    feeData.breakdown.forEach((item, i) => {
      if (i % 2 === 0) doc.fillColor('#f9f9f9').rect(50, rowY - 5, 495, 22).fill();
      doc.fillColor('#333').text(item.type, 60, rowY);
      doc.text(item.amount.toFixed(2), 450, rowY);
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
    doc.text(`Rs. ${feeData.netAmount.toFixed(2)}`, 440, rowY + 10);
    
    doc.fillColor('#27ae60').font('Helvetica-Bold').text('Amount Paid', 60, rowY + 30);
    doc.text(`Rs. ${feeData.paidAmount.toFixed(2)}`, 440, rowY + 30);

    if (feeData.pendingAmount > 0) {
      doc.fillColor('#e74c3c').font('Helvetica-Bold').text('Pending Amount', 60, rowY + 50);
      doc.text(`Rs. ${feeData.pendingAmount.toFixed(2)}`, 440, rowY + 50);
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

module.exports = { generateFeeReceipt, generatePaySlip, generateAdmissionLetter, generateJobOffer, generateResultCard };
