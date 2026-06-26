import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/models/homework.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

/// Active homework summary on the dashboard (real data only).
class HomeworkAndExams extends StatelessWidget {
  const HomeworkAndExams({super.key});

  Color _hexToColor(String? hex) {
    if (hex == null || hex.isEmpty) return AppColors.primary;
    var h = hex.replaceFirst('#', '');
    if (h.length == 6) h = 'ff$h';
    final v = int.tryParse(h, radix: 16);
    return v == null ? AppColors.primary : Color(v);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<DashboardProvider>();
    final items = provider.activeHomework;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Active Homework',
                style: GoogleFonts.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              if (items.isNotEmpty) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text('${items.length}',
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary)),
                ),
              ],
              const Spacer(),
              GestureDetector(
                onTap: () => context.go('/homework'),
                child: Text(
                  'View All',
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
            const SkeletonList(
              count: 3,
              itemHeight: 70,
              showLeading: false,
              padding: EdgeInsets.zero,
            )
          else if (items.isEmpty)
            _EmptyState(isDark: isDark)
          else
            ...items.take(3).map((hw) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _HomeworkCard(
                    hw: hw,
                    color: _hexToColor(hw.subject?.color),
                    isDark: isDark,
                    onTap: () => context.go('/homework'),
                  ),
                )),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool isDark;
  const _EmptyState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(
        children: [
          Icon(Icons.assignment_outlined,
              size: 36,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          const SizedBox(height: 8),
          Text('No active homework',
              style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const SizedBox(height: 2),
          Text('Assigned homework will appear here',
              style: GoogleFonts.inter(
                  fontSize: 12,
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  final Homework hw;
  final Color color;
  final bool isDark;
  final VoidCallback onTap;

  const _HomeworkCard({
    required this.hw,
    required this.color,
    required this.isDark,
    required this.onTap,
  });

  String _dueLabel() {
    if (hw.dueDate == null) return '';
    final due = DateTime.tryParse(hw.dueDate!);
    if (due == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dueDay = DateTime(due.year, due.month, due.day);
    final diff = dueDay.difference(today).inDays;
    if (diff == 0) return 'Due today';
    if (diff == 1) return 'Due tomorrow';
    if (diff < 0) return 'Overdue';
    return 'Due ${DateFormat('dd MMM').format(due)}';
  }

  @override
  Widget build(BuildContext context) {
    final dueLabel = _dueLabel();
    final isOverdue = dueLabel == 'Overdue' || dueLabel == 'Due today';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Row(
          children: [
            // Color accent bar
            Container(
              width: 4,
              height: 42,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hw.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (hw.subject != null) ...[
                        Flexible(
                          child: Text(
                            hw.subject!.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: color,
                            ),
                          ),
                        ),
                        Text(' · ',
                            style: GoogleFonts.inter(
                                fontSize: 12, color: AppColors.textMuted)),
                      ],
                      Text(
                        hw.classRef?.fullName ?? '',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (dueLabel.isNotEmpty)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (isOverdue ? AppColors.error : AppColors.info)
                      .withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  dueLabel,
                  style: GoogleFonts.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: isOverdue ? AppColors.error : AppColors.info,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
