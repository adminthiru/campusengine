import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

const _kDays = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];
const _kDayLabels = {
  'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed',
  'thursday': 'Thu', 'friday': 'Fri', 'saturday': 'Sat',
};

class StudentTimetableScreen extends StatefulWidget {
  const StudentTimetableScreen({super.key});
  @override
  State<StudentTimetableScreen> createState() => _StudentTimetableScreenState();
}

class _StudentTimetableScreenState extends State<StudentTimetableScreen> {
  Map<String, dynamic> _timetable = {};
  bool _loading = true;
  bool _isGridView = false;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load();
      context.read<StudentProfileProvider>().addListener(_onProfileChanged);
    });
  }

  @override
  void dispose() {
    context.read<StudentProfileProvider>().removeListener(_onProfileChanged);
    super.dispose();
  }

  void _onProfileChanged() {
    if (!mounted) return;
    final classId = context.read<StudentProfileProvider>().profile?.classId;
    if (classId != null && _timetable.isEmpty && !_loading) _load();
  }

  Future<void> _load() async {
    final classId = context.read<StudentProfileProvider>().profile?.classId;
    if (classId == null) { setState(() => _loading = false); return; }
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/timetable', params: {'classId': classId});
      final raw = res.data['timetable'] as Map<String, dynamic>? ?? {};
      final schedule = raw['schedule'] as List<dynamic>? ?? [];
      final Map<String, List<dynamic>> dayMap = {};
      for (final entry in schedule) {
        if (entry is! Map) continue;
        final day = (entry['day'] as String? ?? '').toLowerCase();
        if (day.isNotEmpty) dayMap[day] = entry['periods'] as List<dynamic>? ?? [];
      }
      setState(() { _timetable = dayMap; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  List<Map<String, dynamic>> _periodsForDay(String day) {
    final list = (_timetable[day] as List<dynamic>? ?? []);
    final result = list.whereType<Map>()
        .map((p) => Map<String, dynamic>.from(p)).toList();
    result.sort((a, b) =>
        (a['periodNumber'] as int? ?? 0).compareTo(b['periodNumber'] as int? ?? 0));
    return result;
  }

  int get _maxPeriod {
    int max = 0;
    for (final day in _kDays) {
      for (final p in _periodsForDay(day)) {
        final n = p['periodNumber'] as int? ?? 0;
        if (n > max) max = n;
      }
    }
    return max == 0 ? 8 : max;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final today = DateTime.now();
    final startOfWeek = _selectedDate.subtract(
        Duration(days: _selectedDate.weekday - 1));

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(children: [
        // ── Day selector ─────────────────────────────────────────────────────
        _DayStrip(
          startOfWeek: startOfWeek,
          selectedDate: _selectedDate,
          today: today,
          isDark: isDark,
          onSelect: (d) => setState(() => _selectedDate = d),
        ),

        // ── View toggle ───────────────────────────────────────────────────────
        _ViewToggle(
          isGrid: _isGridView,
          isDark: isDark,
          onChanged: (v) => setState(() => _isGridView = v),
        ),

        // ── Content ───────────────────────────────────────────────────────────
        Expanded(
          child: _loading
              ? const SkeletonList(showLeading: false, itemHeight: 84)
              : _isGridView
                  ? _WeeklyGrid(
                      timetable: _timetable,
                      maxPeriod: _maxPeriod,
                      isDark: isDark,
                      onRefresh: _load,
                    )
                  : _DailyList(
                      periods: _periodsForDay(
                          DateFormat('EEEE').format(_selectedDate).toLowerCase()),
                      isDark: isDark,
                      onRefresh: _load,
                    ),
        ),
      ]),
    );
  }
}

// ── Day strip ─────────────────────────────────────────────────────────────────
class _DayStrip extends StatelessWidget {
  final DateTime startOfWeek, selectedDate, today;
  final bool isDark;
  final ValueChanged<DateTime> onSelect;

  const _DayStrip({
    required this.startOfWeek, required this.selectedDate,
    required this.today, required this.isDark, required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: List.generate(7, (i) {
            final date = startOfWeek.add(Duration(days: i));
            final isSelected = DateUtils.isSameDay(date, selectedDate);
            final isToday = DateUtils.isSameDay(date, today);

            return GestureDetector(
              onTap: () => onSelect(date),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                curve: Curves.easeOut,
                margin: const EdgeInsets.only(right: 10),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  gradient: isSelected
                      ? const LinearGradient(
                          colors: [AppColors.primary, AppColors.primaryDark],
                          begin: Alignment.topLeft, end: Alignment.bottomRight)
                      : null,
                  color: isSelected ? null
                      : (isToday
                          ? AppColors.primary.withValues(alpha: 0.1)
                          : Colors.transparent),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? Colors.transparent
                        : (isToday
                            ? AppColors.primary.withValues(alpha: 0.4)
                            : (isDark ? AppColors.borderDark : AppColors.borderLight)),
                    width: 1.5,
                  ),
                  boxShadow: isSelected
                      ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 8, offset: const Offset(0, 3))]
                      : [],
                ),
                child: Column(children: [
                  Text(DateFormat('E').format(date),
                      style: AppTypography.s12Medium(
                        color: isSelected ? Colors.white
                            : (isToday ? AppColors.primary : AppColors.textMuted),
                      )),
                  const SizedBox(height: 5),
                  Text(DateFormat('d').format(date),
                      style: AppTypography.s16Bold(
                        color: isSelected ? Colors.white
                            : (isToday ? AppColors.primary
                                : (isDark ? Colors.white : AppColors.textPrimary)),
                      )),
                  if (isToday && !isSelected) ...[
                    const SizedBox(height: 4),
                    Container(
                      width: 5, height: 5,
                      decoration: const BoxDecoration(
                          color: AppColors.primary, shape: BoxShape.circle),
                    ),
                  ],
                ]),
              ),
            );
          }),
        ),
      ),
    );
  }
}

