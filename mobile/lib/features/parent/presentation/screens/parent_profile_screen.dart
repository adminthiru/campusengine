import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';

class ParentProfileScreen extends StatelessWidget {
  const ParentProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final initials = (user?.name ?? 'P').substring(0, 1).toUpperCase();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Avatar + name card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Text(
                    initials,
                    style: GoogleFonts.inter(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? '',
                        style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Parent',
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.primary),
                      ),
                      if (user?.phone != null && user!.phone!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          user.phone!,
                          style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Logout tile
          GestureDetector(
            onTap: () => auth.logout(),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.accentRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.logout, color: AppColors.accentRed, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Logout',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.accentRed,
                          ),
                        ),
                        Text(
                          'Sign out of your account',
                          style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
