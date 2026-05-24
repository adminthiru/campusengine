import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:intl/intl.dart';

class ScheduleAndTasks extends StatelessWidget {
  const ScheduleAndTasks({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final provider = context.watch<DashboardProvider>();

    // Determine today's day string (e.g. "Monday")
    final todayStr = DateFormat('EEEE').format(DateTime.now());

    // Extract today's periods from all timetables assigned to this teacher
    final List<Map<String, dynamic>> todaysPeriods = [];
    
    for (var tt in provider.timetables) {
      final className = tt['class']?['name'] ?? '';
      final section = tt['class']?['section'] ?? '';
      final classFullName = '$className $section'.trim();
      
      final schedule = tt['schedule'] as List?;
      if (schedule != null) {
        for (var daySchedule in schedule) {
          if (daySchedule['day']?.toString().toLowerCase() == todayStr.toLowerCase()) {
            final periods = daySchedule['periods'] as List?;
            if (periods != null) {
              for (var period in periods) {
                // If it's a valid period
                if (period['subject'] != null) {
                  todaysPeriods.add({
                    'subject': period['subject']['name'] ?? 'Subject',
                    'class': classFullName,
                    'periodNumber': period['periodNumber'],
                    'time': 'Period ${period['periodNumber']}', // We don't have absolute times easily available here
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Sort by period number
    todaysPeriods.sort((a, b) => (a['periodNumber'] as int).compareTo(b['periodNumber'] as int));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Today\'s Schedule',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          // Horizontal timeline/schedule
          if (provider.isLoading)
            const Center(child: CircularProgressIndicator())
          else if (todaysPeriods.isEmpty)
            Text(
              'No classes scheduled for today ($todayStr).',
              style: GoogleFonts.inter(color: isDark ? AppColors.textMuted : AppColors.textSecondary),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: todaysPeriods.map((period) {
                  final idx = todaysPeriods.indexOf(period);
                  final colors = [AppColors.primary, AppColors.accentOrange, AppColors.accentPurple];
                  final color = colors[idx % colors.length];
                  
                  return Padding(
                    padding: const EdgeInsets.only(right: 12.0),
                    child: _ClassCard(
                      subject: period['subject'],
                      className: period['class'],
                      time: period['time'],
                      isActive: idx == 0, // Mock current period
                      isDark: isDark,
                      color: color,
                    ),
                  );
                }).toList(),
              ),
            ),
          const SizedBox(height: 24),
          Text(
            'Pending Tasks',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _TaskTile(taskName: 'Grade 10-A Midterm Papers', isCompleted: false, isDark: isDark),
          _TaskTile(taskName: 'Update Attendance for Friday', isCompleted: false, isDark: isDark),
          _TaskTile(taskName: 'Prepare Chemistry Lab', isCompleted: true, isDark: isDark),
        ],
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final String subject;
  final String className;
  final String time;
  final bool isActive;
  final bool isDark;
  final Color color;

  const _ClassCard({
    required this.subject,
    required this.className,
    required this.time,
    required this.isActive,
    required this.isDark,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isActive 
          ? color 
          : (isDark ? AppColors.cardDark : Colors.white),
        borderRadius: BorderRadius.circular(16),
        border: isActive ? null : Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isActive ? AppColors.shadowMd : (isDark ? [] : AppColors.shadowSm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                className,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isActive ? Colors.white70 : (isDark ? AppColors.textMuted : AppColors.textSecondary),
                ),
              ),
              if (isActive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'NOW',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            subject,
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : (isDark ? Colors.white : AppColors.textPrimary),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.schedule, size: 14, color: isActive ? Colors.white70 : (isDark ? AppColors.textMuted : AppColors.textMuted)),
              const SizedBox(width: 4),
              Text(
                time,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: isActive ? Colors.white70 : (isDark ? AppColors.textMuted : AppColors.textMuted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  final String taskName;
  final bool isCompleted;
  final bool isDark;

  const _TaskTile({
    required this.taskName,
    required this.isCompleted,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(
            isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
            color: isCompleted ? AppColors.success : (isDark ? AppColors.textMuted : AppColors.textMuted),
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              taskName,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: isCompleted 
                    ? (isDark ? AppColors.textMuted : AppColors.textMuted) 
                    : (isDark ? Colors.white : AppColors.textPrimary),
                decoration: isCompleted ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