// ── View toggle ───────────────────────────────────────────────────────────────
class _ViewToggle extends StatelessWidget {
  final bool isGrid, isDark;
  final ValueChanged<bool> onChanged;

  const _ViewToggle({required this.isGrid, required this.isDark, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.borderDark.withValues(alpha: 0.4)
            : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        _Tab(label: 'Daily View',    icon: Icons.view_agenda_outlined,
            selected: !isGrid, isDark: isDark, onTap: () => onChanged(false)),
        _Tab(label: 'Weekly Grid',   icon: Icons.grid_view_outlined,
            selected: isGrid,  isDark: isDark, onTap: () => onChanged(true)),
      ]),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected, isDark;
  final VoidCallback onTap;

  const _Tab({required this.label, required this.icon,
      required this.selected, required this.isDark, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final shadow = BoxShadow(
      color: selected ? Colors.black.withValues(alpha: 0.07) : Colors.transparent,
      blurRadius: selected ? 4 : 0, offset: const Offset(0, 2),
    );
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: selected
                ? (isDark ? const Color(0xFF1E293B) : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [shadow],
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 14,
                color: selected
                    ? (isDark ? Colors.white : AppColors.primary)
                    : (isDark ? AppColors.textMuted : AppColors.textSecondary)),
            const SizedBox(width: 6),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: AppTypography.s12SemiBold(
                color: selected
                    ? (isDark ? Colors.white : AppColors.textPrimary)
                    : (isDark ? AppColors.textMuted : AppColors.textSecondary),
              ),
              child: Text(label),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── Daily list ────────────────────────────────────────────────────────────────
class _DailyList extends StatelessWidget {
  final List<Map<String, dynamic>> periods;
  final bool isDark;
  final Future<void> Function() onRefresh;

  const _DailyList({required this.periods, required this.isDark, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (periods.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: 300,
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.borderDark.withValues(alpha: 0.4)
                        : const Color(0xFFF1F5F9),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.weekend_outlined, size: 32,
                      color: isDark ? AppColors.textMuted : const Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 16),
                Text('No classes today',
                    style: AppTypography.s16SemiBold(
                        color: isDark ? AppColors.textMuted : const Color(0xFF64748B))),
                const SizedBox(height: 6),
                Text('Enjoy your day off!',
                    style: AppTypography.s13Regular(
                        color: isDark ? AppColors.textMuted.withValues(alpha: 0.6)
                            : const Color(0xFF94A3B8))),
              ]),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        itemCount: periods.length,
        itemBuilder: (_, i) => _PeriodCard(period: periods[i], isDark: isDark),
      ),
    );
  }
}

