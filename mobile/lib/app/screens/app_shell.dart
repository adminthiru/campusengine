import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/features/profile/presentation/screens/profile_screen.dart';

class AppShell extends StatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  // Teacher tabs (default)
  static const _teacherTabs = [
    _NavItem('/dashboard',   Icons.dashboard_outlined,   Icons.dashboard,    'Dashboard'),
    _NavItem('/attendance',  Icons.fact_check_outlined,  Icons.fact_check,   'Attendance'),
    _NavItem('/homework',    Icons.assignment_outlined,   Icons.assignment,   'Homework'),
    _NavItem('/timetable',   Icons.schedule_outlined,    Icons.schedule,     'Timetable'),
    _NavItem('/more',        Icons.more_horiz,           Icons.more_horiz,   'More'),
  ];

  // Student tabs
  static const _studentTabs = [
    _NavItem('/student/dashboard',  Icons.home_outlined,        Icons.home,         'Home'),
    _NavItem('/student/homework',   Icons.assignment_outlined,  Icons.assignment,   'Homework'),
    _NavItem('/student/exams',      Icons.quiz_outlined,        Icons.quiz,         'Exams'),
    _NavItem('/student/attendance', Icons.fact_check_outlined,  Icons.fact_check,   'Attendance'),
    _NavItem('/student/more',       Icons.more_horiz,           Icons.more_horiz,   'More'),
  ];

  // Parent tabs
  static const _parentTabs = [
    _NavItem('/parent/dashboard', Icons.home_outlined,        Icons.home,        'Home'),
    _NavItem('/parent/children',  Icons.people_outlined,      Icons.people,      'My Children'),
    _NavItem('/parent/leave',     Icons.event_note_outlined,  Icons.event_note,  'Leave'),
    _NavItem('/parent/profile',   Icons.person_outlined,      Icons.person,      'Profile'),
  ];

  List<_NavItem> _tabsFor(String role) {
    if (role == 'student') return _studentTabs;
    if (role == 'parent') return _parentTabs;
    return _teacherTabs;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      final role = auth.role;
      final perms = context.read<SchoolPermissionsProvider>();
      if (!perms.loaded) perms.fetch();

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

  int _currentIndex(BuildContext ctx, List<_NavItem> tabs) {
    final loc = GoRouterState.of(ctx).uri.path;
    final i = tabs.indexWhere((t) => loc.startsWith(t.path));
    return i < 0 ? 0 : i;
  }

  String _getTitle(String path, String role) {
    if (role == 'student') {
      if (path.startsWith('/student/dashboard'))  return 'My Dashboard';
      if (path.startsWith('/student/homework'))   return 'Homework';
      if (path.startsWith('/student/exams'))      return 'Exams';
      if (path.startsWith('/student/attendance')) return 'My Attendance';
      if (path.startsWith('/student/leave'))      return 'Leave Requests';
      if (path.startsWith('/student/fees'))       return 'My Fees';
      if (path.startsWith('/student/timetable'))  return 'Timetable';
      if (path.startsWith('/student/more'))       return 'More';
      return 'Student Portal';
    }
    if (role == 'parent') {
      if (path.startsWith('/parent/dashboard')) return 'Dashboard';
      if (path.startsWith('/parent/children'))  return 'My Children';
      if (path.startsWith('/parent/leave'))     return 'Leave Requests';
      if (path.startsWith('/parent/profile'))   return 'Profile';
      return 'Parent Portal';
    }
    // Teacher
    if (path.startsWith('/dashboard'))   return 'Dashboard';
    if (path.startsWith('/attendance'))  return 'Attendance';
    if (path.startsWith('/homework'))    return 'Homework';
    if (path.startsWith('/timetable'))   return 'Timetable';
    if (path.startsWith('/more'))        return 'More Options';
    if (path.startsWith('/students'))    return 'Students';
    if (path.startsWith('/profile'))     return 'Profile';
    return 'SKL Teacher';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final role = auth.role;
    final tabs = _tabsFor(role);
    final idx = _currentIndex(context, tabs);
    final loc = GoRouterState.of(context).uri.path;
    final title = _getTitle(loc, role);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Avatar display name — teacher uses profile, others use auth user name
    final profileProvider = context.watch<ProfileProvider>();
    final profile = profileProvider.profile;
    final displayName = role == 'student' || role == 'parent'
        ? (auth.user?.name ?? 'U')
        : (profile?.employee.name ?? auth.user?.name ?? 'U');
    final photoUrl = (role != 'student' && role != 'parent') ? profile?.employee.photo : null;

    return Scaffold(
      appBar: AppBar(
        leading: loc == '/profile'
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  if (role == 'student') {
                    context.go('/student/dashboard');
                  } else if (role == 'parent') context.go('/parent/dashboard');
                  else context.go('/dashboard');
                },
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
              transitionBuilder: (child, animation) => RotationTransition(
                turns: animation,
                child: FadeTransition(opacity: animation, child: child),
              ),
              child: isDark
                  ? const Icon(Icons.nightlight_round, key: ValueKey('dark'),  color: Colors.amber)
                  : const Icon(Icons.wb_sunny_outlined,  key: ValueKey('light'), color: Colors.orange),
            ),
            onPressed: () => context.read<ThemeProvider>().toggle(),
          ),
          if (loc == '/profile' && role != 'student' && role != 'parent')
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit Details',
              onPressed: () {
                if (profile != null) {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => EditProfileBottomSheet(profile: profile),
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
                  backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
                  child: photoUrl == null
                      ? Text(
                          displayName.substring(0, 1).toUpperCase(),
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
        onTap: (i) => context.go(tabs[i].path),
        items: tabs
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
