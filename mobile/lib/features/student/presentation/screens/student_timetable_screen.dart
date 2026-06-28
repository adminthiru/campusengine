import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentTimetableScreen extends StatefulWidget {
  const StudentTimetableScreen({super.key});
  @override
  State<StudentTimetableScreen> createState() => _StudentTimetableScreenState();
}

class _StudentTimetableScreenState extends State<StudentTimetableScreen> {
  Map<String, dynamic> _timetable = {};
  bool _loading = true;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final classId = context.read<StudentProfileProvider>().profile?.classId;
    if (classId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final res =
          await ApiClient.get('/timetable', params: {'classId': classId});
      // Backend returns { timetable: { schedule: [{ day:"monday", periods:[…] }] } }
      // Convert the schedule array into a day-keyed map so the UI can look up
      // periods by day name directly (e.g. _timetable["monday"]).
      final raw = res.data['timetable'] as Map<String, dynamic>? ?? {};
      final schedule = raw['schedule'] as List<dynamic>? ?? [];
      final Map<String, List<dynamic>> dayMap = {};
      for (final entry in schedule) {
        if (entry is! Map) continue;
        final day = (entry['day'] as String? ?? '').toLowerCase();
        if (day.isNotEmpty) {
          dayMap[day] = entry['periods'] as List<dynamic>? ?? [];
        }
      }
      setState(() {
        _timetable = dayMap;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dayName = DateFormat('EEEE').format(_selectedDate).toLowerCase();
    final periods = _timetable[dayName] as List<dynamic>? ?? [];

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          // ── Day Selector ────────────────────────────────────────────────
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: List.generate(7, (i) {
                  final today = DateTime.now();
                  final startOfWeek =
                      today.subtract(Duration(days: today.weekday - 1));
                  final date = startOfWeek.add(Duration(days: i));
                  final isSelected = DateUtils.isSameDay(date, _selectedDate);
                  final isToday = DateUtils.isSameDay(date, today);

                  return GestureDetector(
                    onTap: () => setState(() => _selectedDate = date),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(right: 10),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: isSelected
                            ? const LinearGradient(
                                colors: [
                                  AppColors.primary,
                                  AppColors.primaryDark
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        color: isSelected
                            ? null
                            : (isToday
                                ? AppColors.primary.withValues(alpha: 0.1)
                                : Colors.transparent),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected
                              ? Colors.transparent
                              : (isToday
                                  ? AppColors.primary.withValues(alpha: 0.4)
                                  : (isDark
                                      ? AppColors.borderDark
                                      : AppColors.borderLight)),
                        ),
                      ),
                      child: Column(children: [
                        Text(DateFormat('E').format(date),
                            style: AppTypography.s12Medium(
                                color: isSelected
                                    ? Colors.white
                                    : AppColors.textMuted)),
                        const SizedBox(height: 4),
                        Text(DateFormat('d').format(date),
                            style: AppTypography.s16Bold(
                                color: isSelected
                                    ? Colors.white
                                    : (isToday
                                        ? AppColors.primary
                                        : (isDark
                                            ? Colors.white
                                            : AppColors.textPrimary)))),
                      ]),
                    ),
                  );
                }),
              ),
            ),
          ),

          // ── Periods ─────────────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const SkeletonList(showLeading: false, itemHeight: 84)
                : periods.isEmpty
                    ? Center(
                        child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.schedule_outlined,
                              size: 56, color: AppColors.textMuted),
                          const SizedBox(height: 12),
                          Text('No classes today',
                              style: AppTypography.s16SemiBold(
                                  color: AppColors.textMuted)),
                        ],
                      ))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          itemCount: periods.length,
                          itemBuilder: (_, i) =>
                              _PeriodCard(period: periods[i], isDark: isDark),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _PeriodCard extends StatelessWidget {
  final dynamic period;
  final bool isDark;
  const _PeriodCard({required this.period, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final periodNo = period['periodNumber'] as int? ?? 0;
    final subject = period['subject'] as Map<String, dynamic>?;
    final subName = subject?['name'] as String? ?? 'Free Period';
    final colorHex = subject?['color'] as String? ?? '#1A56E8';
    final startTime = period['startTime'] as String? ?? '';
    final endTime = period['endTime'] as String? ?? '';
    final teacher = period['teacher'] as Map<String, dynamic>?;
    final teacherName = teacher?['name'] as String? ?? '';

    Color color;
    try {
      color = Color(int.parse(colorHex.replaceFirst('#', '0xFF')));
    } catch (_) {
      color = AppColors.primary;
    }

    final isFree = subject == null;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isFree
                ? (isDark ? AppColors.borderDark : AppColors.borderLight)
                : color.withValues(alpha: 0.3)),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(width: 5, color: isFree ? AppColors.textMuted : color),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: (isFree ? AppColors.textMuted : color)
                            .withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                          child: Text('P$periodNo',
                              style: AppTypography.s12Bold(
                                  color:
                                      isFree ? AppColors.textMuted : color))),
                    ),
                    if (startTime.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text('$startTime–$endTime',
                          style: AppTypography.s11Regular(
                              color: AppColors.textMuted)),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(subName,
                          style: AppTypography.s15SemiBold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      if (teacherName.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(children: [
                          Icon(Icons.person_outline,
                              size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(teacherName,
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                        ]),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
