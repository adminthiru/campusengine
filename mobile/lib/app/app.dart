// ── Root App Widget — Wires theme, router, and all global providers ───────────

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/theme_provider.dart';
import '../core/services/push_service.dart';
import '../features/dashboard/presentation/providers/check_in_provider.dart';
import '../features/dashboard/presentation/providers/dashboard_provider.dart';
import '../features/auth/presentation/providers/auth_provider.dart';
import '../features/auth/presentation/providers/school_permissions_provider.dart';
import '../features/profile/presentation/providers/profile_provider.dart';
import '../features/student/presentation/providers/student_profile_provider.dart';
import '../features/parent/presentation/providers/parent_data_provider.dart';
import '../features/notifications/presentation/providers/notifications_provider.dart';
import 'router/app_router.dart';

class SKLTeacherApp extends StatelessWidget {
  const SKLTeacherApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Prevent Inter from fetching at runtime in production
    // (falls back to bundled font if no network on first launch)
    GoogleFonts.config.allowRuntimeFetching = true;

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()..loadTheme()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ProfileProvider()),
        ChangeNotifierProvider(create: (_) => CheckInProvider()),
        ChangeNotifierProvider(create: (_) => DashboardProvider()),
        ChangeNotifierProvider(create: (_) => SchoolPermissionsProvider()),
        ChangeNotifierProvider(create: (_) => StudentProfileProvider()),
        ChangeNotifierProvider(create: (_) => ParentDataProvider()),
        ChangeNotifierProvider(create: (_) => NotificationsProvider()),
      ],
      child: const _AppRouterContainer(),
    );
  }
}

class _AppRouterContainer extends StatefulWidget {
  const _AppRouterContainer();

  @override
  State<_AppRouterContainer> createState() => _AppRouterContainerState();
}

class _AppRouterContainerState extends State<_AppRouterContainer> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    // Instantiate GoRouter once and preserve it
    final authProvider = context.read<AuthProvider>();
    _router = AppRouter.createRouter(authProvider);
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return MaterialApp.router(
      // ── App Info ─────────────────────────────────────────────────
      title: 'SKL Teacher',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: scaffoldMessengerKey,

      // ── Theme — Inter applied globally via ThemeData.textTheme ───
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeProvider.themeMode,

      // ── Router ────────────────────────────────────────────────────
      routerConfig: _router,
    );
  }
}
