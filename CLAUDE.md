# School Management SaaS — Project Memory

This file is a complete project summary for Claude Code to use as memory context.

---

## Project Overview

A **multi-tenant School Management SaaS** built with the MERN stack, targeted at Indian schools. Schools self-register and get a 15-day free trial, then pay ₹200/month via Razorpay. SMS notifications are sent in English or Tamil based on user preference.

**Local path:** `/Users/sudhar-16381/Downloads/school-mgmt`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, MongoDB, Mongoose |
| Frontend | React 18, Vite, TanStack Query v5, React Router v6 |
| Auth | JWT (7 day expiry), bcryptjs |
| SMS | Twilio (placeholder keys, EN + Tamil templates) |
| Payments | Razorpay (test keys) — fees + ₹200/month subscription |
| PDF | PDFKit |
| QR Code | qrcode.react |
| Charts | Recharts |
| Forms | react-hook-form + useFieldArray |
| Print | react-to-print |
| i18n | i18next + react-i18next (EN + Tamil) |
| Icons | lucide-react |
| Toast | react-hot-toast |
| Font | **Inter** (Google Fonts) — replaced original Syne + DM Sans |

---

## Roles & Access

| Role | Access Summary |
|------|----------------|
| `super_admin` | Platform-level: manage all schools, extend trials, activate subscriptions |
| `admin` | Full school access |
| `correspondent` | Full school access (same as admin) |
| `principal` | Staff, students, attendance, timetable, exams, salary view |
| `teacher` | Own subjects/classes, mark attendance, enter exam marks, view timetable, own salary |
| `accountant` | Fees, salary, expenses, student view |
| `student` | Own attendance, timetable, exam results, fees |
| `parent` | Children's attendance, fees, exam results, timetable |
| `maintenance` | **Only view and update assigned tasks** (no other access) |

---

## Multi-tenancy & School Code

- School code = first 3 letters of school name (uppercase) + last 5 digits of `Date.now()`
  - Example: "Sri Vidya Mandir" → `SRI88299`
- Each user belongs to a school via `school: ObjectId` ref on the User model
- Email uniqueness is per school: `{ email: 1, school: 1 }` compound unique index
- Subscription is stored on the School model: `trial` → `active` → `expired`

---

## Subscription Logic

- **Trial**: 15 days from registration date. Gated by `checkSubscription` middleware returning 402 with `TRIAL_EXPIRED` code.
- **Paid**: ₹200/month (2000 paise in Razorpay). Creates a Razorpay order, verifies payment signature with HMAC-SHA256.
- **Super admin** bypass: `checkSubscription` skips if `user.role === 'super_admin'`
- Trial banner shown in Header when ≤5 days left; red when expired.

---

## Project File Structure

```
school-mgmt/
├── backend/
│   ├── .env                          # All environment variables
│   ├── server.js                     # Express app entry point (port 5000)
│   ├── config/
│   │   └── db.js                     # Mongoose connect
│   ├── middleware/
│   │   └── auth.js                   # protect, authorize, checkSubscription
│   ├── models/
│   │   ├── School.js
│   │   ├── User.js
│   │   ├── Employee.js
│   │   ├── Student.js
│   │   ├── Parent.js
│   │   ├── Class.js
│   │   ├── Subject.js
│   │   ├── Attendance.js
│   │   ├── Timetable.js
│   │   ├── FeeCollection.js
│   │   ├── Salary.js
│   │   ├── Exam.js                   # exports { Exam, ExamResult }
│   │   ├── Expense.js                # exports { Expense, Transport }
│   │   └── SmsLog.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── schoolController.js
│   │   ├── employeeController.js
│   │   ├── studentController.js
│   │   ├── attendanceController.js
│   │   ├── feesController.js
│   │   ├── salaryController.js
│   │   ├── timetableController.js
│   │   └── examController.js
│   ├── routes/
│   │   └── index.js                  # All routes in one file
│   └── utils/
│       ├── sms.js                    # Twilio wrapper + EN/Tamil templates
│       ├── email.js                  # Nodemailer + invitation HTML template
│       └── pdf.js                    # PDFKit generators
│
└── frontend/
    ├── .env                          # VITE_API_URL=http://localhost:5000/api
    ├── vite.config.js                # Proxy /api → 5000, port 3000
    ├── index.html
    └── src/
        ├── main.jsx                  # ReactDOM root, QueryClient, Toaster, AuthProvider
        ├── App.jsx                   # All routes + ProtectedRoute + RoleRedirect
        ├── styles/
        │   └── global.css            # Full design system (CSS vars, Inter font, sidebar, cards, etc.)
        ├── store/
        │   └── AuthContext.jsx       # login, register, logout, updateUser
        ├── utils/
        │   └── api.js                # Axios instance with Bearer token interceptor
        ├── i18n/
        │   └── index.js              # EN + Tamil translations
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.jsx
        │   │   ├── Sidebar.jsx       # Role-based navConfig for all 9 roles
        │   │   └── Header.jsx        # Trial banner, notifications bell, language toggle, profile menu
        │   └── ui/
        │       └── index.jsx         # Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput,
        │                             # Avatar, Spinner, PageLoader, EmptyState, FormRow, InfoItem, StatCard
        └── pages/
            ├── auth/
            │   ├── Login.jsx         # Split panel, school login + super admin toggle
            │   ├── Register.jsx      # Self-registration with trial highlights
            │   └── SchoolSetup.jsx   # 4-step onboarding wizard
            ├── admin/
            │   ├── Dashboard.jsx     # Stats, Recharts bar charts, recent admissions
            │   ├── Students.jsx      # Full CRUD, multiple guardians (useFieldArray), promote modal
            │   ├── Employees.jsx     # Full CRUD, salary view, job offer PDF
            │   ├── ClassesSubjects.jsx # exports Classes and Subjects components
            │   ├── Attendance.jsx    # Per-period P/A/L/E grid, student + employee tabs
            │   ├── Fees.jsx          # Create records, collect payment, Razorpay, receipt PDF
            │   ├── Timetable.jsx     # Visual day×period grid, conflict detection
            │   ├── Salary.jsx        # Generate, pay with method+txId, payslip PDF
            │   ├── Exams.jsx         # Create exam, results modal, publish (SMS), result card PDF
            │   ├── Expenses.jsx      # Category tracking with monthly filter
            │   ├── IDCards.jsx       # Class selector → checkbox → QR card preview → react-to-print
            │   └── Settings.jsx      # School profile, grade config, subscription, password, profile
            ├── superadmin/
            │   └── Dashboard.jsx     # All schools table, extend trial, activate subscription
            └── portals/
                └── index.jsx         # TeacherDashboard, MySalary, MyTasks, StudentDashboard, ParentDashboard
```

