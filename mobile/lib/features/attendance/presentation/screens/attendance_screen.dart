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

// ─── Stateful wrapper so we can toggle Summary view ─────────────────────────
class _AttendanceScreenContent extends StatefulWidget {
  const _AttendanceScreenContent();

  @override
  State<_AttendanceScreenContent> createState() =>
      _AttendanceScreenContentState();
}

class _AttendanceScreenContentState extends State<_AttendanceScreenContent> {
  bool _showSummary = false;

  void _showSnack(BuildContext context, String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppColors.error : AppColors.success,
    ));
  }

  // ── Header (matches timetable screen design exactly) ──────────────────────
  Widget _header(BuildContext context, AttendanceProvider provider,
      String className, bool isDark) {
    final displayClass = className.replaceAll(' ', '');
    final studentCount = provider.students.length;

    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 8, 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('MMMM yyyy').format(provider.selectedDate),
                  style: AppTypography.s20Bold(
                      color: isDark ? Colors.white : AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      'Class Attendance',
                      style: AppTypography.s12Regular(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary),
                    ),
                    if (displayClass.isNotEmpty) ...[
                      Text(
                        '  ·  ',
                        style: AppTypography.s12Regular(
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          displayClass,
                          style: AppTypography.s12Bold(
                              color: AppColors.primary),
                        ),
                      ),
                      if (studentCount > 0) ...[
                        const SizedBox(width: 6),
                        Text(
                          '$studentCount students',
                          style: AppTypography.s12Regular(
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary),
                        ),
                      ],
                    ],
                  ],
                ),
              ],
            ),
          ),
          // Calendar picker icon button (like timetable)
          IconButton(
            icon: const Icon(Icons.calendar_month, color: AppColors.primary),
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: provider.selectedDate,
                firstDate: DateTime.now().subtract(const Duration(days: 90)),
                lastDate: DateTime.now(),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme:
                        const ColorScheme.light(primary: AppColors.primary),
                  ),
                  child: child!,
                ),
              );
              if (picked != null && picked != provider.selectedDate) {
                provider.setDate(picked);
              }
            },
          ),
        ],
      ),
    );
  }

  // ── View toggle (Daily List / Summary) — same pill as timetable ───────────
  Widget _viewToggle(bool showSummary, bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.borderDark.withValues(alpha: 0.5)
            : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showSummary = false),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: !showSummary
                      ? (isDark ? AppColors.cardDark : Colors.white)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: !showSummary
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          )
                        ]
                      : [],
                ),
                child: Center(
                  child: Text(
                    'Daily List',
                    style: AppTypography.s12SemiBold(
                      color: !showSummary
                          ? (isDark ? Colors.white : AppColors.textPrimary)
                          : (isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showSummary = true),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: showSummary
                      ? (isDark ? AppColors.cardDark : Colors.white)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: showSummary
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          )
                        ]
                      : [],
                ),
                child: Center(
                  child: Text(
                    'Summary',
                    style: AppTypography.s12SemiBold(
                      color: showSummary
                          ? (isDark ? Colors.white : AppColors.textPrimary)
                          : (isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Full-month calendar strip ─────────────────────────────────────────────
  Widget _calendarStrip(
      BuildContext context, AttendanceProvider provider, bool isDark) {
    final today = DateTime.now();
    final selectedDate = provider.selectedDate;

    final firstOfMonth = DateTime(today.year, today.month, 1);
    final totalDays = today.day;
    final dates = List.generate(
      totalDays,
      (i) => firstOfMonth.add(Duration(days: i)),
    );

    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        controller: ScrollController(
            initialScrollOffset:
                ((selectedDate.day - 1).clamp(0, totalDays - 1)) * 56.0),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: dates.map((date) {
            final isSelected = DateUtils.isSameDay(date, provider.selectedDate);
            final isToday = DateUtils.isSameDay(date, today);

            final dayName = DateFormat('E').format(date);
            final dayNum = DateFormat('d').format(date);

            return GestureDetector(
              onTap: () => provider.setDate(date),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(right: 10),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  gradient: isSelected
                      ? const LinearGradient(
                          colors: [AppColors.primary, AppColors.primaryDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: isSelected
                      ? null
                      : (isToday
                          ? AppColors.primary.withValues(alpha: 0.15)
                          : Colors.transparent),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? Colors.transparent
                        : (isToday
                            ? AppColors.primary.withValues(alpha: 0.4)
                            : (isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight)),
                    width: 1.5,
                  ),
                ),
                child: Column(
                  children: [
                    Text(
                      dayName,
                      style: AppTypography.s12Medium(
                        color: isSelected
                            ? Colors.white
                            : (isToday
                                ? AppColors.primary
                                : (isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      dayNum,
                      style: AppTypography.s16Bold(
                        color: isSelected
                            ? Colors.white
                            : (isToday
                                ? AppColors.primary
                                : (isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ── Summary grid view ─────────────────────────────────────────────────────
  Widget _summaryView(AttendanceProvider provider, bool isDark) {
    Map<String, int> counts = {};
    for (final v in provider.attendanceMap.values) {
      final s = v['status'] ?? 'present';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    final total = provider.students.length;

    return Expanded(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Total count card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                const Icon(Icons.groups_rounded,
                    color: Colors.white, size: 28),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$total',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Total Students',
                      style: AppTypography.s12Regular(
                          color: Colors.white.withValues(alpha: 0.8)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Status breakdown cards
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.6,
            children: _studentStatuses.map((o) {
              final count = counts[o.key] ?? 0;
              final pct = total > 0 ? (count / total * 100).round() : 0;
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.cardDark : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: o.color.withValues(alpha: 0.25),
                    width: 1.5,
                  ),
                  boxShadow: isDark
                      ? []
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          )
                        ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: o.color,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            o.label,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '$pct%',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: o.color,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$count',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          o.fullLabel,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ── Bottom sheet to edit attendance ──────────────────────────────────────
  void _showEditBottomSheet(
    BuildContext context,
    AttendanceProvider provider,
    Student s,
    bool isDark,
  ) {
    final entry =
        provider.attendanceMap[s.id] ?? {'status': 'present', 'remarks': ''};
    String tempStatus = entry['status'] ?? 'present';
    final TextEditingController remarksController =
        TextEditingController(text: entry['remarks'] ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setState) {
            final bottomSpace = MediaQuery.of(context).viewInsets.bottom;

            return Container(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomSpace),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundImage:
                            s.photo != null ? NetworkImage(s.photo!) : null,
                        child: s.photo == null
                            ? Text(s.name.substring(0, 1).toUpperCase())
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              s.name,
                              style: AppTypography.s16Bold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary),
                            ),
                            Text(
                              s.admissionNumber != null
                                  ? 'Adm No: ${s.admissionNumber}'
                                  : 'Student',
                              style: AppTypography.s12Regular(
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Select Status',
                    style: AppTypography.s12SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: _studentStatuses.map((o) {
                      final isSelected = tempStatus == o.key;
                      return InkWell(
                        onTap: () {
                          setState(() {
                            tempStatus = o.key;
                          });
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          width: 58,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? o.color.withValues(alpha: 0.15)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? o.color
                                  : (isDark
                                      ? AppColors.borderDark
                                      : AppColors.borderLight),
                              width: 2,
                            ),
                          ),
                          child: Column(
                            children: [
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: o.color,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  o.label,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                o.fullLabel,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected
                                      ? o.color
                                      : (isDark
                                          ? AppColors.textMuted
                                          : AppColors.textSecondary),
                                ),
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Remarks',
                    style: AppTypography.s12SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: remarksController,
                    style: AppTypography.s14Regular(
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Enter attendance remarks (optional)',
                      hintStyle: AppTypography.s12Regular(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary,
                      ),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
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
                        borderSide:
                            const BorderSide(color: AppColors.primary),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            side: BorderSide(
                                color: isDark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: Text(
                            'Cancel',
                            style: AppTypography.s14Medium(
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            provider.setStatus(s.id, tempStatus);
                            provider.setRemarks(
                                s.id, remarksController.text);
                            Navigator.pop(ctx);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: Text(
                            'Update',
                            style: AppTypography.s14Bold(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ── Single student row card ───────────────────────────────────────────────
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
    final remark = entry['remarks'] ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(10),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: InkWell(
                  onTap: provider.isSaved
                      ? null
                      : () =>
                          _showEditBottomSheet(context, provider, s, isDark),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12.0, vertical: 10.0),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: opt.color.withValues(alpha: 0.15),
                          backgroundImage: s.photo != null
                              ? NetworkImage(s.photo!)
                              : null,
                          child: s.photo == null
                              ? Text(
                                  s.name.isNotEmpty
                                      ? s.name.substring(0, 1).toUpperCase()
                                      : 'S',
                                  style: AppTypography.s14Bold(
                                      color: opt.color),
                                )
                              : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Flexible(
                                    child: Text(
                                      s.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.inter(
                                        size: 13,
                                        weight: FontWeight.w700,
                                        color: isDark
                                            ? Colors.white
                                            : AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  if (remark.isNotEmpty) ...[
                                    const SizedBox(width: 5),
                                    Icon(
                                      Icons.speaker_notes_rounded,
                                      size: 11,
                                      color: isDark
                                          ? AppColors.textMuted
                                          : AppColors.textSecondary,
                                    ),
                                  ],
                                ],
                              ),
                              if (currentStatus != 'present') ...[
                                const SizedBox(height: 2),
                                Text(
                                  remark.isNotEmpty
                                      ? '${opt.fullLabel} · $remark'
                                      : opt.fullLabel,
                                  style: AppTypography.inter(
                                    size: 10,
                                    weight: FontWeight.w600,
                                    color: opt.color,
                                  ),
                                ),
                              ] else if (remark.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  remark,
                                  style: AppTypography.inter(
                                    size: 10,
                                    weight: FontWeight.w500,
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              // Right status tab (coloured)
              InkWell(
                onTap: provider.isSaved
                    ? null
                    : () =>
                        _showEditBottomSheet(context, provider, s, isDark),
                child: Container(
                  width: 46,
                  color: opt.color,
                  alignment: Alignment.center,
                  child: Text(
                    opt.label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── FAB: Save / Edit ──────────────────────────────────────────────────────
  Widget? _buildFAB(
      BuildContext context, AttendanceProvider provider, bool isDark) {
    if (provider.isLoadingStudents || provider.students.isEmpty) return null;

    if (provider.isSaved) {
      return FloatingActionButton.extended(
        onPressed: () => provider.setIsSaved(false),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.edit_rounded, color: Colors.white, size: 20),
        label: const Text(
          'Edit Attendance',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
        ),
      );
    } else {
      return FloatingActionButton.extended(
        onPressed: provider.isSaving
            ? null
            : () async {
                final success = await provider.saveAttendance();
                if (context.mounted) {
                  if (success) {
                    _showSnack(context, 'Attendance saved successfully!');
                  } else {
                    _showSnack(
                      context,
                      provider.error ?? 'Failed to save attendance',
                      isError: true,
                    );
                  }
                }
              },
        backgroundColor: AppColors.primary,
        icon: provider.isSaving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.check_rounded, color: Colors.white, size: 20),
        label: Text(
          provider.isSaving ? 'Saving...' : 'Save Attendance',
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
        ),
      );
    }
  }

  // ── Daily List view ───────────────────────────────────────────────────────
  Widget _dailyListView(
      BuildContext context, AttendanceProvider provider, bool isDark) {
    if (provider.isLoadingStudents) {
      return const Expanded(
        child:
            Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }
    if (provider.students.isEmpty) {
      return Expanded(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.groups_rounded,
                  size: 52,
                  color: isDark ? AppColors.textMuted : AppColors.textSecondary),
              const SizedBox(height: 14),
              Text(
                'No students found',
                style: AppTypography.s16SemiBold(
                  color: isDark ? AppColors.textMuted : AppColors.textSecondary,
                ),
              ),
            ],
          ),
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

    // Alphabetical Sorting & Grouping
    final sortedStudents = List<Student>.from(provider.students)
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    final List<Widget> listItems = [];
    String lastLetter = '';

    for (final student in sortedStudents) {
      final firstLetter =
          student.name.isNotEmpty ? student.name[0].toUpperCase() : '';

      if (firstLetter != lastLetter && firstLetter.isNotEmpty) {
        lastLetter = firstLetter;
        listItems.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text(
              lastLetter,
              style: AppTypography.s14Bold(
                color: isDark ? AppColors.textMuted : Colors.grey[700],
              ),
            ),
          ),
        );
      }

      listItems.add(
        _studentCard(context, provider, student, isDark),
      );
    }

    return Expanded(
      child: Column(
        children: [
          // Saved summary banner
          if (provider.isSaved)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : AppColors.badgeSuccessBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded,
                      color: AppColors.success, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: counts.entries.map((e) {
                        final opt = _optFor(e.key);
                        return Text('${opt.fullLabel}: ${e.value}',
                            style: AppTypography.s12SemiBold(
                                color: opt.color));
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(top: 4, bottom: 80),
              children: listItems,
            ),
          ),
        ],
      ),
    );
  }

  // ── Main build ────────────────────────────────────────────────────────────
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

    final className = provider.classes.isNotEmpty
        ? provider.classes.first.fullName
        : '';

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: SafeArea(
        child: showStudentTab
            ? Column(
                children: [
                  // Timetable-style header
                  _header(context, provider, className, isDark),
                  // Daily List / Summary toggle
                  _viewToggle(_showSummary, isDark),
                  if (_showSummary)
                    // Summary grid
                    _summaryView(provider, isDark)
                  else ...[
                    // Calendar date strip
                    _calendarStrip(context, provider, isDark),
                    // Student list
                    _dailyListView(context, provider, isDark),
                  ],
                ],
              )
            : Center(
                child: Text(
                  'You are not authorized to mark student attendance.',
                  style: AppTypography.s16Regular(
                    color: isDark
                        ? AppColors.textMuted
                        : AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
      ),
      floatingActionButton:
          showStudentTab ? _buildFAB(context, provider, isDark) : null,
    );
  }
}
