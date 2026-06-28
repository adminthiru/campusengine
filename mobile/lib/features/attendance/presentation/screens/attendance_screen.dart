import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'package:skl_teacher/core/models/student.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
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
    // ProfileProvider already holds the teacher profile loaded at login.
    // Read classInfo from it directly — no duplicate /teacher/my-profile fetch.
    final classInfo = context
        .read<ProfileProvider>()
        .profile
        ?.classTeacher
        ?.classInfo;

    return ChangeNotifierProvider(
      create: (_) {
        final provider = AttendanceProvider();
        if (classInfo != null) {
          provider.initWithKnownClass(classInfo);
          provider.fetchStudents();
        } else {
          provider.fetchClasses();
        }
        return provider;
      },
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

  // ── Header ──────────────────────────────────────────────────────────────────
  Widget _header(BuildContext context, AttendanceProvider provider,
      String className, bool isDark) {
    final today = DateTime.now();
    final viewYear = provider.selectedDate.year;
    final viewMonth = provider.selectedDate.month;
    final firstOfMonth = DateTime(viewYear, viewMonth, 1);
    final isCurrentMonth = viewYear == today.year && viewMonth == today.month;
    final earliestMonth = DateTime(today.year - 1, today.month, 1);
    final canGoPrev = firstOfMonth.isAfter(earliestMonth);
    final canGoNext = !isCurrentMonth;

    void goToPrevMonth() {
      if (!canGoPrev) return;
      final prev = DateTime(viewYear, viewMonth - 1, 1);
      final lastOfPrev = DateTime(prev.year, prev.month + 1, 0).day;
      provider.setDate(DateTime(prev.year, prev.month, lastOfPrev));
    }

    void goToNextMonth() {
      if (!canGoNext) return;
      final next = DateTime(viewYear, viewMonth + 1, 1);
      final nextIsCurrent =
          next.year == today.year && next.month == today.month;
      provider
          .setDate(nextIsCurrent ? today : DateTime(next.year, next.month, 1));
    }

    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Row 1: label + class badge ───────────────────────────────────
          Row(
            children: [
              Text(
                'Mark Attendance',
                style: AppTypography.s12Regular(
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary),
              ),
              const Spacer(),
              if (className.isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    className,
                    style: AppTypography.s12SemiBold(color: AppColors.primary),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          // ── Row 2: ← Month Year → (plain icons, no containers) ──────────
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: Icon(
                  Icons.chevron_left_rounded,
                  color: canGoPrev
                      ? (isDark ? Colors.white : AppColors.textPrimary)
                      : (isDark
                          ? AppColors.textMuted.withValues(alpha: 0.3)
                          : Colors.grey.shade300),
                ),
                onPressed: canGoPrev ? goToPrevMonth : null,
                splashRadius: 20,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
              const SizedBox(width: 8),
              Text(
                DateFormat('MMMM yyyy').format(firstOfMonth),
                style: AppTypography.s16Bold(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: Icon(
                  Icons.chevron_right_rounded,
                  color: canGoNext
                      ? (isDark ? Colors.white : AppColors.textPrimary)
                      : (isDark
                          ? AppColors.textMuted.withValues(alpha: 0.3)
                          : Colors.grey.shade300),
                ),
                onPressed: canGoNext ? goToNextMonth : null,
                splashRadius: 20,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── View toggle (Daily List / Summary) ───────────────────────────────────
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
          _ToggleTab(
            label: 'Daily List',
            selected: !showSummary,
            isDark: isDark,
            onTap: () => setState(() => _showSummary = false),
          ),
          _ToggleTab(
            label: 'Summary',
            selected: showSummary,
            isDark: isDark,
            onTap: () => setState(() => _showSummary = true),
          ),
        ],
      ),
    );
  }

  // ── Day-strip calendar (no navigator — header owns it) ─────────────────────
  Widget _calendarStrip(
      BuildContext context, AttendanceProvider provider, bool isDark) {
    final today = DateTime.now();
    final selectedDate = provider.selectedDate;
    final viewYear = selectedDate.year;
    final viewMonth = selectedDate.month;
    final firstOfMonth = DateTime(viewYear, viewMonth, 1);
    final isCurrentMonth = viewYear == today.year && viewMonth == today.month;
    final lastDay =
        isCurrentMonth ? today.day : DateTime(viewYear, viewMonth + 1, 0).day;

    final dates =
        List.generate(lastDay, (i) => firstOfMonth.add(Duration(days: i)));

    final scrollOffset = ((selectedDate.day - 1).clamp(0, lastDay - 1)) * 56.0;

    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        controller: ScrollController(initialScrollOffset: scrollOffset),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
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
    final Map<String, int> counts = {};
    for (final v in provider.attendanceMap.values) {
      final s = v['status'] ?? 'present';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    final total = provider.students.length;
    final presentCount = counts['present'] ?? 0;
    final absentCount = counts['absent'] ?? 0;
    final pct = total > 0 ? (presentCount / total * 100).round() : 0;

    return Expanded(
      child: RefreshIndicator(
        onRefresh: () => provider.fetchStudents(),
        child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
        children: [
          // ── Hero card ───────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 14,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── top row: text left, ring right ──────────────────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // text block — Expanded so it never overflows
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$total',
                            style: AppTypography.s32Bold(color: Colors.white),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Total Students',
                            style: AppTypography.s14Regular(
                                color: Colors.white.withValues(alpha: 0.85)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$presentCount present · $absentCount absent',
                            style: AppTypography.s12Regular(
                                color: Colors.white.withValues(alpha: 0.7)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    // Ring chart — fixed 80×80 so layout is stable
                    SizedBox(
                      width: 80,
                      height: 80,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          CircularProgressIndicator(
                            value: total > 0 ? presentCount / total : 0,
                            strokeWidth: 7,
                            backgroundColor:
                                Colors.white.withValues(alpha: 0.25),
                            valueColor:
                                const AlwaysStoppedAnimation(Colors.white),
                          ),
                          Center(
                            child: Text(
                              '$pct%',
                              style: AppTypography.s16Bold(color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // ── progress bar ─────────────────────────────────────────
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: total > 0 ? presentCount / total : 0,
                    backgroundColor: Colors.white.withValues(alpha: 0.25),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                    minHeight: 5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Section label ───────────────────────────────────────────────
          Text(
            'BREAKDOWN',
            style: AppTypography.s12SemiBold(
                color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          ),
          const SizedBox(height: 10),

          // ── Status breakdown — plain list, no Spacer() ─────────────────
          ..._studentStatuses.map((o) {
            final count = counts[o.key] ?? 0;
            final barPct = total > 0 ? count / total : 0.0;
            final labelPct = total > 0 ? (count / total * 100).round() : 0;

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight,
                ),
                boxShadow: isDark ? [] : AppColors.shadowSm,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // top row: icon + label + count + %
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: o.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          o.label,
                          style: TextStyle(
                            color: o.color,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          o.fullLabel,
                          style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                      ),
                      Text(
                        '$count',
                        style: AppTypography.s20Bold(
                          color: isDark ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 38,
                        child: Text(
                          '$labelPct%',
                          style: AppTypography.s13SemiBold(color: o.color),
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: barPct.toDouble(),
                      backgroundColor: o.color.withValues(alpha: 0.12),
                      valueColor: AlwaysStoppedAnimation(o.color),
                      minHeight: 5,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
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
                        borderSide: const BorderSide(color: AppColors.primary),
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
                            provider.setRemarks(s.id, remarksController.text);
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
                          backgroundImage:
                              s.photo != null ? NetworkImage(s.photo!) : null,
                          child: s.photo == null
                              ? Text(
                                  s.name.isNotEmpty
                                      ? s.name.substring(0, 1).toUpperCase()
                                      : 'S',
                                  style:
                                      AppTypography.s14Bold(color: opt.color),
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
                    : () => _showEditBottomSheet(context, provider, s, isDark),
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
      // Edit button — amber/orange to distinguish from Save
      return FloatingActionButton.extended(
        onPressed: () => provider.setIsSaved(false),
        backgroundColor: const Color(0xFFF59E0B), // amber
        elevation: 4,
        icon: const Icon(Icons.edit_rounded, color: Colors.white, size: 20),
        label: const Text(
          'Edit Attendance',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
        ),
      );
    } else {
      // Save button — green to signal a positive action
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
        backgroundColor: const Color(0xFF16A34A), // green-600
        elevation: 4,
        icon: provider.isSaving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.check_circle_rounded,
                color: Colors.white, size: 20),
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
        child: SkeletonList(itemHeight: 60),
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
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary),
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
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : AppColors.badgeSuccessBg,
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: AppColors.success.withValues(alpha: 0.3)),
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
                            style: AppTypography.s12SemiBold(color: opt.color));
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => provider.fetchStudents(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(top: 4, bottom: 80),
                children: listItems,
              ),
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

    final className =
        provider.classes.isNotEmpty ? provider.classes.first.fullName : '';

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
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
      ),
      floatingActionButton:
          // Only show FAB in Daily List view, never in Summary
          (showStudentTab && !_showSummary)
              ? _buildFAB(context, provider, isDark)
              : null,
    );
  }
}

// ── Shared animated toggle tab ────────────────────────────────────────────────
class _ToggleTab extends StatelessWidget {
  final String label;
  final bool selected;
  final bool isDark;
  final VoidCallback onTap;

  const _ToggleTab({
    required this.label,
    required this.selected,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Use a consistent BoxShadow in both states so AnimatedContainer can
    // interpolate smoothly — only the color changes, never the list length.
    final shadow = BoxShadow(
      color:
          selected ? Colors.black.withValues(alpha: 0.07) : Colors.transparent,
      blurRadius: selected ? 4 : 0,
      offset: const Offset(0, 2),
    );

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: selected
                ? (isDark ? AppColors.cardDark : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [shadow],
          ),
          child: Center(
            child: AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeInOut,
              style: AppTypography.s12SemiBold(
                color: selected
                    ? (isDark ? Colors.white : AppColors.textPrimary)
                    : (isDark ? AppColors.textMuted : AppColors.textSecondary),
              ),
              child: Text(label),
            ),
          ),
        ),
      ),
    );
  }
}
