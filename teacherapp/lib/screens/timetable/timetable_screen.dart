import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/timetable.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/empty_state.dart';

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});
  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  static const _days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  static const _dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  List<TimetableEntry> _entries = [];
  bool _loading = true;
  late int _selectedDayIndex;

  @override
  void initState() {
    super.initState();
    // Auto-select today (Mon=1…Sat=6; Sunday falls back to Monday)
    final wd = DateTime.now().weekday; // 1=Mon … 7=Sun
    _selectedDayIndex = (wd >= 1 && wd <= 6) ? wd - 1 : 0;
    _fetch();
  }

  Future<void> _fetch() async {
    final profile = context.read<TeacherProfileProvider>().profile;
    final employeeMongoId = profile?.employee.id;
    try {
      final res = await ApiClient.get('/timetable', params: {
        if (employeeMongoId != null && employeeMongoId.isNotEmpty)
          'teacherId': employeeMongoId,
      });

      final entries = <TimetableEntry>[];
      final timetables = res.data['timetables'] as List? ?? [];
      for (final tt in timetables) {
        final classData = tt['class'] as Map<String, dynamic>?;
        final schedule = tt['schedule'] as List? ?? [];
        for (final daySchedule in schedule) {
          final day = daySchedule['day'] as String? ?? '';
          final periods = daySchedule['periods'] as List? ?? [];
          for (final p in periods) {
            entries.add(TimetableEntry(
              id: p['_id'] ?? '',
              day: day,
              period: p['periodNumber'] ?? 0,
              startTime: p['startTime'],
              endTime: p['endTime'],
              subject: p['subject'] is Map ? SubjectRef.fromJson(p['subject']) : null,
              classRef: classData != null ? ClassRef.fromJson(classData) : null,
            ));
          }
        }
      }
      setState(() { _entries = entries; _loading = false; });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Color _subjectColor(String? hex) {
    if (hex == null || hex.isEmpty) return kPrimary;
    try {
      return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16));
    } catch (_) { return kPrimary; }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Timetable')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _entries.isEmpty
              ? const EmptyState(
                  icon: Icons.calendar_today_outlined,
                  title: 'No timetable assigned',
                  subtitle: 'Your timetable will appear here once set up by admin',
                )
              : Column(
                  children: [
                    _DayTabBar(
                      days: _dayShort,
                      selected: _selectedDayIndex,
                      onSelect: (i) => setState(() => _selectedDayIndex = i),
                      entryCounts: List.generate(_days.length, (i) {
                        final day = _days[i];
                        return _entries
                            .where((e) => e.day.toLowerCase() == day.toLowerCase())
                            .length;
                      }),
                    ),
                    Expanded(child: _dayView()),
                  ],
                ),
    );
  }

  Widget _dayView() {
    final day = _days[_selectedDayIndex];
    final dayEntries = _entries
        .where((e) => e.day.toLowerCase() == day.toLowerCase())
        .toList()
      ..sort((a, b) => a.period.compareTo(b.period));

    if (dayEntries.isEmpty) {
      return const EmptyState(
        icon: Icons.free_breakfast_outlined,
        title: 'No periods',
        subtitle: 'No classes assigned for this day',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: dayEntries.length,
      itemBuilder: (_, i) => _PeriodCard(
        entry: dayEntries[i],
        color: _subjectColor(dayEntries[i].subject?.color),
      ),
    );
  }
}

// ── Day tab bar ────────────────────────────────────────────────────────────────
class _DayTabBar extends StatelessWidget {
  final List<String> days;
  final int selected;
  final void Function(int) onSelect;
  final List<int> entryCounts;

  const _DayTabBar({
    required this.days, required this.selected,
    required this.onSelect, required this.entryCounts,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kCardBg,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: List.generate(days.length, (i) {
          final isSelected = selected == i;
          final hasPeriods = entryCounts[i] > 0;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? kPrimary : kBackground,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isSelected ? kPrimary : kBorder,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(days[i], style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700,
                      color: isSelected ? Colors.white : kTextSecondary,
                    )),
                    if (hasPeriods) ...[
                      const SizedBox(height: 3),
                      Container(
                        width: 5, height: 5,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSelected
                              ? Colors.white.withValues(alpha: 0.8)
                              : kPrimary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Period card ────────────────────────────────────────────────────────────────
class _PeriodCard extends StatelessWidget {
  final TimetableEntry entry;
  final Color color;

  const _PeriodCard({required this.entry, required this.color});

  @override
  Widget build(BuildContext context) {
    final bgColor = Color.fromARGB(20, color.r.round(), color.g.round(), color.b.round());

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: kCardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6, offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Left: subject name + class
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.subject?.name ?? 'Period ${entry.period}',
                  style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700, color: color,
                  ),
                ),
                if (entry.classRef != null) ...[
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(Icons.class_outlined, size: 13, color: kTextMuted),
                      const SizedBox(width: 4),
                      Text(entry.classRef!.fullName, style: const TextStyle(
                        fontSize: 13, color: kTextSecondary, fontWeight: FontWeight.w500,
                      )),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // Right: period pill + time below
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: color.withValues(alpha: 0.35)),
                ),
                child: Text('Period ${entry.period}', style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700, color: color,
                )),
              ),
              if (entry.startTime != null) ...[
                const SizedBox(height: 5),
                Text(
                  '${entry.startTime} – ${entry.endTime ?? ''}',
                  style: const TextStyle(fontSize: 11, color: kTextMuted),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
