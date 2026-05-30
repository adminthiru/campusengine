import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentMoreScreen extends StatelessWidget {
  const StudentMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth    = context.watch<AuthProvider>();
    final perms   = context.watch<SchoolPermissionsProvider>();
    final sp      = context.watch<StudentProfileProvider>();
    final student = sp.profile;
    final isDark  = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Profile card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  child: Text(
                    (auth.user?.name ?? 'S').substring(0, 1).toUpperCase(),
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(auth.user?.name ?? '', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                      Text(student?.classLabel ?? '', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted)),
                      Text(student?.admissionNumber ?? '', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text('More Options', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          if (perms.studentCan('viewFees'))
            _tile(context, Icons.receipt_outlined, 'My Fees', 'View fee records & payment status',
                () => context.go('/student/fees'), isDark),
          if (perms.studentCan('submitLeaveRequest'))
            _tile(context, Icons.event_note_outlined, 'Leave Requests', 'Apply for leave & view history',
                () => context.go('/student/leave'), isDark),
          if (perms.studentCan('viewTimetable'))
            _tile(context, Icons.schedule_outlined, 'Timetable', 'View class timetable',
                () => context.go('/student/timetable'), isDark),
          _tile(context, Icons.logout, 'Logout', 'Sign out of your account', () {
            context.read<AuthProvider>().logout();
          }, isDark, color: AppColors.accentRed),
        ],
      ),
    );
  }

  Widget _tile(BuildContext ctx, IconData icon, String title, String subtitle,
      VoidCallback onTap, bool isDark, {Color? color}) {
    final c = color ?? AppColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: c.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: c, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: c == AppColors.accentRed ? c : null)),
                  Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}
