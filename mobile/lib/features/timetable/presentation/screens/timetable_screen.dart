import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../profile/presentation/providers/profile_provider.dart';
import '../providers/timetable_provider.dart';

class TimetableItem {
  final int periodNumber;
  final TeacherPeriod? regularPeriod;
  final SubstitutionAssignment? substitution;

  TimetableItem({
    required this.periodNumber,
    this.regularPeriod,
    this.substitution,
  });
}

class TimetableScreen extends StatelessWidget {
  const TimetableScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => TimetableProvider(),
      child: const _TimetableScreenContent(),
    );
  }
}

class _TimetableScreenContent extends StatefulWidget {
  const _TimetableScreenContent();

  @override
  State<_TimetableScreenContent> createState() =>
      _TimetableScreenContentState();
}

class _TimetableScreenContentState extends State<_TimetableScreenContent> {
  bool _isGridView = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final profile = context.read<ProfileProvider>().profile;
      if (profile != null) {
        final teacherId = profile.employee.id;
        final provider = context.read<TimetableProvider>();
        provider.fetchTimetable(teacherId);
        provider.fetchSubstitutions(teacherId, provider.selectedDate);
      }
    });
  }

  Widget _header(BuildContext context, TimetableProvider provider,
      String teacherId, bool isDark) {
    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateFormat('MMMM yyyy').format(provider.selectedDate),
                style: AppTypography.s20Bold(
                    color: isDark ? Colors.white : AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                'Weekly Schedule',
                style: AppTypography.s12Regular(
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary),
              ),
            ],
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.calendar_month, color: AppColors.primary),
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: provider.selectedDate,
                firstDate: DateTime.now().subtract(const Duration(days: 90)),
                lastDate: DateTime.now().add(const Duration(days: 90)),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme:
                        const ColorScheme.light(primary: AppColors.primary),
                  ),
                  child: child!,
                ),
              );
              if (picked != null) {
                provider.selectDate(picked, teacherId);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _calendarStrip(BuildContext context, TimetableProvider provider,
      String teacherId, bool isDark) {
    final today = DateTime.now();
    final startOfWeek = today.subtract(Duration(days: today.weekday - 1));
    final dates = List.generate(7, (i) => startOfWeek.add(Duration(days: i)));

    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: dates.map((date) {
            final isSelected = DateUtils.isSameDay(date, provider.selectedDate);
            final isToday = DateUtils.isSameDay(date, today);

            final dayName = DateFormat('E').format(date);
            final dayNum = DateFormat('d').format(date);

            return GestureDetector(
              onTap: () => provider.selectDate(date, teacherId),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(right: 12),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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

  Widget _substitutionBanner(List<SubstitutionAssignment> subs, bool isDark) {
    if (subs.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
        boxShadow: AppColors.shadowSm,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.notification_important,
                color: Color(0xFFD97706), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Substitution Alert',
                  style: AppTypography.s14Bold(color: const Color(0xFFB45309)),
                ),
                const SizedBox(height: 2),
                Text(
                  'You are assigned to substitute ${subs.length} class(es) today.',
                  style:
                      AppTypography.s12Regular(color: const Color(0xFF92400E)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodCard(
      BuildContext context, TimetableItem item, bool isDark) {
    if (item.substitution != null) {
      final sub = item.substitution!;
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: AppColors.warning.withValues(alpha: 0.5), width: 1.5),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: IntrinsicHeight(
            child: Row(
              children: [
                Container(width: 6, color: AppColors.warning),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color:
                                    AppColors.warning.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                'SUBSTITUTION',
                                style: AppTypography.s12Bold(
                                    color: AppColors.warning),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              'Period ${item.periodNumber}',
                              style: AppTypography.s14Bold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          sub.subjectName,
                          style: AppTypography.s16Bold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.school,
                                size: 14,
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Text(
                              'Class: ${sub.fullClassName}',
                              style: AppTypography.s12Medium(
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Divider(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight,
                            height: 1),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.person_outline,
                                size: 14,
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Substituting for: ${sub.absentTeacherName}',
                                style: AppTypography.s12Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary),
                              ),
                            ),
                          ],
                        ),
                        if (sub.note.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Note: ${sub.note}',
                            style: AppTypography.s12Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary)
                                .copyWith(fontStyle: FontStyle.italic),
                          ),
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

    if (item.regularPeriod != null) {
      final reg = item.regularPeriod!;
      Color color;
      try {
        color = Color(int.parse(reg.subjectColor.replaceFirst('#', '0xFF')));
      } catch (_) {
        color = AppColors.primary;
      }
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: IntrinsicHeight(
            child: Row(
              children: [
                Container(width: 6, color: color),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Regular Class',
                                style: AppTypography.s12Medium(color: color),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              'Period ${item.periodNumber}',
                              style: AppTypography.s14Bold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          reg.subjectName,
                          style: AppTypography.s16Bold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.school,
                                size: 14,
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Text(
                              'Class: ${reg.fullClassName}',
                              style: AppTypography.s12Medium(
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                            ),
                            if (reg.room != null && reg.room!.isNotEmpty) ...[
                              const SizedBox(width: 12),
                              Icon(Icons.room,
                                  size: 14,
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                              const SizedBox(width: 4),
                              Text(
                                'Room: ${reg.room}',
                                style: AppTypography.s12Medium(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary),
                              ),
                            ],
                          ],
                        ),
                        if (reg.startTime != null || reg.endTime != null) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(Icons.access_time,
                                  size: 14,
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                              const SizedBox(width: 6),
                              Text(
                                '${reg.startTime ?? ""} - ${reg.endTime ?? ""}',
                                style: AppTypography.s12Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary),
                              ),
                            ],
                          ),
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

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.cardDark.withValues(alpha: 0.5)
            : AppColors.bgLight.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? AppColors.borderDark.withValues(alpha: 0.5)
              : AppColors.borderLight.withValues(alpha: 0.5),
          style: BorderStyle.solid,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  item.periodNumber.toString(),
                  style: AppTypography.s14Bold(
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Free Period',
                  style: AppTypography.s14Medium(
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                ),
                Text(
                  'No class or assignment scheduled',
                  style: AppTypography.s12Regular(
                      color: isDark
                          ? AppColors.textMuted.withValues(alpha: 0.7)
                          : AppColors.textMuted),
                ),
              ],
            ),
            const Spacer(),
            Icon(Icons.coffee_outlined,
                size: 18,
                color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _viewToggle(
      bool isGridView, ValueChanged<bool> onChanged, bool isDark) {
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
              onTap: () => onChanged(false),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: !isGridView
                      ? (isDark ? AppColors.cardDark : Colors.white)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: !isGridView
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
                    'Daily View',
                    style: AppTypography.s12SemiBold(
                      color: !isGridView
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
              onTap: () => onChanged(true),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isGridView
                      ? (isDark ? AppColors.cardDark : Colors.white)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: isGridView
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
                    'Weekly Grid',
                    style: AppTypography.s12SemiBold(
                      color: isGridView
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

  Widget _weeklyGridView(
      BuildContext context, TimetableProvider provider, bool isDark) {
    final days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    ];

    // Find the max period number dynamically
    int maxPeriod = 8;
    for (var day in days) {
      final periods = provider.timetable[day] ?? [];
      for (var p in periods) {
        if (p.periodNumber > maxPeriod) {
          maxPeriod = p.periodNumber;
        }
      }
    }

    final periodsList = List.generate(maxPeriod, (index) => index + 1);

    return Expanded(
      child: RefreshIndicator(
        onRefresh: () async {
          final profile = context.read<ProfileProvider>().profile;
          if (profile != null) {
            await provider.fetchTimetable(profile.employee.id);
          }
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 80),
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Table(
                  defaultColumnWidth: const FixedColumnWidth(110),
                  columnWidths: const {
                    0: FixedColumnWidth(80),
                  },
                  border: TableBorder.all(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight,
                    width: 1,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  children: [
                    // Header Row
                    TableRow(
                      decoration: BoxDecoration(
                        color: isDark
                            ? const Color(0xFF1E293B)
                            : const Color(0xFF0F172A),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(12),
                          topRight: Radius.circular(12),
                        ),
                      ),
                      children: [
                        TableCell(
                          verticalAlignment: TableCellVerticalAlignment.middle,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: 12, horizontal: 8),
                            child: Text(
                              'Day',
                              textAlign: TextAlign.center,
                              style: AppTypography.s12Bold(color: Colors.white),
                            ),
                          ),
                        ),
                        ...periodsList.map(
                          (p) => TableCell(
                            verticalAlignment:
                                TableCellVerticalAlignment.middle,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  vertical: 12, horizontal: 8),
                              child: Text(
                                'P$p',
                                textAlign: TextAlign.center,
                                style:
                                    AppTypography.s12Bold(color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    // Data Rows
                    ...days.map((day) {
                      final dayPeriods = provider.timetable[day] ?? [];
                      final isLastDay = day == days.last;

                      return TableRow(
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.cardDark : Colors.white,
                          borderRadius: isLastDay
                              ? const BorderRadius.only(
                                  bottomLeft: Radius.circular(12),
                                  bottomRight: Radius.circular(12),
                                )
                              : null,
                        ),
                        children: [
                          // Day name
                          TableCell(
                            verticalAlignment:
                                TableCellVerticalAlignment.middle,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  vertical: 16, horizontal: 8),
                              color: isDark
                                  ? AppColors.borderDark.withValues(alpha: 0.2)
                                  : const Color(0xFFF8FAFC),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    day[0].toUpperCase() + day.substring(1, 3),
                                    style: AppTypography.s12Bold(
                                      color: isDark
                                          ? Colors.white
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    day.substring(0, 3).toUpperCase(),
                                    style: AppTypography.inter(
                                      size: 10,
                                      weight: FontWeight.w400,
                                      color: isDark
                                          ? AppColors.textMuted
                                          : AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Periods cells
                          ...periodsList.map((pNum) {
                            final periodList =
                                dayPeriods.where((p) => p.periodNumber == pNum);
                            final period =
                                periodList.isNotEmpty ? periodList.first : null;

                            if (period != null) {
                              Color color;
                              try {
                                color = Color(int.parse(period.subjectColor
                                    .replaceFirst('#', '0xFF')));
                              } catch (_) {
                                color = AppColors.primary;
                              }

                              return TableCell(
                                verticalAlignment:
                                    TableCellVerticalAlignment.middle,
                                child: Container(
                                  margin: const EdgeInsets.all(4),
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 8, horizontal: 6),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: color.withValues(alpha: 0.3),
                                      width: 1,
                                    ),
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      Text(
                                        period.subjectName,
                                        textAlign: TextAlign.center,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppTypography.inter(
                                          size: 11,
                                          weight: FontWeight.w700,
                                          color: color,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        period.fullClassName,
                                        textAlign: TextAlign.center,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppTypography.inter(
                                          size: 10,
                                          weight: FontWeight.w500,
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary,
                                        ),
                                      ),
                                      if (period.room != null &&
                                          period.room!.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          'Rm: ${period.room}',
                                          textAlign: TextAlign.center,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppTypography.inter(
                                            size: 9,
                                            weight: FontWeight.w400,
                                            color: isDark
                                                ? AppColors.textMuted
                                                    .withValues(alpha: 0.7)
                                                : AppColors.textMuted,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            } else {
                              return TableCell(
                                verticalAlignment:
                                    TableCellVerticalAlignment.middle,
                                child: Container(
                                  alignment: Alignment.center,
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 20),
                                  child: Text(
                                    '—',
                                    style: AppTypography.s12Regular(
                                      color: isDark
                                          ? AppColors.textMuted
                                              .withValues(alpha: 0.4)
                                          : const Color(0xFFCBD5E1),
                                    ),
                                  ),
                                ),
                              );
                            }
                          }),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<ProfileProvider>().profile;
    final provider = context.watch<TimetableProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (profile == null) {
      return const Scaffold(
        body: Center(child: Text('User Profile not found')),
      );
    }

    final teacherId = profile.employee.id;

    if (provider.isLoading) {
      return const Scaffold(
        body:
            Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (provider.error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: AppColors.accentRed),
              const SizedBox(height: 16),
              Text(
                provider.error!,
                style: AppTypography.s16SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  provider.fetchTimetable(teacherId);
                  provider.fetchSubstitutions(teacherId, provider.selectedDate);
                },
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final dayName =
        DateFormat('EEEE').format(provider.selectedDate).toLowerCase();
    final regularPeriods = provider.timetable[dayName] ?? [];
    final subs = provider.substitutions;

    int maxPeriod = 8;
    for (final p in regularPeriods) {
      if (p.periodNumber > maxPeriod) maxPeriod = p.periodNumber;
    }
    for (final s in subs) {
      if (s.periodNumber > maxPeriod) maxPeriod = s.periodNumber;
    }

    final List<TimetableItem> items = [];
    for (int pNum = 1; pNum <= maxPeriod; pNum++) {
      final regList = regularPeriods.where((p) => p.periodNumber == pNum);
      final reg = regList.isNotEmpty ? regList.first : null;

      final subList = subs.where((s) => s.periodNumber == pNum);
      final sub = subList.isNotEmpty ? subList.first : null;

      if (reg != null || sub != null) {
        items.add(TimetableItem(
          periodNumber: pNum,
          regularPeriod: reg,
          substitution: sub,
        ));
      } else {
        items.add(TimetableItem(
          periodNumber: pNum,
        ));
      }
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
            _header(context, provider, teacherId, isDark),
            _viewToggle(_isGridView, (val) => setState(() => _isGridView = val),
                isDark),
            if (_isGridView)
              _weeklyGridView(context, provider, isDark)
            else ...[
              _calendarStrip(context, provider, teacherId, isDark),
              _substitutionBanner(subs, isDark),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    await provider.fetchTimetable(teacherId);
                    await provider.fetchSubstitutions(
                        teacherId, provider.selectedDate);
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.only(top: 8, bottom: 80),
                    itemCount: items.length,
                    itemBuilder: (ctx, i) =>
                        _buildPeriodCard(ctx, items[i], isDark),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
