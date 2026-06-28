import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/exams/presentation/widgets/exam_result_card.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentExamsScreen extends StatefulWidget {
  const StudentExamsScreen({super.key});
  @override
  State<StudentExamsScreen> createState() => _StudentExamsScreenState();
}

class _StudentExamsScreenState extends State<StudentExamsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  List<dynamic> _exams = [];
  List<dynamic> _results = [];
  String? _classId;
  bool _loadingExams = true;
  bool _loadingResults = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final sp = context.read<StudentProfileProvider>();
    final classId = sp.profile?.classId;
    final studentId = sp.profile?.id;

    setState(() {
      _classId = classId;
      _loadingExams = true;
      _loadingResults = true;
    });

    if (classId != null) {
      try {
        final r = await ApiClient.get('/exams', params: {'classId': classId});
        setState(() {
          _exams = r.data['exams'] as List<dynamic>? ?? [];
          _loadingExams = false;
        });
      } catch (_) {
        setState(() => _loadingExams = false);
      }
    } else {
      setState(() => _loadingExams = false);
    }

    if (studentId != null) {
      try {
        final r = await ApiClient.get('/exams/results',
            params: {'studentId': studentId});
        setState(() {
          _results = r.data['results'] as List<dynamic>? ?? [];
          _loadingResults = false;
        });
      } catch (_) {
        setState(() => _loadingResults = false);
      }
    } else {
      setState(() => _loadingResults = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            child: TabBar(
              controller: _tab,
              tabs: const [Tab(text: 'Schedule'), Tab(text: 'Results')],
              indicatorColor: AppColors.primary,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textMuted,
              labelStyle: AppTypography.s13SemiBold(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tab,
              children: [
                _ExamScheduleTab(
                    exams: _exams,
                    classId: _classId,
                    loading: _loadingExams,
                    onRefresh: _load,
                    isDark: isDark),
                _ExamResultsTab(
                    results: _results,
                    loading: _loadingResults,
                    onRefresh: _load,
                    isDark: isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
class _ExamScheduleTab extends StatelessWidget {
  final List<dynamic> exams;
  final String? classId;
  final bool loading;
  final Future<void> Function() onRefresh;
  final bool isDark;
  const _ExamScheduleTab(
      {required this.exams,
      required this.classId,
      required this.loading,
      required this.onRefresh,
      required this.isDark});

  static String _classIdOf(dynamic c) {
    if (c is Map) return (c['_id'] ?? '').toString();
    if (c is String) return c;
    return '';
  }

  static String _shortDate(dynamic d) {
    try {
      return DateFormat('dd MMM').format(DateTime.parse(d.toString()).toLocal());
    } catch (_) {
      return '';
    }
  }

  // Show a time with AM/PM, handling both 24h ("20:00") and "h:mm A" strings.
  static String _fmtTime(dynamic raw) {
    final t = (raw ?? '').toString().trim();
    if (t.isEmpty) return '';
    final m = RegExp(r'^(\d{1,2}):(\d{2})\s*(AM|PM)?$', caseSensitive: false)
        .firstMatch(t);
    if (m == null) return t;
    final ap = m.group(3)?.toUpperCase();
    final min = m.group(2)!;
    if (ap != null) return '${int.parse(m.group(1)!)}:$min $ap';
    final h = int.parse(m.group(1)!);
    final period = h >= 12 ? 'PM' : 'AM';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '$h12:$min $period';
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SkeletonList(showLeading: false, itemHeight: 110);
    }
    if (exams.isEmpty) {
      return Center(
          child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.quiz_outlined, size: 56, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text('No exams scheduled',
              style: AppTypography.s16SemiBold(color: AppColors.textMuted)),
        ],
      ));
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: exams.length,
        itemBuilder: (_, i) {
          final e = exams[i];
          final name = e['name'] as String? ?? 'Exam';
          final isPublished = e['isResultPublished'] as bool? ?? false;
          final dateStr = _fmtDate(e['examDate'] ?? e['date'] ?? e['startDate']);

          // Subject-wise schedule for this student's class.
          final raw = e['schedule'];
          final List<Map> schedule = [];
          if (raw is List) {
            for (final s in raw) {
              if (s is! Map) continue;
              final cid = _classIdOf(s['class']);
              if (cid.isEmpty || classId == null || classId!.isEmpty ||
                  cid == classId) {
                schedule.add(s);
              }
            }
          }
          schedule.sort((a, b) => (a['date']?.toString() ?? '')
              .compareTo(b['date']?.toString() ?? ''));

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                    child: Text(name,
                        style: AppTypography.s15SemiBold(
                            color: isDark
                                ? Colors.white
                                : AppColors.textPrimary))),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: (isPublished
                            ? AppColors.accentGreen
                            : AppColors.warning)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isPublished ? 'Results Out' : 'Scheduled',
                    style: AppTypography.s12SemiBold(
                        color: isPublished
                            ? AppColors.accentGreen
                            : AppColors.warning),
                  ),
                ),
              ]),
              if (dateStr.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(children: [
                  Icon(Icons.calendar_today_outlined,
                      size: 13, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(dateStr,
                      style:
                          AppTypography.s13Regular(color: AppColors.textMuted)),
                ]),
              ],
              if (schedule.isNotEmpty) ...[
                const SizedBox(height: 12),
                Divider(
                    height: 1,
                    color: isDark
                        ? AppColors.borderDark
                        : AppColors.borderLight),
                const SizedBox(height: 10),
                Text('EXAM SCHEDULE',
                    style: AppTypography.s11SemiBold(color: AppColors.textMuted)
                        .copyWith(letterSpacing: 0.4)),
                const SizedBox(height: 8),
                ...schedule.map((s) {
                  final sName = s['subject'] is Map
                      ? (s['subject']['name'] ?? '').toString()
                      : (s['subject']?.toString() ?? '');
                  final sDate = _shortDate(s['date']);
                  final start = _fmtTime(s['startTime']);
                  final end = _fmtTime(s['endTime']);
                  final time =
                      [start, end].where((t) => t.isNotEmpty).join(' – ');
                  final meta = [
                    if (sDate.isNotEmpty) sDate,
                    if (time.isNotEmpty) time
                  ].join(' · ');
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            margin: const EdgeInsets.only(top: 6, right: 9),
                            decoration: BoxDecoration(
                                color:
                                    AppColors.primary.withValues(alpha: 0.55),
                                shape: BoxShape.circle),
                          ),
                          Expanded(
                            child: Text(sName.isEmpty ? 'Subject' : sName,
                                style: AppTypography.s13SemiBold(
                                    color: isDark
                                        ? Colors.white
                                        : AppColors.textPrimary)),
                          ),
                          const SizedBox(width: 10),
                          Text(meta.isEmpty ? 'TBA' : meta,
                              style: AppTypography.s12Regular(
                                  color: AppColors.textSecondary)),
                        ]),
                  );
                }),
              ],
            ]),
          );
        },
      ),
    );
  }

  String _fmtDate(dynamic d) {
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(d.toString()));
    } catch (_) {
      return d?.toString() ?? '';
    }
  }
}

// ─── Results Tab ──────────────────────────────────────────────────────────────
class _ExamResultsTab extends StatelessWidget {
  final List<dynamic> results;
  final bool loading;
  final Future<void> Function() onRefresh;
  final bool isDark;
  const _ExamResultsTab(
      {required this.results,
      required this.loading,
      required this.onRefresh,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SkeletonList(showLeading: false, itemHeight: 140);
    }
    if (results.isEmpty) {
      return Center(
          child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.emoji_events_outlined,
              size: 56, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text('No results published yet',
              style: AppTypography.s16SemiBold(color: AppColors.textMuted)),
        ],
      ));
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: results.length,
        itemBuilder: (_, i) => ExamResultCard(
          result: Map<String, dynamic>.from(results[i] as Map),
          isDark: isDark,
        ),
      ),
    );
  }
}
