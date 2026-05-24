import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';

class QuickActionsGrid extends StatelessWidget {
  const QuickActionsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final actions = [
      _ActionItem('Mark\nAttendance', Icons.fact_check, AppColors.primary, () => context.go('/attendance')),
      _ActionItem('Add\nHomework', Icons.assignment, AppColors.accentGreen, () => context.go('/homework')),
      _ActionItem('View\nStudents', Icons.people, AppColors.accentPurple, () => context.go('/students')),
      _ActionItem('Apply\nLeave', Icons.event_note, AppColors.accentOrange, () {}),
      _ActionItem('View\nTimetable', Icons.schedule, AppColors.info, () => context.go('/timetable')),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick Actions',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
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

  Widget _buildActionCard(BuildContext context, _ActionItem action, bool isDark) {
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
