import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/skeleton.dart';
import '../providers/calendar_provider.dart';

// ── Entry point ───────────────────────────────────────────────────────────────

class CalendarScreen extends StatelessWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) {
        final p = CalendarProvider();
        final now = DateTime.now();
        p.fetchMonth(now.year, now.month);
        return p;
      },
      child: const _CalendarContent(),
    );
  }
}

// ── Content stateful host ─────────────────────────────────────────────────────

class _CalendarContent extends StatefulWidget {
  const _CalendarContent();
  @override
  State<_CalendarContent> createState() => _CalendarContentState();
}

class _CalendarContentState extends State<_CalendarContent> {
  final _now   = DateTime.now();
  late int _year;
  late int _month; // 1-based
  int? _selectedDay;
  bool _listView = false; // false = month grid, true = year list

  @override
  void initState() {
    super.initState();
    _year  = _now.year;
    _month = _now.month;
  }

  void _prevMonth() {
    setState(() {
      _selectedDay = null;
      if (_month == 1) { _year--; _month = 12; }
      else              { _month--; }
    });
    context.read<CalendarProvider>().fetchMonth(_year, _month);
  }

  void _nextMonth() {
    setState(() {
      _selectedDay = null;
      if (_month == 12) { _year++; _month = 1; }
      else               { _month++; }
    });
    context.read<CalendarProvider>().fetchMonth(_year, _month);
  }

  void _switchToList() {
    setState(() { _listView = true; _selectedDay = null; });
    context.read<CalendarProvider>().fetchYear(_year);
  }

  void _switchToMonth() {
    setState(() => _listView = false);
    context.read<CalendarProvider>().fetchMonth(_year, _month);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final p      = context.watch<CalendarProvider>();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // ── View toggle + legend ──────────────────────────────────────────
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Month / List toggle
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _ToggleBtn(
                            label: 'Month',
                            icon: Icons.calendar_view_month_outlined,
                            active: !_listView,
                            onTap: _switchToMonth,
                            left: true,
                            isDark: isDark,
                          ),
                          _ToggleBtn(
                            label: 'List',
                            icon: Icons.format_list_bulleted,
                            active: _listView,
                            onTap: _switchToList,
                            left: false,
                            isDark: isDark,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Legend
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: kTypeConfig.entries.map((e) {
                      return Padding(
                        padding: const EdgeInsets.only(right: 14),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: e.value.color,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(e.value.label,
                                style: AppTypography.s11Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary)),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // ── Main content ──────────────────────────────────────────────────
          Expanded(
            child: _listView
                ? _ListView(
                    year: _year,
                    onPrevYear: () {
                      setState(() => _year--);
                      context.read<CalendarProvider>().fetchYear(_year);
                    },
                    onNextYear: () {
                      setState(() => _year++);
                      context.read<CalendarProvider>().fetchYear(_year);
                    },
                    isDark: isDark,
                  )
                : _MonthGrid(
                    year: _year,
                    month: _month,
                    now: _now,
                    selectedDay: _selectedDay,
                    onPrev: _prevMonth,
                    onNext: _nextMonth,
                    onDayTap: (d) {
                      final evs = p.eventsForDay(d);
                      if (evs.isEmpty) return;
                      setState(() =>
                          _selectedDay = (_selectedDay == d ? null : d));
                      if (_selectedDay != null) {
                        _showDaySheet(context, d, evs, isDark);
                      }
                    },
                    isDark: isDark,
                  ),
          ),
        ],
      ),
    );
  }

  void _showDaySheet(
      BuildContext context, int day, List<CalendarEvent> evs, bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _DaySheet(
        day: day,
        month: _month,
        year: _year,
        events: evs,
        isDark: isDark,
      ),
    );
  }
}

// ── Month grid ────────────────────────────────────────────────────────────────

class _MonthGrid extends StatelessWidget {
  final int year, month;
  final DateTime now;
  final int? selectedDay;
  final VoidCallback onPrev, onNext;
  final Function(int) onDayTap;
  final bool isDark;

