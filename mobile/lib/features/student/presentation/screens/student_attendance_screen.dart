import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentAttendanceScreen extends StatefulWidget {
  const StudentAttendanceScreen({super.key});
  @override
  State<StudentAttendanceScreen> createState() =>
      _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends State<StudentAttendanceScreen> {
  List<dynamic> _records = [];
  bool _loading = true;
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final studentId = context.read<StudentProfileProvider>().profile?.id;
    if (studentId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/attendance/student-records', params: {
        'studentId': studentId,
        'month': _month.month.toString(),
        'year': _month.year.toString(),
      });
      setState(() {
        _records = res.data['records'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() => _month = DateTime(_month.year, _month.month + delta));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Build day→status map
    final Map<int, String> dayStatus = {};
    for (final r in _records) {
      try {
        final d = DateTime.parse(r['date'].toString()).toLocal();
        final s = r['status'] as String? ?? '';
        // Map backend status to display key
        final key = s == 'present'
            ? 'P'
            : s == 'absent'
                ? 'A'
                : s == 'late'
                    ? 'L'
                    : s == 'half_day'
                        ? 'H'
                        : s == 'excused'
                            ? 'E'
                            : s;
        if (key.isNotEmpty) dayStatus[d.day] = key;
      } catch (_) {}
    }

    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final firstWeekday =
        DateTime(_month.year, _month.month, 1).weekday; // 1=Mon

    final present = dayStatus.values.where((s) => s == 'P').length;
    final absent = dayStatus.values.where((s) => s == 'A').length;
    final late = dayStatus.values.where((s) => s == 'L').length;
    final half = dayStatus.values.where((s) => s == 'H').length;
    final total = present + absent + late + half;
    final pct = total > 0 ? (present / total * 100).round() : 0;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // ── Month Navigator ──────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: () => _changeMonth(-1),
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                  Text(
                    DateFormat('MMMM yyyy').format(_month),
                    style: AppTypography.s16SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: _month.month == DateTime.now().month &&
                            _month.year == DateTime.now().year
                        ? null
                        : () => _changeMonth(1),
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Summary Chips ────────────────────────────────────────────
            Row(children: [
              _Chip('$pct%', 'Attendance', AppColors.primary, isDark),
              const SizedBox(width: 8),
              _Chip('$present', 'Present', AppColors.accentGreen, isDark),
              const SizedBox(width: 8),
              _Chip('$absent', 'Absent', AppColors.accentRed, isDark),
              const SizedBox(width: 8),
              _Chip('$half', 'Half Day', AppColors.accentOrange, isDark),
            ]),
            const SizedBox(height: 16),

            // ── Calendar Grid ────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: Column(
                children: [
                  // Weekday headers
                  Row(
                    children: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
                        .map((d) => Expanded(
                              child: Center(
                                child: Text(d,
                                    style: AppTypography.s12SemiBold(
                                        color: AppColors.textMuted)),
                              ),
                            ))
                        .toList(),
                  ),
                  const SizedBox(height: 8),
                  if (_loading)
                    SkeletonShimmer(
                      child: GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 7,
                          mainAxisSpacing: 6,
                          crossAxisSpacing: 6,
                          childAspectRatio: 0.88,
                        ),
                        itemCount: 35,
                        itemBuilder: (_, __) =>
                            const SkeletonBox(radius: 8, height: 40),
                      ),
                    )
                  else
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 7,
                        mainAxisSpacing: 6,
                        crossAxisSpacing: 6,
                        childAspectRatio: 0.88,
                      ),
                      itemCount: daysInMonth + (firstWeekday - 1),
                      itemBuilder: (_, i) {
                        if (i < firstWeekday - 1) return const SizedBox();
                        final day = i - (firstWeekday - 2);
                        final status = dayStatus[day];
                        final color = _colorFor(status);
                        final isToday = DateTime.now().day == day &&
                            DateTime.now().month == _month.month &&
                            DateTime.now().year == _month.year;
                        return Container(
                          decoration: BoxDecoration(
                            color: color != null
                                ? color.withValues(alpha: 0.15)
                                : (isDark
                                    ? AppColors.bgDark
                                    : const Color(0xFFF8FAFC)),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isToday
                                  ? AppColors.primary
                                  : (color != null
                                      ? color.withValues(alpha: 0.3)
                                      : (isDark
                                          ? AppColors.borderDark
                                          : AppColors.borderLight)),
                              width: isToday ? 2 : 1,
                            ),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('$day',
                                  style: AppTypography.s12SemiBold(
                                      color: color ??
                                          (isDark
                                              ? Colors.white70
                                              : AppColors.textSecondary))),
                              if (status != null)
                                Text(status,
                                    style: AppTypography.s10Bold(color: color)),
                            ],
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Legend ───────────────────────────────────────────────────
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                _Legend('P', 'Present', AppColors.accentGreen),
                _Legend('A', 'Absent', AppColors.accentRed),
                _Legend('H', 'Half Day', AppColors.accentOrange),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color? _colorFor(String? s) {
    switch (s) {
      case 'P':
        return AppColors.accentGreen;
      case 'A':
        return AppColors.accentRed;
      case 'L':
        return AppColors.warning;
      case 'H':
        return AppColors.accentOrange;
      case 'E':
        return AppColors.primary;
      default:
        return null;
    }
  }
}

class _Chip extends StatelessWidget {
  final String value, label;
  final Color color;
  final bool isDark;
  const _Chip(this.value, this.label, this.color, this.isDark);

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Text(value, style: AppTypography.s16Bold(color: color)),
              const SizedBox(height: 2),
              Text(label,
                  style: AppTypography.s11Regular(color: color),
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}

class _Legend extends StatelessWidget {
  final String code, label;
  final Color color;
  const _Legend(this.code, this.label, this.color);

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: color.withValues(alpha: 0.4)),
            ),
            child: Center(
              child: Text(code, style: AppTypography.s10Bold(color: color)),
            ),
          ),
          const SizedBox(width: 4),
          Text(label,
              style: AppTypography.s12Regular(color: AppColors.textMuted)),
        ],
      );
}
