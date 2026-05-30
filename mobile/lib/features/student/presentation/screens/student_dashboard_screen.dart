import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentDashboardScreen extends StatefulWidget {
  const StudentDashboardScreen({super.key});

  @override
  State<StudentDashboardScreen> createState() => _StudentDashboardScreenState();
}

class _StudentDashboardScreenState extends State<StudentDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sp = context.read<StudentProfileProvider>();
      if (sp.profile == null && !sp.loading) sp.fetchProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final sp = context.watch<StudentProfileProvider>();
    final perms = context.watch<SchoolPermissionsProvider>();
    final student = sp.profile;

    return RefreshIndicator(
      onRefresh: () => sp.fetchProfile(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(16),
              ),
              child: sp.loading
                  ? const Center(child: CircularProgressIndicator(color: Colors.white))
                  : Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: Colors.white.withValues(alpha: 0.2),
                          child: Text(
                            (student?.name ?? 'S').substring(0, 1).toUpperCase(),
                            style: GoogleFonts.inter(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                student?.name ?? '—',
                                style: GoogleFonts.inter(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                student?.classLabel ?? 'No class assigned',
                                style: GoogleFonts.inter(fontSize: 13, color: Colors.white70),
                              ),
                              Text(
                                student?.admissionNumber ?? '',
                                style: GoogleFonts.inter(fontSize: 12, color: Colors.white60),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
            ),

            const SizedBox(height: 24),

            // Quick access tiles
            Text(
              'Quick Access',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),

            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.4,
              children: [
                if (perms.studentCan('viewHomework'))
                  _Tile('Homework', Icons.assignment_outlined, AppColors.primary,
                      () => context.go('/student/homework')),
                if (perms.studentCan('viewExams'))
                  _Tile('Exams', Icons.quiz_outlined, const Color(0xFF7C3AED),
                      () => context.go('/student/exams')),
                if (perms.studentCan('viewAttendance'))
                  _Tile('Attendance', Icons.fact_check_outlined, AppColors.accentGreen,
                      () => context.go('/student/attendance')),
                if (perms.studentCan('viewTimetable'))
                  _Tile('Timetable', Icons.schedule_outlined, AppColors.accentOrange,
                      () => context.go('/student/timetable')),
                if (perms.studentCan('viewFees'))
                  _Tile('Fees', Icons.receipt_outlined, const Color(0xFF0891B2),
                      () => context.go('/student/fees')),
                if (perms.studentCan('submitLeaveRequest'))
                  _Tile('Leave', Icons.event_note_outlined, AppColors.accentRed,
                      () => context.go('/student/leave')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _Tile(this.label, this.icon, this.color, this.onTap);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(label,
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