  const _MonthGrid({
    required this.year,
    required this.month,
    required this.now,
    required this.selectedDay,
    required this.onPrev,
    required this.onNext,
    required this.onDayTap,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final p           = context.watch<CalendarProvider>();
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstWday   = DateTime(year, month, 1).weekday % 7; // 0=Sun

    return RefreshIndicator(
      onRefresh: () => p.fetchMonth(year, month, force: true),
      color: AppColors.primary,
      child: SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(
          children: [
            // ── Month navigation ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                children: [
                  _NavBtn(icon: Icons.chevron_left, onTap: onPrev, isDark: isDark),
                  Expanded(
                    child: Text(
                      '${kMonthNames[month - 1]} $year',
                      textAlign: TextAlign.center,
                      style: AppTypography.s16Bold(
                          color: isDark ? Colors.white : AppColors.textPrimary),
                    ),
                  ),
                  _NavBtn(icon: Icons.chevron_right, onTap: onNext, isDark: isDark),
                ],
              ),
            ),

            // ── Day headers Sun-Sat ───────────────────────────────────────
            Container(
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  bottom: BorderSide(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
              ),
              child: Row(
                children: const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    .asMap()
                    .entries
                    .map((e) => Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(
                              e.value,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: e.key == 0
                                    ? AppColors.error
                                    : (isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary),
                              ),
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ),

            // ── Day cells ─────────────────────────────────────────────────
            if (p.isMonthLoading)
              const Padding(
                padding: EdgeInsets.all(12),
                child: SkeletonShimmer(
                  child: Column(
                    children: [
                      SkeletonBox(
                          width: double.infinity, height: 60, radius: 6),
                      SizedBox(height: 6),
                      SkeletonBox(
                          width: double.infinity, height: 60, radius: 6),
                      SizedBox(height: 6),
                      SkeletonBox(
                          width: double.infinity, height: 60, radius: 6),
                      SizedBox(height: 6),
                      SkeletonBox(
                          width: double.infinity, height: 60, radius: 6),
                    ],
                  ),
                ),
              )
            else if (p.monthError != null)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Text(p.monthError!,
                    style: AppTypography.s13Regular(
                        color: AppColors.error),
                    textAlign: TextAlign.center),
              )
            else
              _buildGrid(daysInMonth, firstWday, p),
          ],
        ),
      ),
    ),
    );
  }

  Widget _buildGrid(int daysInMonth, int firstWday, CalendarProvider p) {
    final totalCells = firstWday + daysInMonth;
    final rows       = (totalCells / 7).ceil();

    return Column(
      children: List.generate(rows, (row) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: List.generate(7, (col) {
            final idx = row * 7 + col;
            final day = idx - firstWday + 1;
            final valid = day >= 1 && day <= daysInMonth;
            final isToday = valid &&
                day == now.day &&
                month == now.month &&
                year == now.year;
            final evs       = valid ? p.eventsForDay(day) : <CalendarEvent>[];
            final isHoliday = evs.any((e) => e.type == 'holiday');
            final isSun     = col == 0;

            return Expanded(
              child: GestureDetector(
                onTap: valid && evs.isNotEmpty ? () => onDayTap(day) : null,
                child: Container(
                  constraints: const BoxConstraints(minHeight: 68),
                  decoration: BoxDecoration(
                    color: !valid
                        ? Colors.transparent
                        : isHoliday
                            ? const Color(0xFFFEF2F2)
                            : Colors.transparent,
                    border: Border(
                      right: col < 6
                          ? BorderSide(
                              color: isDark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight,
                              width: 0.5)
                          : BorderSide.none,
                      bottom: row < (((firstWday + daysInMonth - 1) ~/ 7))
                          ? BorderSide(
                              color: isDark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight,
                              width: 0.5)
                          : BorderSide.none,
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(4, 6, 4, 4),
                  child: valid
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Day number
                            Container(
                              width: 24,
                              height: 24,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: isToday
                                    ? AppColors.primary
                                    : Colors.transparent,
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                '$day',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isToday
                                      ? FontWeight.w700
                                      : FontWeight.w400,
                                  color: isToday
                                      ? Colors.white
                                      : isHoliday
                                          ? AppColors.error
                                          : isSun
                                              ? AppColors.error
                                              : (isDark
                                                  ? Colors.white
                                                  : AppColors.textPrimary),
                                ),
                              ),
                            ),
                            const SizedBox(height: 3),
                            // Event pills
                            ...evs.take(2).map((ev) => Container(
                                  margin: const EdgeInsets.only(bottom: 2),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 4, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: ev.bg,
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: Text(
                                    ev.title,
                                    style: TextStyle(
                                        fontSize: 9,
                                        color: ev.color,
                                        fontWeight: FontWeight.w600),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                )),
                            if (evs.length > 2)
                              Text(
                                '+${evs.length - 2} more',
                                style: AppTypography.s10Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary),
                              ),
                          ],
                        )
                      : const SizedBox(),
                ),
              ),
            );
          }),
        );
      }),
    );
  }
}

// ── Day detail bottom sheet ───────────────────────────────────────────────────

class _DaySheet extends StatelessWidget {
  final int day, month, year;
  final List<CalendarEvent> events;
  final bool isDark;

  const _DaySheet({
    required this.day,
    required this.month,
    required this.year,
    required this.events,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final date = DateTime(year, month, day);
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          Text(
            DateFormat('d MMMM yyyy').format(date),
            style: AppTypography.s16Bold(
                color: isDark ? Colors.white : AppColors.textPrimary),
          ),
          const SizedBox(height: 14),
          ...events.map((ev) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _EventCard(event: ev, isDark: isDark, showDate: false),
              )),
        ],
      ),
    );
  }
}

// ── List / year view ──────────────────────────────────────────────────────────

class _ListView extends StatelessWidget {
  final int year;
  final VoidCallback onPrevYear, onNextYear;
  final bool isDark;

