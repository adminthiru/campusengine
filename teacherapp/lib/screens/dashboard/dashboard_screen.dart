import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants.dart';
import '../../providers/auth_provider.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../models/teacher_profile.dart';
import '../../widgets/app_card.dart';
import '../attendance/attendance_screen.dart';
import '../more/students_screen.dart';
import '../more/exams_screen.dart';
import '../homework/homework_screen.dart';
import '../timetable/timetable_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final profileProv = context.watch<TeacherProfileProvider>();

    if (profileProv.loading && profileProv.profile == null) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }

    final profile = profileProv.profile;
    final firstName = auth.user?.name.split(' ').first ?? 'Teacher';

    return RefreshIndicator(
      color: kPrimary,
      onRefresh: () => profileProv.fetchProfile(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Greeting
            Text('Hello, $firstName! 👋', style: GoogleFonts.inter(
              fontSize: 20, fontWeight: FontWeight.w700, color: kTextPrimary,
            )),
            Text(profile?.employee.designation ?? 'Teacher', style: GoogleFonts.inter(
              fontSize: 13, color: kTextMuted,
            )),
            const SizedBox(height: 20),

            if (profile == null || (!profile.isClassTeacher && !profile.isSubjectTeacher))
              _UnassignedView()
            else if (profile.isClassTeacher)
              _ClassTeacherView(profile: profile)
            else
              _SubjectTeacherView(profile: profile),
          ],
        ),
      ),
    );
  }
}

// ─── Unassigned ───────────────────────────────────────────────────────────────

class _UnassignedView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: kPrimaryLight,
            border: Border.all(color: const Color(0xFFBFDBFE)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE), shape: BoxShape.circle,
                ),
                child: const Icon(Icons.access_time_rounded, color: kPrimary, size: 20),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Awaiting Class Assignment', style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E40AF),
                    )),
                    SizedBox(height: 3),
                    Text("You haven't been assigned to any class yet. Contact your administrator.",
                      style: TextStyle(fontSize: 12, color: Color(0xFF3B82F6)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const _QuickAttendanceCard(),
      ],
    );
  }
}

class _QuickAttendanceCard extends StatelessWidget {
  const _QuickAttendanceCard();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      borderLeftColor: kSuccess,
      child: Row(
        children: [
          const Icon(Icons.how_to_reg_rounded, color: kSuccess, size: 24),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('My Attendance', style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary,
                )),
                Text('Mark your attendance for today', style: TextStyle(
                  fontSize: 12, color: kTextMuted,
                )),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const AttendanceScreen())),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(80, 36),
              padding: const EdgeInsets.symmetric(horizontal: 14),
            ),
            child: const Text('Mark', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

// ─── Class Teacher ─────────────────────────────────────────────────────────────

class _ClassTeacherView extends StatelessWidget {
  final TeacherProfile profile;
  const _ClassTeacherView({required this.profile});

  @override
  Widget build(BuildContext context) {
    final cls = profile.classTeacher?.classInfo;
    final ctPerms = profile.permissions.classTeacher;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Class card
        if (cls != null) ...[
          AppCard(
            borderLeftColor: kPrimary,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(cls.fullName, style: GoogleFonts.inter(
                            fontSize: 20, fontWeight: FontWeight.w700, color: kTextPrimary,
                          )),
                          Text('Your assigned class', style: GoogleFonts.inter(
                            fontSize: 12, color: kTextMuted,
                          )),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: kPrimaryLight, borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text('Class Teacher', style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600, color: kPrimary,
                      )),
                    ),
                  ],
                ),
                if (cls.subjects.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6, runSpacing: 6,
                    children: cls.subjects.map((s) {
                      final color = _hexColor(s.color) ?? kPrimary;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border(left: BorderSide(color: color, width: 3)),
                        ),
                        child: Text(s.name, style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w500, color: color,
                        )),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Feature tiles
        Text('Quick Actions', style: GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w600, color: kTextMuted,
          letterSpacing: 0.5,
        )),
        const SizedBox(height: 10),
        Builder(builder: (context) {
          final tiles = <Widget>[
            if (ctPerms.markStudentAttendance)
              _FeatureTile('Attendance', Icons.how_to_reg_rounded, kSuccess, kSuccessLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AttendanceScreen()))),
            if (ctPerms.viewStudents)
              _FeatureTile('Students', Icons.groups_rounded, kPrimary, kPrimaryLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentsScreen()))),
            if (ctPerms.viewAndEnterExamMarks)
              _FeatureTile('Exams', Icons.assignment_rounded, kDanger, kDangerLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExamsScreen()))),
            if (ctPerms.assignHomework)
              _FeatureTile('Homework', Icons.book_rounded, kPurple, kPurpleLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HomeworkScreen()))),
            if (ctPerms.viewTimetable)
              _FeatureTile('Timetable', Icons.calendar_today_rounded, kCyan, kCyanLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TimetableScreen()))),
          ];
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (int i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: tiles[i]),
              ],
            ],
          );
        }),

        // Subject teacher classes (if also subject teacher)
        if (profile.isSubjectTeacher && profile.subjectTeacher.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('Subject Classes', style: GoogleFonts.inter(
            fontSize: 13, fontWeight: FontWeight.w600, color: kTextMuted, letterSpacing: 0.5,
          )),
          const SizedBox(height: 10),
          ...profile.subjectTeacher.map((st) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              borderLeftColor: _hexColor(st.subject.color) ?? kPurple,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(st.subject.name, style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary,
                        )),
                        Text(st.classInfo.fullName, style: const TextStyle(
                          fontSize: 12, color: kTextMuted,
                        )),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: kPurpleLight, borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text('Subject Teacher', style: TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w600, color: kPurple,
                    )),
                  ),
                ],
              ),
            ),
          )),
        ],
      ],
    );
  }
}

