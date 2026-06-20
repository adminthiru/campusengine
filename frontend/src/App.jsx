import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import StaffLogin from './pages/auth/StaffLogin';
import SchoolSetup from './pages/auth/SchoolSetup';
import Dashboard from './pages/admin/Dashboard';
import Students from './pages/admin/Students';
import Employees from './pages/admin/Employees';
import { Classes, Subjects } from './pages/admin/ClassesSubjects';
import Attendance from './pages/admin/Attendance';
import Fees from './pages/admin/Fees';
import Timetable from './pages/admin/Timetable';
import Calendar from './pages/admin/Calendar';
import Salary from './pages/admin/Salary';
import Exams from './pages/admin/Exams';
import ExamDetail from './pages/admin/ExamDetail';
import Expenses from './pages/admin/Expenses';
import Homework from './pages/admin/Homework';
import Transport from './pages/admin/Transport';
import Settings from './pages/admin/Settings';
import SMS from './pages/admin/SMS';
import Parents from './pages/admin/Parents';
import { TeacherDashboard, MySalary, MyTasks, StudentDashboard, ParentDashboard } from './pages/portals/index';
import Library from './pages/admin/Library';
import Visits from './pages/admin/Visits';
import OutPass from './pages/admin/OutPass';
import Inventory from './pages/admin/Inventory';
import { MODULES } from './config/modules';
import UpgradeRequired from './components/UpgradeRequired';
import Landing from './pages/marketing/Landing';

// Delegated (custom) staff are gated by their module-view permission instead of
// the role lists. Their landing page is the first module they can view.
const isCustomUser = (user) => !!user && (user.accessType === 'custom' || user.role === 'staff');
const firstAllowedPath = (user) => {
  const m = MODULES.find(mm => user?.permissions?.[mm.key]?.view);
  return m ? m.path : '/settings/profile';
};

// Whether the school's plan unlocks this module. Empty/absent list = all unlocked
// (legacy schools / trials), mirroring the backend gate in middleware/auth.js.
const planAllowsModule = (user, module) => {
  if (!module || user?.role === 'super_admin') return true;
  const planModules = user?.subscription?.modules || [];
  return !planModules.length || planModules.includes(module);
};

function ProtectedRoute({ children, roles, module }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Plan entitlement: a module not in the school's plan shows an upgrade screen
  // (kept inside the layout) instead of the page.
  if (module && !planAllowsModule(user, module)) {
    return <AppLayout><UpgradeRequired module={module} /></AppLayout>;
  }
  if (isCustomUser(user)) {
    if (module && !user.permissions?.[module]?.view) return <Navigate to={firstAllowedPath(user)} replace />;
    return <AppLayout>{children}</AppLayout>;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'maintenance') return <Navigate to="/my-tasks" replace />;
  if (isCustomUser(user)) return <Navigate to={firstAllowedPath(user)} replace />;
  return <Navigate to="/dashboard" replace />;
}

const ADMIN = ['admin', 'correspondent', 'principal', 'accountant'];
const ALL = ['admin', 'correspondent', 'principal', 'teacher', 'accountant', 'student', 'parent', 'maintenance'];

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <RoleRedirect />} />
      {/* Public self-service signup — same screen as login, opened in signup mode */}
      <Route path="/register" element={!user ? <Login initialMode="signup" /> : <RoleRedirect />} />
      {/* Dedicated staff login link — always shows the form, even if a session exists */}
      <Route path="/staff-login" element={<StaffLogin />} />
      <Route path="/school-setup" element={user ? <AppLayout><SchoolSetup /></AppLayout> : <Navigate to="/login" />} />
      {/* Public marketing site — the product's front door. Authenticated users
          are sent straight to their role dashboard. */}
      <Route path="/" element={user ? <RoleRedirect /> : <Landing />} />

      <Route path="/dashboard" element={
        <ProtectedRoute roles={ALL}>
          {user?.role === 'teacher' ? <TeacherDashboard /> : user?.role === 'student' ? <StudentDashboard /> : user?.role === 'parent' ? <ParentDashboard /> : <Dashboard />}
        </ProtectedRoute>
      } />

      <Route path="/students" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="students"><Students /></ProtectedRoute>} />
      <Route path="/parents" element={<ProtectedRoute roles={['admin','correspondent','principal']} module="parents"><Parents /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute roles={ADMIN} module="employees"><Employees /></ProtectedRoute>} />
      <Route path="/classes" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="classes"><Classes /></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="subjects"><Subjects /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="attendance"><Attendance /></ProtectedRoute>} />
      <Route path="/staff-tracking" element={<Navigate to="/attendance" replace />} />
      <Route path="/fees" element={<ProtectedRoute roles={ADMIN} module="fees"><Fees /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="timetable"><Timetable /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="calendar"><Calendar /></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute roles={ADMIN} module="salary"><Salary /></ProtectedRoute>} />
      <Route path="/exams" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="exams"><Exams /></ProtectedRoute>} />
      <Route path="/exams/:id" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="exams"><ExamDetail /></ProtectedRoute>} />
      <Route path="/homework" element={<ProtectedRoute roles={[...ADMIN, 'teacher']} module="homework"><Homework /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute roles={ADMIN} module="expenses"><Expenses /></ProtectedRoute>} />
      <Route path="/library" element={<ProtectedRoute roles={['admin','correspondent','principal']} module="library"><Library /></ProtectedRoute>} />
      <Route path="/visits" element={<ProtectedRoute roles={['admin','correspondent','principal']} module="visits"><Visits /></ProtectedRoute>} />
      <Route path="/outpass" element={<ProtectedRoute roles={['admin','correspondent','principal']} module="outpass"><OutPass /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute roles={['admin','correspondent','principal']} module="inventory"><Inventory /></ProtectedRoute>} />
      <Route path="/transport" element={<ProtectedRoute roles={ADMIN} module="transport"><Transport /></ProtectedRoute>} />
      <Route path="/sms" element={<ProtectedRoute roles={['admin','correspondent','principal']} module="sms"><SMS /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute roles={ALL}><Settings /></ProtectedRoute>} />
      <Route path="/settings/:tab" element={<ProtectedRoute roles={ALL}><Settings /></ProtectedRoute>} />

      <Route path="/my-classes" element={<ProtectedRoute roles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/my-salary" element={<ProtectedRoute roles={['teacher']}><MySalary /></ProtectedRoute>} />
      <Route path="/my-tasks" element={<ProtectedRoute roles={['maintenance']}><MyTasks /></ProtectedRoute>} />
      <Route path="/my-attendance" element={<ProtectedRoute roles={['student','parent']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/my-timetable" element={<ProtectedRoute roles={['student','parent']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/my-exams" element={<ProtectedRoute roles={['student','parent']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/my-fees" element={<ProtectedRoute roles={['student','parent']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/my-children" element={<ProtectedRoute roles={['parent']}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent-portal" element={<ProtectedRoute roles={['parent']}><ParentDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
