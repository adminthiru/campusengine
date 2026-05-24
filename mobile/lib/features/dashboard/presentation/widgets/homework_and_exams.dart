import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/dashboard_provider.dart';

class HomeworkAndExams extends StatelessWidget {
  const HomeworkAndExams({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final provider = context.watch<DashboardProvider>();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Active Homework',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              Text(
                'View All',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (provider.isLoading)
            const Center(child: CircularProgressIndicator())
          else if (provider.activeHomework.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24.0),
                child: Text(
                  'No active homework assigned.',
                  style: GoogleFonts.inter(
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                ),
              ),
            )
          else
            ...provider.activeHomework.take(3).map((hw) {
              final submitted =
                  0; // Homework model needs to have submissions count, mock for now
              final total = 0; // Total count available on detailed fetch
              final dueDateStr =
                  hw.dueDate?.split('T')[0] ?? ''; // Basic format

              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: _HomeworkCard(
                  subject: hw.subject?.name ?? 'Unknown Subject',
                  className:
                      '${hw.classRef?.name ?? ''} ${hw.classRef?.section ?? ''}'
                          .trim(),
                  title: hw.title,
                  submitted: submitted,
                  total: total,
                  dueDate: dueDateStr,
                  isDark: isDark,
                ),
              );
            }),
          const SizedBox(height: 24),
          Text(
            'Upcoming Exams',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _ExamCard(
                  subject: 'Chemistry Midterm',
                  date: 'Nov 15',
                  className: 'Grade 12-B',
                  isDark: isDark,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ExamCard(
                  subject: 'Math Quiz',
                  date: 'Nov 18',
                  className: 'Grade 10-A',
                  isDark: isDark,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  final String subject;
  final String className;
  final String title;
  final int submitted;
  final int total;
  final String dueDate;
  final bool isDark;

  const _HomeworkCard({
    required this.subject,
    required this.className,
    required this.title,
    required this.submitted,
    required this.total,
    required this.dueDate,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final double progress = total > 0 ? submitted / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.bgDark : AppColors.bgLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  subject,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
              Text(
                'Due $dueDate',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            className,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Submissions',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: isDark ? AppColors.textMuted : AppColors.textSecondary,
                ),
              ),
              Text(
                '$submitted/$total',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress,
            backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
            valueColor: AlwaysStoppedAnimation<Color>(
              progress == 1.0 ? AppColors.success : AppColors.primary,
            ),
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  final String subject;
  final String date;
  final String className;
  final bool isDark;

  const _ExamCard({
    required this.subject,
    required this.date,
    required this.className,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.bgLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.assignment_turned_in,
              color: AppColors.accentPurple, size: 24),
          const SizedBox(height: 12),
          Text(
            subject,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            className,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: isDark ? 0.1 : 0.5),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.calendar_today,
                    size: 12,
                    color: isDark ? Colors.white70 : AppColors.textPrimary),
                const SizedBox(width: 4),
                Text(
                  date,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