---

## Backend Environment Variables (`.env`)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/schoolmgmt
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRE=7d

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=School Management <noreply@schoolmgmt.com>

CLIENT_URL=http://localhost:3000
TRIAL_DAYS=15
SUBSCRIPTION_AMOUNT=20000

SUPER_ADMIN_EMAIL=superadmin@schoolmgmt.com
SUPER_ADMIN_PASSWORD=SuperAdmin@123
```

---

## Key Business Logic

### School Code Generation
```js
const code = schoolName.substring(0, 3).toUpperCase() + Date.now().toString().slice(-5);
```

### ID Number Formats
- Admission Number: `ADM{schoolCode}{year}{4-digit-seq}` e.g. `ADMTES202400001`
- Employee ID: `EMP{schoolCode}{4-digit-seq}` e.g. `EMPTES0001`
- Salary Slip Number: `SAL{employeeId}{year}{month}` e.g. `SALEMPTES00012024Jun`

### Salary Auto-Calculation (LOP)
```
lopDays = workingDays - presentDays
lopAmount = (basic / workingDays) * lopDays
gross = basic + hra + da + otherAllowances
pf = basic * 0.12  (if not overridden)
esi = gross * 0.0075  (only if gross <= 21000)
net = gross - pf - esi - lop - otherDeductions
```

### Consecutive Absence SMS
- Checks last 3 days of attendance for the student
- If absent 3+ days consecutively → sends `consecutive_absent` SMS to all guardians

### Timetable Conflict Detection
- Before saving, loops all timetables for the same school + academic year
- If same teacher is already assigned to any other class at the same day + period → returns 400 with conflict message

### Fee Status Logic
```
pending  → paidAmount === 0
partial  → paidAmount > 0 && paidAmount < netAmount
paid     → paidAmount >= netAmount
overdue  → dueDate passed && pendingAmount > 0
```

---

## SMS Templates (EN + Tamil)

All templates are in `backend/utils/sms.js` under the `translations` object.

| Key | Trigger |
|-----|---------|
| `absent` | Student marked absent for a period |
| `consecutive_absent` | 3+ days absent |
| `fee_reminder` | Manual bulk reminder from Fees page |
| `fee_paid` | Payment collected |
| `exam_schedule` | (available, not auto-triggered yet) |
| `result_published` | Admin clicks "Publish Results" |
| `invitation` | New employee or parent account created |
| `timetable` | Timetable saved for a class |
| `salary_paid` | Salary marked as paid |

SMS language is determined by `guardian.language` or `school.language` as fallback.

---

## PDF Templates

All in `backend/utils/pdf.js`. Customizable `{{placeholder}}` syntax for letters.

| Generator | Triggered by |
|-----------|-------------|
| `generateFeeReceipt` | `GET /fees/:id/receipt` |
| `generatePaySlip` | `GET /salaries/:id/payslip` |
| `generateAdmissionLetter` | `POST /students/:id/admission-letter-pdf` |
| `generateJobOffer` | `POST /employees/:id/job-offer-pdf` |
| `generateResultCard` | `GET /exams/results/:id/pdf` |
| Blank award list | `GET /exams/award-list` (inline in examController) |

Default templates are hardcoded strings in `employeeController.js` and `studentController.js`. Admins can pass a custom `template` string in the request body.

---

## API Route Summary

All routes are prefixed with `/api` and defined in `backend/routes/index.js`.

```
POST   /auth/register              → registerSchool (public)
POST   /auth/login                 → login (public)
POST   /auth/init-super-admin      → one-time super admin creation
GET    /auth/me                    → get current user
PUT    /auth/change-password
PUT    /auth/profile
PUT    /auth/notifications/:id/read