// ── Period card ───────────────────────────────────────────────────────────────
class _PeriodCard extends StatelessWidget {
  final Map<String, dynamic> period;
  final bool isDark;
  const _PeriodCard({required this.period, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final pNum = period['periodNumber'] as int? ?? 0;
    final isBreak = period['isBreak'] as bool? ?? false;
    final breakName = period['breakName'] as String?;
    final subject = period['subject'] as Map<String, dynamic>?;
    final teacher = period['teacher'] as Map<String, dynamic>?;
    final startTime = period['startTime'] as String? ?? '';
    final endTime = period['endTime'] as String? ?? '';
    final timeLabel = (startTime.isNotEmpty && endTime.isNotEmpty)
        ? '$startTime – $endTime' : '';

    if (isBreak) return _BreakCard(pNum: pNum, breakName: breakName, timeLabel: timeLabel, isDark: isDark);

    if (subject == null) return _FreeCard(pNum: pNum, timeLabel: timeLabel, isDark: isDark);

    final subName = subject['name'] as String? ?? 'Subject';
    final colorHex = subject['color'] as String? ?? '#1A56E8';
    Color color;
    try { color = Color(int.parse(colorHex.replaceFirst('#', '0xFF'))); }
    catch (_) { color = AppColors.primary; }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.borderDark : color.withValues(alpha: 0.2)),
        boxShadow: isDark ? [] : [
          BoxShadow(color: color.withValues(alpha: 0.08),
              blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(children: [
            Container(width: 5, color: color),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                child: Row(children: [
                  // Period badge
                  Container(
                    width: 42, height: 42,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDark ? 0.2 : 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text('P$pNum',
                          style: AppTypography.s12Bold(color: color)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(subName,
                            style: AppTypography.s15SemiBold(
                                color: isDark ? Colors.white : AppColors.textPrimary)),
                        if (teacher != null && (teacher['name'] as String? ?? '').isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Row(children: [
                            Icon(Icons.person_outline_rounded, size: 13,
                                color: isDark ? AppColors.textMuted : AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(teacher['name'] as String,
                                style: AppTypography.s12Regular(
                                    color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                          ]),
                        ],
                        if (timeLabel.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Row(children: [
                            Icon(Icons.access_time_rounded, size: 12,
                                color: color.withValues(alpha: 0.7)),
                            const SizedBox(width: 4),
                            Text(timeLabel,
                                style: AppTypography.s11Regular(
                                    color: color.withValues(alpha: isDark ? 0.8 : 0.7))),
                          ]),
                        ],
                      ],
                    ),
                  ),
                  // Subject color dot accent
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.5), shape: BoxShape.circle),
                  ),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── Break card ────────────────────────────────────────────────────────────────
class _BreakCard extends StatelessWidget {
  final int pNum;
  final String? breakName;
  final String timeLabel;
  final bool isDark;
  const _BreakCard({required this.pNum, required this.breakName,
      required this.timeLabel, required this.isDark});

  @override
  Widget build(BuildContext context) {
    const amber = Color(0xFFF59E0B);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark
            ? amber.withValues(alpha: 0.1)
            : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: amber.withValues(alpha: isDark ? 0.25 : 0.35)),
      ),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(
            color: amber.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: const Center(child: Text('☕', style: TextStyle(fontSize: 20))),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(breakName?.isNotEmpty == true ? breakName! : 'Break',
                style: AppTypography.s14SemiBold(
                    color: isDark ? const Color(0xFFFDE68A) : const Color(0xFFB45309))),
            if (timeLabel.isNotEmpty) ...[
              const SizedBox(height: 3),
              Row(children: [
                Icon(Icons.access_time_rounded, size: 12,
                    color: amber.withValues(alpha: 0.7)),
                const SizedBox(width: 4),
                Text(timeLabel,
                    style: AppTypography.s11Regular(
                        color: isDark ? amber.withValues(alpha: 0.7)
                            : const Color(0xFFD97706))),
              ]),
            ],
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: amber.withValues(alpha: isDark ? 0.2 : 0.12),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text('Break',
              style: AppTypography.s11SemiBold(
                  color: isDark ? const Color(0xFFFDE68A) : const Color(0xFFB45309))),
        ),
      ]),
    );
  }
}

// ── Free period card ──────────────────────────────────────────────────────────
class _FreeCard extends StatelessWidget {
  final int pNum;
  final String timeLabel;
  final bool isDark;
  const _FreeCard({required this.pNum, required this.timeLabel, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final muted = isDark ? AppColors.textMuted : const Color(0xFF94A3B8);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.cardDark.withValues(alpha: 0.4)
            : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border(
          left: BorderSide(color: muted.withValues(alpha: 0.4), width: 3),
          top: BorderSide(color: isDark ? AppColors.borderDark.withValues(alpha: 0.5)
              : const Color(0xFFE2E8F0)),
          right: BorderSide(color: isDark ? AppColors.borderDark.withValues(alpha: 0.5)
              : const Color(0xFFE2E8F0)),
          bottom: BorderSide(color: isDark ? AppColors.borderDark.withValues(alpha: 0.5)
              : const Color(0xFFE2E8F0)),
        ),
      ),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(
            color: isDark ? AppColors.borderDark : const Color(0xFFE2E8F0),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text('P$pNum',
                style: AppTypography.s12Bold(color: muted)),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Free Period',
                style: AppTypography.s14Medium(color: muted)),
            if (timeLabel.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(timeLabel,
                  style: AppTypography.s11Regular(
                      color: muted.withValues(alpha: 0.7))),
            ],
          ]),
        ),
        Icon(Icons.self_improvement_outlined, size: 20,
            color: muted.withValues(alpha: 0.5)),
      ]),
    );
  }
}

