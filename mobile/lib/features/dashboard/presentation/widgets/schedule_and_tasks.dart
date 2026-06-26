import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:intl/intl.dart';

/// Today's class schedule for the teacher (real timetable data only).
class ScheduleAndTasks extends StatelessWidget {
  const ScheduleAndTasks({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<DashboardProvider>();

    final todayStr = DateFormat('EEEE').format(DateTime.now());

    // Extract today's periods from all timetables assigned to this teacher
    final List<Map<String, dynamic>> todaysPeriods = [];
    for (var tt in provider.timetables) {
      final className = tt['class']?['name'] ?? '';
      final section = tt['class']?['section'] ?? '';
      final classFullName = '$className $section'.trim();

      final schedule = tt['schedule'] as List?;
      if (schedule == null) continue;
      for (var daySchedule in schedule) {
        if (daySchedule['day']?.toString().toLowerCase() !=
            todayStr.toLowerCase()) {
          continue;
        }
        final periods = daySchedule['periods'] as List?;
        if (periods == null) continue;
        for (var period in periods) {
          if (period['subject'] != null) {
            final pNum = (period['periodNumber'] as num?)?.toInt() ?? 0;
            todaysPeriods.add({
              'subject': period['subject']['name'] ?? 'Subject',
              'class': classFullName,
              'periodNumber': pNum,
            });
          }
        }
      }
    }
    todaysPeriods.sort((a, b) =>
        (a['periodNumber'] as int).compareTo(b['periodNumber'] as int));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Today\'s Schedule',
                style: GoogleFonts.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => context.go('/timetable'),
                child: Text(
                  'Timetable',
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
            const SizedBox(
              height: 116,
              child: SkeletonShimmer(
                child: Row(
                  children: [
                    SkeletonBox(width: 170, height: 116, radius: 16),
                    SizedBox(width: 12),
                    SkeletonBox(width: 170, height: 116, radius: 16),
                  ],
                ),
              ),
            )
          else if (todaysPeriods.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: Column(
                children: [
                  Icon(Icons.event_available_outlined,
                      size: 36,
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                  const SizedBox(height: 8),
                  Text('No classes today',
                      style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color:
                              isDark ? Colors.white : AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text('Enjoy your $todayStr',
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary)),
                ],
              ),
            )
          else
            SizedBox(
              height: 116,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: todaysPeriods.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final p = todaysPeriods[i];
                  final palette = [
                    AppColors.primary,
                    AppColors.accentOrange,
                    AppColors.accentPurple,
                    AppColors.accentGreen,
                  ];
                  return _PeriodCard(
                    period: p['periodNumber'] as int,
                    subject: p['subject'] as String,
                    className: p['class'] as String,
                    color: palette[i % palette.length],
                    isDark: isDark,
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _PeriodCard extends StatelessWidget {
  final int period;
  final String subject;
  final String className;
  final Color color;
  final bool isDark;

  const _PeriodCard({
    required this.period,
    required this.subject,
    required this.className,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 170,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Period $period',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            subject,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.class_outlined,
                  size: 13,
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  className,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: isDark
                        ? AppColors.textMuted
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
