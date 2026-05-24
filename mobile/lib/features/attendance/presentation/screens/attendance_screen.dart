import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'package:skl_teacher/core/models/student.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/features/attendance/presentation/providers/attendance_provider.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';

class _StatusOption {
  final String label;
  final String key;
  final String fullLabel;
  final Color color;
  final Color bg;
  const _StatusOption(
      this.label, this.key, this.fullLabel, this.color, this.bg);
}

const _studentStatuses = [
  _StatusOption(
      'P', 'present', 'Present', AppColors.success, Color(0xFFF0FDF4)),
  _StatusOption('A', 'absent', 'Absent', AppColors.error, Color(0xFFFEF2F2)),
  _StatusOption(
      'H', 'half_day', 'Half Day', AppColors.warning, Color(0xFFFFF7ED)),
  _StatusOption('L', 'late', 'Late', Color(0xFFEAB308), Color(0xFFFFFBEB)),
  _StatusOption(
      'E', 'excused', 'Excused', AppColors.primary, Color(0xFFEEF2FF)),
];

_StatusOption _optFor(String key) => _studentStatuses
    .firstWhere((o) => o.key == key, orElse: () => _studentStatuses.first);

class AttendanceScreen extends StatelessWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AttendanceProvider()..fetchClasses(),
      child: const _AttendanceScreenContent(),
    );
  }
}

class _AttendanceScreenContent extends StatelessWidget {
  const _AttendanceScreenContent();