// ── Weekly grid ───────────────────────────────────────────────────────────────
class _WeeklyGrid extends StatelessWidget {
  final Map<String, dynamic> timetable;
  final int maxPeriod;
  final bool isDark;
  final Future<void> Function() onRefresh;

  const _WeeklyGrid({required this.timetable, required this.maxPeriod,
      required this.isDark, required this.onRefresh});

  List<Map<String, dynamic>> _periodsForDay(String day) {
    final list = (timetable[day] as List<dynamic>? ?? []);
    return list.whereType<Map>().map((p) => Map<String, dynamic>.from(p)).toList();
  }

  Map<String, dynamic>? _periodAt(String day, int pNum) {
    for (final p in _periodsForDay(day)) {
      if ((p['periodNumber'] as int? ?? 0) == pNum) return p;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final periodNums = List.generate(maxPeriod, (i) => i + 1);
    final headerBg = isDark ? const Color(0xFF1E293B) : const Color(0xFF0F172A);
    final dayColBg = isDark
        ? AppColors.borderDark.withValues(alpha: 0.2)
        : const Color(0xFFF8FAFC);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Table(
                defaultColumnWidth: const FixedColumnWidth(104),
                columnWidths: const {0: FixedColumnWidth(70)},
                border: TableBorder.all(
                  color: isDark ? AppColors.borderDark : const Color(0xFFE2E8F0),
                  width: 1,
                ),
                children: [
                  // ── Header row: Day | P1 | P2 | … ────────────────────────
                  TableRow(
                    decoration: BoxDecoration(color: headerBg),
                    children: [
                      _cell(
                        child: Text('Day',
                            textAlign: TextAlign.center,
                            style: AppTypography.s12Bold(color: Colors.white70)),
                        vPad: 12,
                      ),
                      ...periodNums.map((p) => _cell(
                        child: Text('P$p',
                            textAlign: TextAlign.center,
                            style: AppTypography.s12Bold(color: Colors.white)),
                        vPad: 12,
                      )),
                    ],
                  ),
                  // ── Data rows ─────────────────────────────────────────────
                  ..._kDays.map((day) {
                    return TableRow(
                      decoration: BoxDecoration(
                          color: isDark ? AppColors.cardDark : Colors.white),
                      children: [
                        // Day label
                        TableCell(
                          verticalAlignment: TableCellVerticalAlignment.middle,
                          child: Container(
                            color: dayColBg,
                            padding: const EdgeInsets.symmetric(
                                vertical: 16, horizontal: 4),
                            child: Text(
                              _kDayLabels[day] ?? '',
                              textAlign: TextAlign.center,
                              style: AppTypography.s12Bold(
                                  color: isDark ? Colors.white : AppColors.textPrimary),
                            ),
                          ),
                        ),
                        // Period cells
                        ...periodNums.map((pNum) {
                          final p = _periodAt(day, pNum);
                          if (p == null) {
                            return TableCell(
                              verticalAlignment: TableCellVerticalAlignment.middle,
                              child: Container(
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(vertical: 20),
                                child: Text('—',
                                    style: AppTypography.s12Regular(
                                        color: isDark
                                            ? AppColors.textMuted.withValues(alpha: 0.35)
                                            : const Color(0xFFCBD5E1))),
                              ),
                            );
                          }
                          final isBreak = p['isBreak'] as bool? ?? false;
                          if (isBreak) {
                            return TableCell(
                              verticalAlignment: TableCellVerticalAlignment.middle,
                              child: Container(
                                margin: const EdgeInsets.all(4),
                                padding: const EdgeInsets.symmetric(
                                    vertical: 8, horizontal: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF59E0B)
                                      .withValues(alpha: isDark ? 0.15 : 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: const Color(0xFFF59E0B)
                                        .withValues(alpha: 0.3),
                                  ),
                                ),
                                child: Text(
                                  p['breakName'] as String? ?? 'Break',
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.inter(
                                      size: 10, weight: FontWeight.w700,
                                      color: const Color(0xFFD97706)),
                                ),
                              ),
                            );
                          }
                          final sub = p['subject'] as Map<String, dynamic>?;
                          if (sub == null) {
                            return TableCell(
                              verticalAlignment: TableCellVerticalAlignment.middle,
                              child: Container(
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(vertical: 20),
                                child: Text('—',
                                    style: AppTypography.s12Regular(
                                        color: isDark
                                            ? AppColors.textMuted.withValues(alpha: 0.35)
                                            : const Color(0xFFCBD5E1))),
                              ),
                            );
                          }
                          final subName = sub['name'] as String? ?? '';
                          final colorHex = sub['color'] as String? ?? '#1A56E8';
                          Color color;
                          try {
                            color = Color(int.parse(
                                colorHex.replaceFirst('#', '0xFF')));
                          } catch (_) { color = AppColors.primary; }

                          return TableCell(
                            verticalAlignment: TableCellVerticalAlignment.middle,
                            child: Container(
                              margin: const EdgeInsets.all(4),
                              padding: const EdgeInsets.symmetric(
                                  vertical: 8, horizontal: 4),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: isDark ? 0.15 : 0.08),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: color.withValues(alpha: 0.3)),
                              ),
                              child: Text(
                                subName,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.inter(
                                    size: 11, weight: FontWeight.w700, color: color),
                              ),
                            ),
                          );
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
    );
  }

  TableCell _cell({required Widget child, double vPad = 14}) => TableCell(
    verticalAlignment: TableCellVerticalAlignment.middle,
    child: Padding(
      padding: EdgeInsets.symmetric(vertical: vPad, horizontal: 6),
      child: child,
    ),
  );
}
