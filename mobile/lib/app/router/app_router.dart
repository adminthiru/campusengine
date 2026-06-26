// ── GoRouter — App Navigation with auth guard ─────────────────────────────────

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:skl_teacher/features/exams/presentation/providers/exams_provider.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/attendance/presentation/screens/attendance_screen.dart';
import '../../features/students/presentation/screens/students_screen.dart';
import '../../features/homework/presentation/screens/homework_screen.dart';
import '../../features/timetable/presentation/screens/timetable_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/more/presentation/screens/more_screen.dart';
import '../../features/leave/presentation/screens/leave_screen.dart';
import '../../features/library/presentation/screens/library_screen.dart';
import '../../features/exams/presentation/screens/exams_screen.dart';
import '../../features/calendar/presentation/screens/calendar_screen.dart';
// Teacher dynamic module screens
import '../../features/teacher/presentation/providers/teacher_provider.dart';
import '../../features/teacher/presentation/screens/teacher_subjects_screen.dart';
import '../../features/teacher/presentation/screens/teacher_subject_students_screen.dart';
import '../../features/teacher/presentation/screens/teacher_subject_exams_screen.dart';
import 'package:provider/provider.dart';
// Student portal screens
import '../../features/student/presentation/screens/student_dashboard_screen.dart';
import '../../features/student/presentation/screens/student_homework_screen.dart';
import '../../features/student/presentation/screens/student_exams_screen.dart';
import '../../features/student/presentation/screens/student_attendance_screen.dart';
import '../../features/student/presentation/screens/student_more_screen.dart';
import '../../features/student/presentation/screens/student_leave_screen.dart';
import '../../features/student/presentation/screens/student_fees_screen.dart';
import '../../features/student/presentation/screens/student_timetable_screen.dart';
// Parent portal screens
import '../../features/parent/presentation/screens/parent_dashboard_screen.dart';
import '../../features/parent/presentation/screens/parent_children_screen.dart';
import '../../features/parent/presentation/screens/parent_leave_screen.dart';
import '../../features/parent/presentation/screens/parent_profile_screen.dart';
import '../screens/app_shell.dart';

