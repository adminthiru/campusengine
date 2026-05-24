import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';

class AdminAndEvents extends StatelessWidget {
  const AdminAndEvents({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Announcements & Notifications',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _NotificationCard(
            title: 'Staff Meeting Tomorrow',
            time: '2 hours ago',
            icon: Icons.campaign,
            color: AppColors.accentOrange,
            isDark: isDark,
          ),
          _NotificationCard(
            title: 'Term 1 Results Deadline',
            time: '5 hours ago',
            icon: Icons.warning_amber_rounded,
            color: AppColors.error,
            isDark: isDark,
          ),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Leave Status',
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _StatusPill(label: 'Sick Leave (Nov 2)', status: 'Approved', color: AppColors.success, isDark: isDark),
                    const SizedBox(height: 8),
                    _StatusPill(label: 'Casual Leave (Dec 1)', status: 'Pending', color: AppColors.warning, isDark: isDark),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Upcoming Holidays',
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _HolidayTile(name: 'Thanksgiving', date: 'Nov 28', isDark: isDark),
                    _HolidayTile(name: 'Winter Break', date: 'Dec 20', isDark: isDark),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Recent Activity',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _ActivityTimelineItem(
            title: 'Marked Attendance for Grade 10-A',
            time: '09:15 AM',
            isDark: isDark,
            isLast: false,
          ),
          _ActivityTimelineItem(
            title: 'Added Homework for Physics',
            time: '10:45 AM',
            isDark: isDark,
            isLast: false,
          ),
          _ActivityTimelineItem(
            title: 'Approved Leave Request',
            time: '11:30 AM',
            isDark: isDark,
            isLast: true,
          ),
          const SizedBox(height: 32), // Bottom padding for scroll
        ],
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final String title;
  final String time;
  final IconData icon;
  final Color color;
  final bool isDark;

  const _NotificationCard({
    required this.title,
    required this.time,
    required this.icon,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.1),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                Text(
                  time,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: isDark ? AppColors.textMuted : AppColors.textSecondary,
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

class _StatusPill extends StatelessWidget {
  final String label;
  final String status;
  final Color color;
  final bool isDark;

  const _StatusPill({
    required this.label,
    required this.status,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.bgLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                status,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HolidayTile extends StatelessWidget {
  final String name;
  final String date;
  final bool isDark;

  const _HolidayTile({
    required this.name,
    required this.date,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(Icons.event, size: 16, color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                Text(
                  date,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: isDark ? AppColors.textMuted : AppColors.textSecondary,
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

class _ActivityTimelineItem extends StatelessWidget {
  final String title;
  final String time;
  final bool isDark;
  final bool isLast;

  const _ActivityTimelineItem({
    required this.title,
    required this.time,
    required this.isDark,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: isDark ? AppColors.bgDark : AppColors.bgLight, width: 2),
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 40,
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
              ),
          ],
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                time,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: isDark ? AppColors.textMuted : AppColors.textSecondary,
                ),
              ),
              if (!isLast) const SizedBox(height: 16),
            ],
          ),
        ),
      ],
    );
  }
}
