import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/features/profile/presentation/screens/profile_screen.dart';

class AppShell extends StatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  static const _tabs = [
    _NavItem(
        '/dashboard', Icons.dashboard_outlined, Icons.dashboard, 'Dashboard'),
    _NavItem('/attendance', Icons.fact_check_outlined, Icons.fact_check,
        'Attendance'),
    _NavItem(
        '/homework', Icons.assignment_outlined, Icons.assignment, 'Homework'),
    _NavItem(
        '/timetable', Icons.schedule_outlined, Icons.schedule, 'Timetable'),
    _NavItem('/more', Icons.more_horiz, Icons.more_horiz, 'More'),
  ];

  @override
  void initState() {
    super.initState();
    // Pre-fetch profile details so that the avatar loads immediately in the AppBar
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<ProfileProvider>();
      if (provider.profile == null) {
        provider.fetchProfile();
      }
    });
  }

  int _currentIndex(BuildContext ctx) {
    final loc = GoRouterState.of(ctx).uri.path;
    final i = _tabs.indexWhere((t) => loc.startsWith(t.path));
    // If not found (or if it's a route not in bottom nav), default to 0
    return i < 0 ? 0 : i;
  }

  String _getTitle(String path) {
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/attendance')) return 'Attendance';
    if (path.startsWith('/homework')) return 'Homework';
    if (path.startsWith('/timetable')) return 'Timetable';
    if (path.startsWith('/more')) return 'More Options';
    if (path.startsWith('/students')) return 'Students';
    if (path.startsWith('/profile')) return 'Profile';
    return 'SKL Teacher';
  }

  @override
  Widget build(BuildContext context) {
    final idx = _currentIndex(context);
    final loc = GoRouterState.of(context).uri.path;
    final title = _getTitle(loc);

    final profileProvider = context.watch<ProfileProvider>();
    final profile = profileProvider.profile;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        leading: loc == '/profile'
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.go('/dashboard'),
              )
            : null,
        title: Text(
          title,
          style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        centerTitle: false,
        elevation: 0,
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        actions: [
          IconButton(
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (Widget child, Animation<double> animation) {
                return RotationTransition(
                  turns: animation,
                  child: FadeTransition(
                    opacity: animation,
                    child: ScaleTransition(
                      scale: animation,
                      child: child,
                    ),
                  ),
                );
              },
              child: isDark
                  ? const Icon(
                      Icons.nightlight_round,
                      key: ValueKey('dark_icon'),
                      color: Colors.amber,
                    )
                  : const Icon(
                      Icons.wb_sunny_outlined,
                      key: ValueKey('light_icon'),
                      color: Colors.orange,
                    ),
            ),
            onPressed: () {
              context.read<ThemeProvider>().toggle();
            },
          ),
          if (loc == '/profile')
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit Details',
              onPressed: () {
                if (profile != null) {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (context) =>
                        EditProfileBottomSheet(profile: profile),
                  );
                }
              },
            )
          else
            GestureDetector(
              onTap: () => context.go('/profile'),
              child: Padding(
                padding: const EdgeInsets.only(right: 16.0, left: 8.0),
                child: CircleAvatar(
                  radius: 16,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  backgroundImage: profile?.employee.photo != null
                      ? NetworkImage(profile!.employee.photo!)
                      : null,
                  child: profile?.employee.photo == null
                      ? Text(
                          (profile?.employee.name ?? 'T')
                              .substring(0, 1)
                              .toUpperCase(),
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        )
                      : null,
                ),
              ),
            ),
        ],
      ),
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: idx,
        onTap: (i) => context.go(_tabs[i].path),
        items: _tabs
            .map((t) => BottomNavigationBarItem(
                  icon: Icon(t.icon),
                  activeIcon: Icon(t.activeIcon),
                  label: t.label,
                ))
            .toList(),
      ),
    );
  }
}

class _NavItem {
  final String path, label;
  final IconData icon, activeIcon;
  const _NavItem(this.path, this.icon, this.activeIcon, this.label);
}
