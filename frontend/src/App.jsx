import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
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
import IDCards from './pages/admin/IDCards';
import Settings from './pages/admin/Settings';
import SMS from './pages/admin/SMS';
import Parents from './pages/admin/Parents';
import { SuperAdminDashboard } from './pages/superadmin/Dashboard';
import { TeacherDashboard, MySalary, MyTasks, StudentDashboard, ParentDashboard } from './pages/portals/index';


function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />;
  if (user.role === 'maintenance') return <Navigate to="/my-tasks" replace />;
  return <Navigate to="/dashboard" replace />;
}

const ADMIN = ['admin', 'correspondent', 'principal', 'accountant'];
const ALL = ['admin', 'correspondent', 'principal', 'teacher', 'accountant', 'student', 'parent', 'maintenance'];

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <RoleRedirect />} />
      <Route path="/register" element={!user ? <Register /> : <RoleRedirect />} />
      <Route path="/school-setup" element={user ? <AppLayout><SchoolSetup /></AppLayout> : <Navigate to="/login" />} />
      <Route path="/" element={<RoleRedirect />} />

      <Route path="/super-admin" element={<ProtectedRoute roles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
      <Route path="/super-admin/schools" element={<ProtectedRoute roles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />

      <Route path="/dashboard" element={
        <ProtectedRoute roles={ALL}>
          {user?.role === 'teacher' ? <TeacherDashboard /> : user?.role === 'student' ? <StudentDashboard /> : user?.role === 'parent' ? <ParentDashboard /> : <Dashboard />}
        </ProtectedRoute>
      } />

      <Route path="/students" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Students /></ProtectedRoute>} />
      <Route path="/parents" element={<ProtectedRoute roles={['admin','correspondent','principal']}><Parents /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute roles={ADMIN}><Employees /></ProtectedRoute>} />
      <Route path="/classes" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Classes /></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Subjects /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Attendance /></ProtectedRoute>} />
      <Route path="/fees" element={<ProtectedRoute roles={ADMIN}><Fees /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Timetable /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Calendar /></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute roles={ADMIN}><Salary /></ProtectedRoute>} />
      <Route path="/exams" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Exams /></ProtectedRoute>} />
      <Route path="/exams/:id" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><ExamDetail /></ProtectedRoute>} />
      <Route path="/homework" element={<ProtectedRoute roles={[...ADMIN, 'teacher']}><Homework /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute roles={ADMIN}><Expenses /></ProtectedRoute>} />
      <Route path="/transport" element={<ProtectedRoute roles={ADMIN}><Transport /></ProtectedRoute>} />
      <Route path="/id-cards" element={<ProtectedRoute roles={ADMIN}><IDCards /></ProtectedRoute>} />
      <Route path="/sms" element={<ProtectedRoute roles={['admin','correspondent','principal']}><SMS /></ProtectedRoute>} />
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