class AppRouter {
  static final _rootNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'root');
  static final _shellNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'shell');

  static GoRouter? _instance;

  // Tab switches inside the shell should feel instant — no slide/"new page"
  // transition. Wrap every shell route's child in a NoTransitionPage.
  static Page<void> _flat(Widget child) => NoTransitionPage(child: child);

  static GoRouter createRouter(AuthProvider authProvider) {
    _instance ??= GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/splash',
      refreshListenable: authProvider,
      redirect: (context, state) {
        final isAuth = authProvider.isAuthenticated;
        final isSplash = state.uri.path == '/splash';
        final isAuthPath = state.uri.path.startsWith('/auth');

        if (isSplash) return null;
        if (!isAuth && !isAuthPath) return '/auth/login';
        if (isAuth && isAuthPath) {
          final role = authProvider.role;
          if (role == 'student') return '/student/dashboard';
          if (role == 'parent') return '/parent/dashboard';
          return '/dashboard';
        }
        return null;
      },
      routes: [
        // ── Splash ────────────────────────────────────────────────────────
        GoRoute(
          path: '/splash',
          builder: (_, __) => const SplashScreen(),
        ),

        // ── Auth ──────────────────────────────────────────────────────────
        GoRoute(
          path: '/auth/login',
          builder: (_, __) => const LoginScreen(),
        ),

        // ── Main Shell (bottom nav) ───────────────────────────────────────
        ShellRoute(
          navigatorKey: _shellNavigatorKey,
          builder: (context, state, child) => AppShell(child: child),
          routes: [
            // Teacher routes (unchanged)
            GoRoute(
                path: '/dashboard',
                pageBuilder: (_, __) => _flat(const DashboardScreen())),
            GoRoute(
                path: '/attendance',
                pageBuilder: (_, __) => _flat(const AttendanceScreen())),
            GoRoute(
                path: '/homework',
                pageBuilder: (_, __) => _flat(const HomeworkScreen())),
            GoRoute(
                path: '/timetable',
                pageBuilder: (_, __) => _flat(const TimetableScreen())),
            GoRoute(
              path: '/students',
              pageBuilder: (_, state) {
                final extra = state.extra as Map<String, String>?;
                return _flat(StudentsScreen(
                  classId: extra?['classId'],
                  className: extra?['className'],
                ));
              },
            ),
            GoRoute(
                path: '/profile',
                pageBuilder: (_, __) => _flat(const ProfileScreen())),
            GoRoute(
                path: '/more', pageBuilder: (_, __) => _flat(const MoreScreen())),
            GoRoute(
                path: '/notifications',
                pageBuilder: (_, __) => _flat(const NotificationsScreen())),
            // Role-specific aliases (the app shell routes parents/students here).
            GoRoute(
                path: '/parent/notifications',
                pageBuilder: (_, __) => _flat(const NotificationsScreen())),
            GoRoute(
                path: '/student/notifications',
                pageBuilder: (_, __) => _flat(const NotificationsScreen())),
            GoRoute(
                path: '/settings',
                pageBuilder: (_, __) => _flat(const SettingsScreen())),
            GoRoute(
                path: '/leave',
                pageBuilder: (_, __) => _flat(const LeaveScreen())),
            GoRoute(
                path: '/library',
                pageBuilder: (_, __) => _flat(const LibraryScreen())),
            GoRoute(
                path: '/exams',
                pageBuilder: (_, __) => _flat(const ExamsScreen())),
            GoRoute(
                path: '/calendar',
                pageBuilder: (_, __) => _flat(const CalendarScreen())),

            // Teacher module dynamic routes
            GoRoute(
              path: '/teacher/subjects',
              pageBuilder: (_, __) => _flat(ChangeNotifierProvider(
                create: (_) => TeacherProvider(),
                child: const TeacherSubjectsScreen(),
              )),
            ),
            GoRoute(
              path: '/teacher/students',
              pageBuilder: (context, state) {
                final classId = state.uri.queryParameters['classId'] ?? '';
                final className = state.uri.queryParameters['className'] ?? '';
                final subjectName =
                    state.uri.queryParameters['subjectName'] ?? '';
                return _flat(ChangeNotifierProvider(
                  create: (_) => TeacherProvider(),
                  child: TeacherSubjectStudentsScreen(
                    classId: classId,
                    className: className,
                    subjectName: subjectName,
                  ),
                ));
              },
            ),
            GoRoute(
              path: '/teacher/exams',
              pageBuilder: (context, state) {
                final classId = state.uri.queryParameters['classId'] ?? '';
                final className = state.uri.queryParameters['className'] ?? '';
                final subjectId = state.uri.queryParameters['subjectId'] ?? '';
                final subjectName =
                    state.uri.queryParameters['subjectName'] ?? '';
                return _flat(ChangeNotifierProvider(
                  create: (_) => ExamsProvider(),
                  child: TeacherSubjectExamsScreen(
                    classId: classId,
                    className: className,
                    subjectId: subjectId,
                    subjectName: subjectName,
                  ),
                ));
              },
            ),

            // Student routes
            GoRoute(
                path: '/student/dashboard',
                pageBuilder: (_, __) => _flat(const StudentDashboardScreen())),
            GoRoute(
                path: '/student/homework',
                pageBuilder: (_, __) => _flat(const StudentHomeworkScreen())),
            GoRoute(
                path: '/student/exams',
                pageBuilder: (_, __) => _flat(const StudentExamsScreen())),
            GoRoute(
                path: '/student/attendance',
                pageBuilder: (_, __) => _flat(const StudentAttendanceScreen())),
            GoRoute(
                path: '/student/more',
                pageBuilder: (_, __) => _flat(const StudentMoreScreen())),
            GoRoute(
                path: '/student/leave',
                pageBuilder: (_, __) => _flat(const StudentLeaveScreen())),
            GoRoute(
                path: '/student/fees',
                pageBuilder: (_, __) => _flat(const StudentFeesScreen())),
            GoRoute(
                path: '/student/timetable',
                pageBuilder: (_, __) => _flat(const StudentTimetableScreen())),

            // Parent routes
            GoRoute(
                path: '/parent/dashboard',
                pageBuilder: (_, __) => _flat(const ParentDashboardScreen())),
            GoRoute(
                path: '/parent/children',
                pageBuilder: (_, __) => _flat(const ParentChildrenScreen())),
            GoRoute(
                path: '/parent/leave',
                pageBuilder: (_, __) => _flat(const ParentLeaveScreen())),
            GoRoute(
                path: '/parent/profile',
                pageBuilder: (_, __) => _flat(const ParentProfileScreen())),
          ],
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        body: Center(
          child: Text(
            'Page not found: ${state.uri.path}',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ),
    );
    return _instance!;
  }
}
