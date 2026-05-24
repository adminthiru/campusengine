import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 24.0, horizontal: 16.0),
        children: [
          _buildMoreTile(
            context,
            icon: Icons.people_outline,
            color: AppColors.primary,
            title: 'Student list of class teacher',
            onTap: () => context.go('/students'),
            isDark: isDark,
          ),
          const SizedBox(height: 12),
          _buildMoreTile(
            context,
            icon: Icons.event_note,
            color: AppColors.accentOrange,
            title: 'Apply Leave',
            onTap: () {
              // Navigate to leave screen if implemented
              // context.go('/leave');
            },
            isDark: isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildMoreTile(BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.1),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ),
            Icon(Icons.chevron_right, color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
