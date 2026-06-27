import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/app/widgets/app_bottom_nav.dart';
import 'package:skl_teacher/core/services/push_service.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/notifications/presentation/providers/notifications_provider.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class AppShell extends StatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  // Class teacher tabs (with Attendance)
  static const _classTeacherTabs = [
    _NavItem(
        '/dashboard', Icons.dashboard_outlined, Icons.dashboard, 'Dashboard'),
    _NavItem('/attendance', Icons.fact_check_outlined, Icons.fact_check,
        'Attendance'),
    _NavItem(
        '/homework', Icons.assignment_outlined, Icons.assignment, 'Homework'),
    _NavItem('/exams', Icons.quiz_outlined, Icons.quiz, 'Marks'),
    _NavItem('/more', Icons.more_horiz, Icons.more_horiz, 'More'),
  ];

  // Subject-only teacher tabs (Attendance replaced with Leave)
  static const _subjectTeacherTabs = [
    _NavItem(
        '/dashboard', Icons.dashboard_outlined, Icons.dashboard, 'Dashboard'),
    _NavItem('/leave', Icons.event_note_outlined, Icons.event_note, 'Leave'),
    _NavItem(
        '/homework', Icons.assignment_outlined, Icons.assignment, 'Homework'),
    _NavItem('/exams', Icons.quiz_outlined, Icons.quiz, 'Marks'),
    _NavItem('/more', Icons.more_horiz, Icons.more_horiz, 'More'),
  ];

  // Student tabs
  static const _studentTabs = [
    _NavItem('/student/dashboard', Icons.home_outlined, Icons.home, 'Home'),
    _NavItem('/student/homework', Icons.assignment_outlined, Icons.assignment,
        'Homework'),
    _NavItem('/student/exams', Icons.quiz_outlined, Icons.quiz, 'Exams'),
    _NavItem('/student/attendance', Icons.fact_check_outlined, Icons.fact_check,
        'Attendance'),
    _NavItem('/student/more', Icons.more_horiz, Icons.more_horiz, 'More'),
  ];

  // Parent tabs
  static const _parentTabs = [
    _NavItem('/parent/dashboard', Icons.home_outlined, Icons.home, 'Home'),
    _NavItem(
        '/parent/children', Icons.people_outlined, Icons.people, 'My Children'),
    _NavItem(
        '/parent/leave', Icons.event_note_outlined, Icons.event_note, 'Leave'),
    _NavItem('/calendar', Icons.calendar_month_outlined, Icons.calendar_month,
        'Calendar'),
    _NavItem('/parent/profile', Icons.person_outlined, Icons.person, 'Profile'),
  ];

  List<_NavItem> _tabsFor(String role, {bool subjectOnly = false}) {
    if (role == 'student') return _studentTabs;
    if (role == 'parent') return _parentTabs;
    return subjectOnly ? _subjectTeacherTabs : _classTeacherTabs;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      final role = auth.role;
      final perms = context.read<SchoolPermissionsProvider>();
      if (!perms.loaded) perms.fetch();

      // Register this device for push notifications now that we're authenticated.
      PushService.setup();

      // Keep the unread-notification badge live while the app is open.
      context.read<NotificationsProvider>().startPolling();

      if (role == 'student') {
        final sp = context.read<StudentProfileProvider>();
        if (sp.profile == null) sp.fetchProfile();
      } else if (role == 'parent') {
        final pp = context.read<ParentDataProvider>();
        if (pp.children.isEmpty) pp.fetchChildren();
      } else {
        final profileProvider = context.read<ProfileProvider>();
        if (profileProvider.profile == null) profileProvider.fetchProfile();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Returning to the app — pull the latest unread count so the bell badge
    // reflects notifications received while it was backgrounded.
    if (state == AppLifecycleState.resumed && mounted) {
      context.read<NotificationsProvider>().refresh();
    }
  }

  int _currentIndex(BuildContext ctx, List<_NavItem> tabs) {
    final loc = GoRouterState.of(ctx).uri.path;
    final i = tabs.indexWhere((t) => loc.startsWith(t.path));
    if (i >= 0) return i;
    // Secondary routes (from More menu) → highlight the More tab
    final moreIdx = tabs.indexWhere((t) => t.path.endsWith('/more'));
    return moreIdx >= 0 ? moreIdx : 0;
  }

  String _getTitle(String path, String role) {
    if (path.endsWith('/notifications')) return 'Notifications';
    if (role == 'student') {
      if (path.startsWith('/student/dashboard')) return 'My Dashboard';
      if (path.startsWith('/student/homework')) return 'Homework';
      if (path.startsWith('/student/exams')) return 'Exams';
      if (path.startsWith('/student/attendance')) return 'My Attendance';
      if (path.startsWith('/student/leave')) return 'Leave Requests';
      if (path.startsWith('/student/fees')) return 'My Fees';
      if (path.startsWith('/student/timetable')) return 'Timetable';
      if (path.startsWith('/student/more')) return 'More';
      if (path.startsWith('/calendar')) return 'School Calendar';
      return 'Student Portal';
    }
    if (role == 'parent') {
      if (path.startsWith('/parent/dashboard')) return 'Dashboard';
      if (path.startsWith('/parent/children')) return 'My Children';
      if (path.startsWith('/parent/leave')) return 'Leave Requests';
      if (path.startsWith('/parent/profile')) return 'Profile';
      if (path.startsWith('/calendar')) return 'School Calendar';
      return 'Parent Portal';
    }
    // Teacher
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/attendance')) return 'Attendance';
    if (path.startsWith('/homework')) return 'Homework';
    if (path.startsWith('/timetable')) return 'Timetable';
    if (path.startsWith('/exams')) return 'Exams & Marks';
    if (path.startsWith('/more')) return 'More';
    if (path.startsWith('/students')) return 'My Students';
    if (path.startsWith('/profile')) return 'Profile';
    if (path.startsWith('/leave')) return 'Leave Requests';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/notifications')) return 'Notifications';
    if (path.startsWith('/calendar')) return 'School Calendar';
    return 'SKL School';
  }

  bool _isSubRoute(String loc, List<_NavItem> tabs) {
    for (final t in tabs) {
      if (loc == t.path) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final role = auth.role;
    final profileProv = context.watch<ProfileProvider>();
    final profile = profileProv.profile;
    // Default isClassTeacher to false until profile loads — subject teachers
    // immediately get the correct Leave tab; class teachers switch on load.
    final isClassTeacher = profile?.isClassTeacher ?? false;
    final subjectOnly = role != 'student' && role != 'parent' && !isClassTeacher;
    final tabs = _tabsFor(role, subjectOnly: subjectOnly);
    final idx = _currentIndex(context, tabs);
    final loc = GoRouterState.of(context).uri.path;
    final title = _getTitle(loc, role);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          title,
          style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        centerTitle: false,
        elevation: 0,
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        leading: _isSubRoute(loc, tabs)
            ? IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                onPressed: () {
                  final moreTab = tabs.firstWhere(
                      (t) => t.path.endsWith('/more'),
                      orElse: () => tabs.first);
                  context.go(moreTab.path);
                },
              )
            : null,
        actions: [
          Builder(builder: (context) {
            final unread = context.watch<NotificationsProvider>().unread;
            return IconButton(
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text(unread > 99 ? '99+' : '$unread'),
                backgroundColor: AppColors.accentRed,
                child: const Icon(Icons.notifications_outlined),
              ),
              onPressed: () {
                if (role == 'student') {
                  context.go('/student/notifications');
                } else if (role == 'parent') {
                  context.go('/parent/notifications');
                } else {
                  context.go('/notifications');
                }
              },
            );
          }),
          IconButton(
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (child, animation) => RotationTransition(
                turns: animation,
                child: FadeTransition(opacity: animation, child: child),
              ),
              child: isDark
                  ? const Icon(Icons.nightlight_round,
                      key: ValueKey('dark'), color: Colors.amber)
                  : const Icon(Icons.wb_sunny_outlined,
                      key: ValueKey('light'), color: Colors.orange),
            ),
            onPressed: () => context.read<ThemeProvider>().toggle(),
          ),
        ],
      ),
      body: widget.child,
      bottomNavigationBar: AppBottomNav(
        currentIndex: idx,
        onTap: (i) => context.go(tabs[i].path),
        items: tabs
            .map((t) => AppBottomNavItem(
                  icon: t.icon,
                  activeIcon: t.activeIcon,
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
