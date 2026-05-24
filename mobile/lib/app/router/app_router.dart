// ── GoRouter — App Navigation with auth guard ─────────────────────────────────

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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

        if (isSplash) return null; // Let splash handle itself
        if (!isAuth && !isAuthPath) return '/auth/login';
        if (isAuth && isAuthPath) return '/dashboard';
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
            GoRoute(
              path: '/dashboard',
              builder: (_, __) => const DashboardScreen(),
            ),
            GoRoute(
              path: '/attendance',
              builder: (_, __) => const AttendanceScreen(),
            ),
            GoRoute(
              path: '/homework',
              builder: (_, __) => const HomeworkScreen(),
            ),
            GoRoute(
              path: '/timetable',
              builder: (_, __) => const TimetableScreen(),
            ),
            GoRoute(
              path: '/students',
              builder: (_, __) => const StudentsScreen(),
            ),
            GoRoute(
              path: '/profile',
              builder: (_, __) => const ProfileScreen(),
            ),
            GoRoute(
              path: '/more',
              builder: (_, __) => const MoreScreen(),
            ),
            GoRoute(
              path: '/notifications',
              builder: (_, __) => const NotificationsScreen(),
            ),
            GoRoute(
              path: '/settings',
              builder: (_, __) => const SettingsScreen(),
            ),
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