// ─── Subject Teacher ───────────────────────────────────────────────────────────

class _SubjectTeacherView extends StatelessWidget {
  final TeacherProfile profile;
  const _SubjectTeacherView({required this.profile});

  @override
  Widget build(BuildContext context) {
    final stPerms = profile.permissions.subjectTeacher;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('My Subject Classes', style: GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w600, color: kTextMuted, letterSpacing: 0.5,
        )),
        const SizedBox(height: 10),
        ...profile.subjectTeacher.map((st) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AppCard(
            borderLeftColor: _hexColor(st.subject.color) ?? kPurple,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(st.subject.name, style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary,
                      )),
                      Text(st.classInfo.fullName, style: const TextStyle(
                        fontSize: 12, color: kTextMuted,
                      )),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: kPurpleLight, borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text('Subject Teacher', style: TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w600, color: kPurple,
                  )),
                ),
              ],
            ),
          ),
        )),
        const SizedBox(height: 16),
        Text('Quick Actions', style: GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w600, color: kTextMuted, letterSpacing: 0.5,
        )),
        const SizedBox(height: 10),
        Builder(builder: (context) {
          final tiles = <Widget>[
            if (stPerms.markOwnAttendance)
              _FeatureTile('My Attendance', Icons.how_to_reg_rounded, kSuccess, kSuccessLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AttendanceScreen()))),
            if (stPerms.viewSubjectStudents)
              _FeatureTile('Students', Icons.groups_rounded, kPrimary, kPrimaryLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentsScreen()))),
            if (stPerms.enterExamMarks)
              _FeatureTile('Enter Marks', Icons.assignment_rounded, kDanger, kDangerLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExamsScreen()))),
            if (stPerms.assignHomework)
              _FeatureTile('Homework', Icons.book_rounded, kPurple, kPurpleLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HomeworkScreen()))),
            if (stPerms.viewTimetable)
              _FeatureTile('Timetable', Icons.calendar_today_rounded, kCyan, kCyanLight,
                  () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TimetableScreen()))),
          ];
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (int i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: tiles[i]),
              ],
            ],
          );
        }),
      ],
    );
  }
}

// ─── Feature Tile ──────────────────────────────────────────────────────────────

class _FeatureTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _FeatureTile(this.label, this.icon, this.color, this.bgColor, this.onTap);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: kCardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kBorder),
          boxShadow: [BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6, offset: const Offset(0, 2),
          )],
        ),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600, color: kTextPrimary,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Color? _hexColor(String? hex) {
  if (hex == null) return null;
  try {
    final h = hex.replaceAll('#', '');
    return Color(int.parse('FF$h', radix: 16));
  } catch (_) {
    return null;
  }
}
