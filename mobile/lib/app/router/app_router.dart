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
                builder: (_, __) => const DashboardScreen()),
            GoRoute(
                path: '/attendance',
                builder: (_, __) => const AttendanceScreen()),
            GoRoute(
                path: '/homework', builder: (_, __) => const HomeworkScreen()),
            GoRoute(
                path: '/timetable',
                builder: (_, __) => const TimetableScreen()),
            GoRoute(
              path: '/students',
              builder: (_, state) {
                final extra = state.extra as Map<String, String>?;
                return StudentsScreen(
                  classId: extra?['classId'],
                  className: extra?['className'],
                );
              },
            ),
            GoRoute(
                path: '/profile', builder: (_, __) => const ProfileScreen()),
            GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
            GoRoute(
                path: '/notifications',
                builder: (_, __) => const NotificationsScreen()),
            // Role-specific aliases (the app shell routes parents/students here).
            GoRoute(
                path: '/parent/notifications',
                builder: (_, __) => const NotificationsScreen()),
            GoRoute(
                path: '/student/notifications',
                builder: (_, __) => const NotificationsScreen()),
            GoRoute(
                path: '/settings', builder: (_, __) => const SettingsScreen()),
            GoRoute(path: '/leave', builder: (_, __) => const LeaveScreen()),
            GoRoute(path: '/library', builder: (_, __) => const LibraryScreen()),
            GoRoute(path: '/exams', builder: (_, __) => const ExamsScreen()),
            GoRoute(
                path: '/calendar', builder: (_, __) => const CalendarScreen()),

            // Teacher module dynamic routes
            GoRoute(
              path: '/teacher/subjects',
              builder: (_, __) => ChangeNotifierProvider(
                create: (_) => TeacherProvider(),
                child: const TeacherSubjectsScreen(),
              ),
            ),
            GoRoute(
              path: '/teacher/students',
              builder: (context, state) {
                final classId = state.uri.queryParameters['classId'] ?? '';
                final className = state.uri.queryParameters['className'] ?? '';
                final subjectName =
                    state.uri.queryParameters['subjectName'] ?? '';
                return ChangeNotifierProvider(
                  create: (_) => TeacherProvider(),
                  child: TeacherSubjectStudentsScreen(
                    classId: classId,
                    className: className,
                    subjectName: subjectName,
                  ),
                );
              },
            ),
            GoRoute(
              path: '/teacher/exams',
              builder: (context, state) {
                final classId = state.uri.queryParameters['classId'] ?? '';
                final className = state.uri.queryParameters['className'] ?? '';
                final subjectId = state.uri.queryParameters['subjectId'] ?? '';
                final subjectName =
                    state.uri.queryParameters['subjectName'] ?? '';
                return ChangeNotifierProvider(
                  create: (_) => ExamsProvider(),
                  child: TeacherSubjectExamsScreen(
                    classId: classId,
                    className: className,
                    subjectId: subjectId,
                    subjectName: subjectName,
                  ),
                );
              },
            ),

            // Student routes
            GoRoute(
                path: '/student/dashboard',
                builder: (_, __) => const StudentDashboardScreen()),
            GoRoute(
                path: '/student/homework',
                builder: (_, __) => const StudentHomeworkScreen()),
            GoRoute(
                path: '/student/exams',
                builder: (_, __) => const StudentExamsScreen()),
            GoRoute(
                path: '/student/attendance',
                builder: (_, __) => const StudentAttendanceScreen()),
            GoRoute(
                path: '/student/more',
                builder: (_, __) => const StudentMoreScreen()),
            GoRoute(
                path: '/student/leave',
                builder: (_, __) => const StudentLeaveScreen()),
            GoRoute(
                path: '/student/fees',
                builder: (_, __) => const StudentFeesScreen()),
            GoRoute(
                path: '/student/timetable',
                builder: (_, __) => const StudentTimetableScreen()),

            // Parent routes
            GoRoute(
                path: '/parent/dashboard',
                builder: (_, __) => const ParentDashboardScreen()),
            GoRoute(
                path: '/parent/children',
                builder: (_, __) => const ParentChildrenScreen()),
            GoRoute(
                path: '/parent/leave',
                builder: (_, __) => const ParentLeaveScreen()),
            GoRoute(
                path: '/parent/profile',
                builder: (_, __) => const ParentProfileScreen()),
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