  void _showSnack(BuildContext context, String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppColors.error : AppColors.success,
    ));
  }

  Widget _dateBar(
      BuildContext context, AttendanceProvider provider, bool isDark) {
    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(Icons.calendar_today_outlined,
              size: 16,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          const SizedBox(width: 8),
          Text(DateFormat('EEE, dd MMM yyyy').format(provider.selectedDate),
              style: AppTypography.s14SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const Spacer(),
          TextButton(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: provider.selectedDate,
                firstDate: DateTime.now().subtract(const Duration(days: 90)),
                lastDate: DateTime.now(),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme: ColorScheme.light(primary: AppColors.primary),
                  ),
                  child: child!,
                ),
              );
              if (picked != null && picked != provider.selectedDate) {
                provider.setDate(picked);
              }
            },
            child: Text('Change',
                style: AppTypography.s14SemiBold(color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  Widget _legend(bool isDark) {
    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _studentStatuses
              .map((o) => Padding(
                    padding: const EdgeInsets.only(right: 14),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: o.color,
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Center(
                            child: Text(o.label,
                                style: AppTypography.s12Bold(color: Colors.white)),
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(o.fullLabel,
                            style: AppTypography.s12Regular(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                      ],
                    ),
                  ))
              .toList(),
        ),
      ),
    );
  }

  Widget _studentCard(
    BuildContext context,
    AttendanceProvider provider,
    Student s,
    bool isDark,
  ) {
    final entry =
        provider.attendanceMap[s.id] ?? {'status': 'present', 'remarks': ''};
    final currentStatus = entry['status'] ?? 'present';
    final opt = _optFor(currentStatus);

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: provider.isSaved
              ? opt.color.withValues(alpha: 0.3)
              : (isDark ? AppColors.borderDark : AppColors.borderLight),
          width: 1.5,
        ),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: opt.bg,
                backgroundImage:
                    s.photo != null ? NetworkImage(s.photo!) : null,
                child: s.photo == null
                    ? Text(
                        s.name.isNotEmpty
                            ? s.name.substring(0, 1).toUpperCase()
                            : 'S',
                        style: AppTypography.s16Bold(color: opt.color),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.name,
                      style: AppTypography.s16SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    if (s.admissionNumber != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        'Adm No: ${s.admissionNumber}',
                        style: AppTypography.s12Regular(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (provider.isSaved)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: opt.bg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: opt.color.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    opt.fullLabel,
                    style: AppTypography.s12Bold(color: opt.color),
                  ),
                ),
            ],
          ),
          if (!provider.isSaved) ...[
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _studentStatuses.map((o) {
                  final isSelected = currentStatus == o.key;
                  final selectedBg =
                      isDark ? o.color.withValues(alpha: 0.25) : o.bg;
                  final unselectedBg =
                      isDark ? Colors.transparent : Colors.white;
                  final borderColor = isSelected
                      ? o.color
                      : (isDark ? AppColors.borderDark : AppColors.borderLight);

                  return InkWell(
                    onTap: () => provider.setStatus(s.id, o.key),
                    borderRadius: BorderRadius.circular(8),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? selectedBg : unselectedBg,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: borderColor, width: 2),
                      ),
                      child: Text(
                        o.label,
                        style: AppTypography.s14Bold(
                          color: isSelected
                              ? o.color
                              : (isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
          if (!provider.isSaved || (entry['remarks'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            if (provider.isSaved)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Remarks: ${entry['remarks']}',
                  style: AppTypography.s12Regular(
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary,
                  ).copyWith(fontStyle: FontStyle.italic),
                ),
              )
            else
              TextFormField(
                initialValue: entry['remarks'] ?? '',
                onChanged: (v) => provider.setRemarks(s.id, v),
                style: AppTypography.s14Regular(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: 'Add remarks (optional)',
                  hintStyle: AppTypography.s12Regular(
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary,
                  ),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  filled: true,
                  fillColor: isDark ? AppColors.bgDark : AppColors.bgLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _studentTab(
      BuildContext context, AttendanceProvider provider, bool isDark) {
    if (provider.isLoadingStudents) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (provider.students.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.groups,
                size: 48,
                color: isDark ? AppColors.textMuted : AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              'No students found',
              style: AppTypography.s16SemiBold(
                color: isDark ? AppColors.textMuted : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      );
    }

    Map<String, int> counts = {};
    if (provider.isSaved) {
      for (final v in provider.attendanceMap.values) {
        final s = v['status'] ?? 'present';
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }

    final className = provider.classes.isNotEmpty
        ? provider.classes.first.fullName
        : 'Loading Class...';

    return Column(
      children: [
        _dateBar(context, provider, isDark),
        _legend(isDark),

        Container(
          margin: const EdgeInsets.all(12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [
                      AppColors.primary.withValues(alpha: 0.15),
                      AppColors.primaryDark.withValues(alpha: 0.05)
                    ]
                  : [
                      AppColors.primary.withValues(alpha: 0.08),
                      AppColors.primary.withValues(alpha: 0.02)
                    ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.school,
                    color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      className,
                      style: AppTypography.s16Bold(
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${provider.students.length} Students Assigned',
                      style: AppTypography.s12Regular(
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
        ),

        if (provider.isSaved)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : AppColors.badgeSuccessBg,
              borderRadius: BorderRadius.circular(10),
              border:
                  Border.all(color: AppColors.success.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle,
                    color: AppColors.success, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: counts.entries.map((e) {
                      final opt = _optFor(e.key);
                      return Text('${opt.fullLabel}: ${e.value}',
                          style: AppTypography.s12SemiBold(color: opt.color));
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 80),
            itemCount: provider.students.length,
            itemBuilder: (ctx, i) =>
                _studentCard(ctx, provider, provider.students[i], isDark),
          ),
        ),

        Container(
          padding: const EdgeInsets.all(12),
          color: isDark ? AppColors.cardDark : AppColors.cardLight,
          child: provider.isSaved
              ? SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: OutlinedButton.icon(
                    onPressed: () => provider.setIsSaved(false),
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: Text('Edit Attendance',
                        style: AppTypography.s14SemiBold()),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                )
              : SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: provider.isSaving
                        ? null
                        : () async {
                            final success = await provider.saveAttendance();
                            if (context.mounted) {
                              if (success) {
                                _showSnack(
                                    context, 'Attendance saved successfully!');
                              } else {
                                _showSnack(
                                    context,
                                    provider.error ??
                                        'Failed to save attendance',
                                    isError: true);
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: provider.isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : Text(
                            'Save Attendance (${provider.students.length} students)',
                            style: AppTypography.s14SemiBold(),
                          ),
                  ),
                ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AttendanceProvider>();
    final profileProvider = context.watch<ProfileProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final isClassTeacher = profileProvider.profile?.isClassTeacher ?? false;
    final markStudentAttendance = profileProvider
            .profile?.permissions.classTeacher.markStudentAttendance ??
        false;
    final showStudentTab = isClassTeacher && markStudentAttendance;

    return Scaffold(
      body: showStudentTab
          ? _studentTab(context, provider, isDark)
          : Center(
              child: Text(
                'You are not authorized to mark student attendance.',
                style: AppTypography.s16Regular(
                  color: isDark ? AppColors.textMuted : AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
    );
  }
}
