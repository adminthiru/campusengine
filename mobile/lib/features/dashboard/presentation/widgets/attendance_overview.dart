import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

class AttendanceOverview extends StatelessWidget {
  const AttendanceOverview({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<DashboardProvider>();

    final present = provider.todayPresent;
    final absent = provider.todayAbsent;
    final total = provider.todayTotal;
    final pct = total > 0 ? ((present / total) * 100).round() : 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Today\'s Attendance',
                style: GoogleFonts.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => context.go('/attendance'),
                child: Text(
                  'Manage',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (provider.isLoading)
            _card(
              isDark,
              const SkeletonShimmer(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Center(child: SkeletonBox(width: 60, height: 36)),
                        ),
                        Expanded(
                          child: Center(child: SkeletonBox(width: 60, height: 36)),
                        ),
                        Expanded(
                          child: Center(child: SkeletonBox(width: 60, height: 36)),
                        ),
                      ],
                    ),
                    SizedBox(height: 16),
                    SkeletonBox(width: double.infinity, height: 8, radius: 6),
                  ],
                ),
              ),
            )
          else if (total == 0)
            _card(
              isDark,
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.fact_check_outlined,
                        color: AppColors.primary, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('No attendance marked yet',
                            style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                        const SizedBox(height: 2),
                        Text('Mark today\'s attendance for your class',
                            style: GoogleFonts.inter(
                                fontSize: 12,
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right,
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                ],
              ),
              onTap: () => context.go('/attendance'),
            )
          else
            _card(
              isDark,
              Column(
                children: [
                  Row(
                    children: [
                      _Metric(
                        label: 'Present',
                        value: present,
                        color: AppColors.success,
                        isDark: isDark,
                      ),
                      _divider(isDark),
                      _Metric(
                        label: 'Absent',
                        value: absent,
                        color: AppColors.error,
                        isDark: isDark,
                      ),
                      _divider(isDark),
                      _Metric(
                        label: 'Total',
                        value: total,
                        color: AppColors.primary,
                        isDark: isDark,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Attendance progress bar
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: total > 0 ? present / total : 0,
                            minHeight: 8,
                            backgroundColor: AppColors.error.withValues(alpha: 0.18),
                            valueColor: const AlwaysStoppedAnimation(
                                AppColors.success),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '$pct%',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.success,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _card(bool isDark, Widget child, {VoidCallback? onTap}) {
    final box = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: child,
    );
    if (onTap == null) return box;
    return GestureDetector(onTap: onTap, child: box);
  }

  Widget _divider(bool isDark) => Container(
        width: 1,
        height: 36,
        color: isDark ? AppColors.borderDark : AppColors.borderLight,
      );
}

class _Metric extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final bool isDark;

  const _Metric({
    required this.label,
    required this.value,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$value',
            style: GoogleFonts.inter(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
