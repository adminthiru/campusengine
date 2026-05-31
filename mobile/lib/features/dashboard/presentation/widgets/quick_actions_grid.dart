import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';

class QuickActionsGrid extends StatelessWidget {
  const QuickActionsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<ProfileProvider>().profile;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Permission helpers — default true when profile not yet loaded (optimistic)
    final ct = profile?.permissions.classTeacher;
    final st = profile?.permissions.subjectTeacher;
    final isClassTeacher = profile?.isClassTeacher ?? false;
    final isSubjectTeacher = profile?.isSubjectTeacher ?? false;

    // Each permission: OR of relevant class-teacher + subject-teacher flags
    final canMarkAttendance =
        isClassTeacher && (ct?.markStudentAttendance ?? true);

    final canAssignHomework = (isClassTeacher && (ct?.assignHomework ?? true)) ||
        (isSubjectTeacher && (st?.assignHomework ?? true));

    final canViewClassStudents = isClassTeacher && (ct?.viewStudents ?? true);

    final canViewTimetable = (isClassTeacher && (ct?.viewTimetable ?? true)) ||
        (isSubjectTeacher && (st?.viewTimetable ?? true));

    final canEnterExamMarks =
        (isClassTeacher && (ct?.viewAndEnterExamMarks ?? true)) ||
            (isSubjectTeacher && (st?.enterExamMarks ?? true));

    // Build action list dynamically — Leave is always present
    final actions = <_ActionItem>[
      if (canMarkAttendance)
        _ActionItem(
          'Mark\nAttendance',
          Icons.fact_check_rounded,
          AppColors.primary,
          () => context.go('/attendance'),
        ),
      if (canAssignHomework)
        _ActionItem(
          'Add\nHomework',
          Icons.assignment_rounded,
          AppColors.accentGreen,
          () => context.go('/homework'),
        ),
      if (canViewClassStudents)
        _ActionItem(
          'My\nClass',
          Icons.people_rounded,
          AppColors.accentPurple,
          () => context.go('/students'),
        ),
      if (canEnterExamMarks)
        _ActionItem(
          'Enter\nMarks',
          Icons.quiz_rounded,
          const Color(0xFFE11D48), // rose-600
          () => context.go('/exams'),
        ),
      if (canViewTimetable)
        _ActionItem(
          'View\nTimetable',
          Icons.schedule_rounded,
          AppColors.info,
          () => context.go('/timetable'),
        ),
      if (isSubjectTeacher)
        _ActionItem(
          'My\nSubjects',
          Icons.class_outlined,
          AppColors.primaryDark,
          () => context.go('/teacher/subjects'),
        ),
      _ActionItem(
        'Apply\nLeave',
        Icons.event_note_rounded,
        AppColors.accentOrange,
        () => context.go('/leave'),
      ),
    ];

    if (actions.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick Actions',
            style: GoogleFonts.inter(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 14),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: actions.map((action) {
                return Padding(
                  padding: const EdgeInsets.only(right: 16.0),
                  child: _buildActionCard(context, action, isDark),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard(
      BuildContext context, _ActionItem action, bool isDark) {
    return GestureDetector(
      onTap: action.onTap,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: isDark ? [] : AppColors.shadowSm,
              border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
                width: 1,
              ),
            ),
            child: Icon(
              action.icon,
              color: action.color,
              size: 28,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            action.label,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionItem {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  _ActionItem(this.label, this.icon, this.color, this.onTap);
}
