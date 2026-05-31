import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/models/student.dart';

class StudentAttendanceTile extends StatelessWidget {
  final Student student;
  final String currentStatus;
  final Function(String) onStatusChanged;
  final bool isDark;

  const StudentAttendanceTile({
    super.key,
    required this.student,
    required this.currentStatus,
    required this.onStatusChanged,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 12),
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
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                backgroundImage:
                    student.photo != null ? NetworkImage(student.photo!) : null,
                child: student.photo == null
                    ? Text(
                        student.name.substring(0, 1).toUpperCase(),
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.name,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Adm No: ${student.admissionNumber}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _StatusButton(
                  label: 'P',
                  fullLabel: 'Present',
                  value: 'present',
                  color: const Color(0xFF10B981),
                  bg: const Color(0xFFF0FDF4),
                  currentStatus: currentStatus,
                  onTap: () => onStatusChanged('present'),
                ),
                const SizedBox(width: 8),
                _StatusButton(
                  label: 'A',
                  fullLabel: 'Absent',
                  value: 'absent',
                  color: const Color(0xFFEF4444),
                  bg: const Color(0xFFFEF2F2),
                  currentStatus: currentStatus,
                  onTap: () => onStatusChanged('absent'),
                ),
                const SizedBox(width: 8),
                _StatusButton(
                  label: 'H',
                  fullLabel: 'Half Day',
                  value: 'half_day',
                  color: const Color(0xFFF97316),
                  bg: const Color(0xFFFFF7ED),
                  currentStatus: currentStatus,
                  onTap: () => onStatusChanged('half_day'),
                ),
                const SizedBox(width: 8),
                _StatusButton(
                  label: 'L',
                  fullLabel: 'Late',
                  value: 'late',
                  color: const Color(0xFFF59E0B),
                  bg: const Color(0xFFFFFBEB),
                  currentStatus: currentStatus,
                  onTap: () => onStatusChanged('late'),
                ),
                const SizedBox(width: 8),
                _StatusButton(
                  label: 'E',
                  fullLabel: 'Excused',
                  value: 'excused',
                  color: const Color(0xFF6366F1),
                  bg: const Color(0xFFEEF2FF),
                  currentStatus: currentStatus,
                  onTap: () => onStatusChanged('excused'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusButton extends StatelessWidget {
  final String label;
  final String fullLabel;
  final String value;
  final Color color;
  final Color bg;
  final String currentStatus;
  final VoidCallback onTap;

  const _StatusButton({
    required this.label,
    required this.fullLabel,
    required this.value,
    required this.color,
    required this.bg,
    required this.currentStatus,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = currentStatus == value;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final selectedBg = isDark ? color.withValues(alpha: 0.2) : bg;
    final unselectedBg = isDark ? Colors.transparent : Colors.white;
    final borderColor = isSelected
        ? color
        : (isDark ? AppColors.borderDark : AppColors.borderLight);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? selectedBg : unselectedBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: borderColor, width: 2),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? color
                    : (isDark ? AppColors.textMuted : AppColors.textSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