GET/PUT /school                    → get/update school profile
POST   /school/setup               → complete onboarding
GET    /school/dashboard           → dashboard stats
POST   /school/upload-logo
PUT    /school/grade-config
POST   /subscription/create-order  → Razorpay order
POST   /subscription/verify        → verify + activate

GET/POST        /employees
GET/PUT/DELETE  /employees/:id
POST            /employees/:id/job-offer-pdf
POST/PUT        /employees/:id/tasks/:taskId

GET/POST        /students
GET/PUT/DELETE  /students/:id
POST            /students/promote
POST            /students/:id/admission-letter-pdf
POST            /students/id-card-data

GET  /parents

GET/POST/PUT/DELETE  /classes
GET/POST/PUT/DELETE  /subjects

POST /attendance/student
POST /attendance/employee
GET  /attendance
GET  /attendance/summary

GET/POST        /fees
POST            /fees/collect
POST            /fees/razorpay-order
POST            /fees/razorpay-verify
GET             /fees/:id/receipt
POST            /fees/send-reminder

GET             /salaries
POST            /salaries/generate
PUT             /salaries/:id
POST            /salaries/:id/pay
GET             /salaries/:id/payslip

GET/POST        /timetable
GET             /timetable/free-slots
DELETE          /timetable/period

GET/POST/PUT    /exams
POST            /exams/marks
POST            /exams/:examId/publish
GET             /exams/results
GET             /exams/results/:id/pdf
GET             /exams/award-list

GET/POST/PUT/DELETE  /expenses
GET/POST             /transport
GET/POST             /sms/logs
POST                 /sms/send

GET  /super-admin/schools
GET  /super-admin/stats
PUT  /super-admin/schools/:id/subscription

GET  /users
PUT  /users/:id/toggle-status
```

---

## Frontend Design System

- **Font**: Inter (Google Fonts), all weights 300–900
- **CSS variables**: defined in `src/styles/global.css` under `:root`
- **Sidebar width**: 260px, fixed position, dark (`#0f172a`)
- **Header height**: 64px, sticky
- **Card style**: white bg, 16px border-radius, 1px border `#e2e8f0`
- **Primary color**: `#1a56e8`
- **Number rendering**: `fontVariantNumeric: 'tabular-nums'`, `letterSpacing: '-0.5px'` to prevent squished digits

Key CSS classes: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`, `.btn-sm`, `.btn-lg`, `.btn-icon`, `.form-control`, `.form-label`, `.form-group`, `.card`, `.stat-card`, `.badge`, `.badge-success/danger/warning/info/secondary`, `.table-container`, `.modal`, `.modal-overlay`, `.tabs`, `.tab`, `.page-header`, `.page-title`, `.filter-bar`, `.sidebar`, `.sidebar-link`, `.header`, `.grid-2/3/4`

---

## Known Pending / Not Yet Built

- Transport module UI (backend model exists, frontend shows placeholder)
- Full student/parent portal pages (attendance detail, timetable view, exam results, fees view — currently shows generic dashboard)
- Teacher attendance marking for own subjects (exists in backend, frontend uses same Attendance page)
- Vercel deployment config
- Code splitting (bundle is ~971KB, needs dynamic imports)
- SMS send from UI (logs page exists but no compose UI)

---

## How to Run Locally

```bash
# Terminal 1 — Backend
cd school-mgmt/backend
npm install
npm run dev         # nodemon server.js → port 5000

# One-time: create super admin
curl -X POST http://localhost:5000/api/auth/init-super-admin

# Terminal 2 — Frontend
cd school-mgmt/frontend
npm install
npm run dev         # Vite → port 3000
```

**Super Admin login:** `superadmin@schoolmgmt.com` / `SuperAdmin@123`
**School registration:** `http://localhost:3000/register`

---

## Recent Fix (May 2026)

- **Font changed** from Syne + DM Sans → **Inter** throughout
- StatCard numbers now use `fontVariantNumeric: 'tabular-nums'` to fix squished/stretched digit rendering
- Files changed: `global.css` (line 1 import + CSS variables), `components/ui/index.jsx` (StatCard), all page files (inline style fontFamily refs)
