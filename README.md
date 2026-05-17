# School Management SaaS — MERN Stack

A complete multi-tenant school management system built for Indian schools.

## Tech Stack
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Frontend**: React 18, Vite, TanStack Query, Recharts
- **SMS**: Twilio (EN + Tamil templates)
- **Payments**: Razorpay (fees + subscription)
- **PDFs**: PDFKit (receipts, payslips, letters, result cards)
- **Auth**: JWT with role-based access control

## Roles
| Role | Access |
|------|--------|
| super_admin | Full platform access, manage all schools |
| admin | Full school access |
| correspondent | Full school access (same as admin) |
| principal | Staff, students, attendance, exams, salary view |
| teacher | Own classes, attendance, exams, timetable |
| accountant | Fees, salary, expenses |
| student | Own attendance, timetable, exams, fees |
| parent | Children's data — attendance, fees, exams |
| maintenance | Only view/update assigned tasks |

## Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Twilio account (for SMS)
- Razorpay account (for payments)

### Backend
```bash
cd backend
cp .env.example .env       # Edit with your keys
npm install
npm run dev                # Starts on port 5000
```

On first run, initialize super admin:
```bash
curl -X POST http://localhost:5000/api/auth/init-super-admin
```
Super admin login: `superadmin@schoolmgmt.com` / `SuperAdmin@123`

### Frontend
```bash
cd frontend
npm install
cp .env.example .env       # Set VITE_API_URL=http://localhost:5000/api
npm run dev                # Starts on port 3000
```

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/schoolmgmt
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+1234567890

RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=app_password

CLIENT_URL=http://localhost:3000
TRIAL_DAYS=15
SUPER_ADMIN_EMAIL=superadmin@schoolmgmt.com
SUPER_ADMIN_PASSWORD=SuperAdmin@123
```

## Features

### Multi-tenancy
- Each school gets a unique code (first 3 letters + 5-digit timestamp)
- 15-day free trial, then ₹200/month via Razorpay
- Trial expiry banner with subscribe button

### SMS (Twilio)
Templates in English + Tamil for:
- Absent (per period)
- Consecutive absence alert (3+ days)
- Fee reminder
- Fee payment confirmation
- Exam schedule
- Result published
- Salary paid
- Portal invitation (with login credentials)

### PDF Generation
- Fee receipts
- Salary payslips
- Admission letters (customizable template)
- Job offer letters (customizable template)
- Result cards
- Blank award lists

### ID Cards
- Name, photo, class, DOB, blood group, address
- Parent name + emergency contact
- School logo
- QR code (links to admission number)
- Printable via react-to-print

### Timetable
- Visual day × period grid
- Conflict detection (teacher double-booking)
- Break support (lunch, etc.)
- SMS notification on update

### Attendance
- Per-period student attendance (P/A/L/E)
- Daily employee attendance
- Auto SMS on absence
- Consecutive absence alert (3+ days)

### Fees
- Flexible breakdown (tuition, transport, etc.)
- Discount with reason
- Installment plans
- Cash/Bank/Cheque/Online (Razorpay)
- PDF receipts + bulk SMS reminders

### Salary
- Auto-calculate from attendance (LOP)
- Basic + HRA + DA + allowances
- PF + ESI + deductions
- Pay with transaction ID
- PDF payslips + SMS notification

### Exams
- Multiple exam types
- Per-subject marks entry
- Auto grade + rank calculation
- Publish results (SMS to all parents)
- PDF result cards
- Blank award lists for offline entry

### Multiple Guardians
- Father + Mother + Guardian (unlimited)
- Per-guardian SMS language preference
- Primary guardian designation
- Auto-create parent portal accounts on student add

## Project Structure
```
school-mgmt/
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/auth.js
│   ├── models/
│   ├── routes/index.js
│   ├── utils/  (sms.js, email.js, pdf.js)
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── layout/  (Sidebar, Header, AppLayout)
    │   │   └── ui/      (Modal, Badge, Table, etc.)
    │   ├── pages/
    │   │   ├── admin/   (all admin pages)
    │   │   ├── auth/    (Login, Register, SchoolSetup)
    │   │   ├── portals/ (Teacher, Student, Parent, Maintenance)
    │   │   └── superadmin/
    │   ├── store/AuthContext.jsx
    │   ├── utils/api.js
    │   ├── i18n/index.js
    │   ├── App.jsx
    │   └── main.jsx
    └── vite.config.js
```