  const _ListView({
    required this.year,
    required this.onPrevYear,
    required this.onNextYear,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.watch<CalendarProvider>();

    return Column(
      children: [
        // Year navigation
        Container(
          color: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              _NavBtn(icon: Icons.chevron_left, onTap: onPrevYear, isDark: isDark),
              const SizedBox(width: 16),
              Text(
                '$year',
                style: AppTypography.s18Bold(
                    color: isDark ? Colors.white : AppColors.textPrimary),
              ),
              const SizedBox(width: 16),
              _NavBtn(icon: Icons.chevron_right, onTap: onNextYear, isDark: isDark),
            ],
          ),
        ),

        Expanded(
          child: p.isYearLoading
              ? const SkeletonList(showLeading: false)
              : p.yearError != null
                  ? Center(
                      child: Text(p.yearError!,
                          style: AppTypography.s14Regular(
                              color: AppColors.error)))
                  : RefreshIndicator(
                      onRefresh: () => p.fetchYear(year, force: true),
                      color: AppColors.primary,
                      child: p.groupedByMonth.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(
                                height: MediaQuery.of(context).size.height *
                                    0.3),
                            Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.calendar_today_outlined,
                                      size: 52,
                                      color: isDark
                                          ? AppColors.textMuted
                                          : AppColors.textSecondary),
                                  const SizedBox(height: 12),
                                  Text('No events for $year',
                                      style: AppTypography.s14Regular(
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary)),
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding:
                              const EdgeInsets.fromLTRB(16, 12, 16, 32),
                          children: kMonthNames
                              .where((m) =>
                                  p.groupedByMonth.containsKey(m))
                              .map((monthName) {
                            final evs = p.groupedByMonth[monthName]!;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 24),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Month header
                                  Row(children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius:
                                            BorderRadius.circular(6),
                                      ),
                                      child: Text(monthName,
                                          style: AppTypography.s13Bold(
                                              color: Colors.white)),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${evs.length} event${evs.length != 1 ? 's' : ''}',
                                      style: AppTypography.s12Regular(
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary),
                                    ),
                                  ]),
                                  const SizedBox(height: 10),
                                  ...evs.map((ev) => Padding(
                                        padding: const EdgeInsets.only(
                                            bottom: 8),
                                        child: _EventCard(
                                          event: ev,
                                          isDark: isDark,
                                          showDate: true,
                                        ),
                                      )),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                    ),
        ),
      ],
    );
  }
}

// ── Event Card (mirrors admin EventCard) ──────────────────────────────────────

class _EventCard extends StatelessWidget {
  final CalendarEvent event;
  final bool isDark;
  final bool showDate;

  const _EventCard(
      {required this.event, required this.isDark, required this.showDate});

  @override
  Widget build(BuildContext context) {
    final color = event.color;
    final bg    = event.bg;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left colour bar
          Container(
            width: 4,
            constraints: const BoxConstraints(minHeight: 36),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.title,
                    style: AppTypography.s14SemiBold(
                        color: AppColors.textPrimary)),
                if (showDate) ...[
                  const SizedBox(height: 2),
                  Text(
                    _dateRange(event),
                    style: AppTypography.s12Regular(
                        color: AppColors.textSecondary),
                  ),
                ],
                if (event.description != null &&
                    event.description!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(event.description!,
                      style: AppTypography.s12Regular(
                          color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                ],
                const SizedBox(height: 5),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(event.typeLabel,
                      style: TextStyle(
                          fontSize: 11,
                          color: color,
                          fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _dateRange(CalendarEvent e) {
    final fmt = DateFormat('d MMM yyyy');
    if (e.endDate != null) {
      final s = DateTime(e.date.year, e.date.month, e.date.day);
      final en = DateTime(e.endDate!.year, e.endDate!.month, e.endDate!.day);
      if (!s.isAtSameMomentAs(en)) {
        return '${fmt.format(e.date)} – ${fmt.format(e.endDate!)}';
      }
    }
    return fmt.format(e.date);
  }
}

// ── Small shared widgets ──────────────────────────────────────────────────────

class _NavBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool isDark;
  const _NavBtn({required this.icon, required this.onTap, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon,
            size: 18,
            color: isDark ? Colors.white : AppColors.textPrimary),
      ),
    );
  }
}

class _ToggleBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool active, left;
  final VoidCallback onTap;
  final bool isDark;

  const _ToggleBtn({
    required this.label,
    required this.icon,
    required this.active,
    required this.left,
    required this.onTap,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.horizontal(
            left:  left  ? const Radius.circular(7) : Radius.zero,
            right: !left ? const Radius.circular(7) : Radius.zero,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14,
                color: active
                    ? Colors.white
                    : (isDark ? AppColors.textMuted : AppColors.textSecondary)),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: active
                        ? Colors.white
                        : (isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary))),
          ],
        ),
      ),
    );
  }
}
