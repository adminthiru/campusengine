import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../providers/auth_provider.dart';
import '../providers/teacher_profile_provider.dart';
import '../screens/profile/profile_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'attendance/attendance_screen.dart';
import 'timetable/timetable_screen.dart';
import 'homework/homework_screen.dart';
import 'more/more_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TeacherProfileProvider>().fetchProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<TeacherProfileProvider>();
    final auth = context.watch<AuthProvider>();
    final isAssigned = profile.isClassTeacher || profile.isSubjectTeacher;

    // Screens for the 4 main tabs (no More screen)
    final List<_NavItem> screenItems = isAssigned
        ? [
            _NavItem('Dashboard', Icons.dashboard_rounded, const DashboardScreen()),
            _NavItem('Attendance', Icons.how_to_reg_rounded, const AttendanceScreen()),
            _NavItem('Timetable', Icons.calendar_today_rounded, const TimetableScreen()),
            _NavItem('Homework', Icons.book_rounded, const HomeworkScreen()),
          ]
        : [
            _NavItem('Dashboard', Icons.dashboard_rounded, const DashboardScreen()),
            _NavItem('Attendance', Icons.how_to_reg_rounded, const AttendanceScreen()),
            _NavItem('Profile', Icons.person_rounded, const ProfileScreen()),
          ];

    // Bottom nav items — assigned teachers get a 5th "More" button
    final List<BottomNavigationBarItem> navBarItems = isAssigned
        ? [
            ...screenItems.map((n) => BottomNavigationBarItem(
                  icon: Icon(n.icon), label: n.label)),
            const BottomNavigationBarItem(
              icon: Icon(Icons.grid_view_rounded), label: 'More'),
          ]
        : screenItems.map((n) => BottomNavigationBarItem(
              icon: Icon(n.icon), label: n.label)).toList();

    final safeIndex = _index.clamp(0, screenItems.length - 1);

    return Scaffold(
      appBar: AppBar(
        title: Text(auth.user?.school?.name ?? 'School ERP'),
        actions: [
          GestureDetector(
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const ProfileScreen())),
            child: Padding(
              padding: const EdgeInsets.only(right: 16),
              child: CircleAvatar(
                radius: 17,
                backgroundColor: kPrimaryLight,
                backgroundImage: auth.user?.avatar != null
                    ? NetworkImage(auth.user!.avatar!) : null,
                child: auth.user?.avatar == null
                    ? Text(
                        (auth.user?.name.isNotEmpty == true)
                            ? auth.user!.name[0].toUpperCase() : 'T',
                        style: const TextStyle(
                          color: kPrimary, fontSize: 14, fontWeight: FontWeight.w700,
                        ),
                      )
                    : null,
              ),
            ),
          ),
        ],
      ),
      body: screenItems[safeIndex].screen,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: safeIndex,
        onTap: (i) {
          final isMoreTap = isAssigned && i == screenItems.length;
          if (isMoreTap) {
            showMoreBottomSheet(context);
          } else {
            setState(() => _index = i);
          }
        },
        items: navBarItems,
      ),
    );
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  final Widget screen;
  const _NavItem(this.label, this.icon, this.screen);
}
