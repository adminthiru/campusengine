import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
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
  final bool loading;
  final Future<void> Function() onRefresh;
  final bool isDark;
  const _ExamScheduleTab(
      {required this.exams,
      required this.loading,
      required this.onRefresh,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    if (loading)
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
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
        padding: const EdgeInsets.all(16),
        itemCount: exams.length,
        itemBuilder: (_, i) {
          final e = exams[i];
          final name = e['name'] as String? ?? 'Exam';
          final isPublished = e['isPublished'] as bool? ?? false;
          final dateStr = _fmtDate(e['date'] ?? e['startDate']);
          final subjects = e['subjects'] as List<dynamic>? ?? [];

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
              if (subjects.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: subjects.map((s) {
                      final sName = s['subject']?['name'] as String? ??
                          s['name'] as String? ??
                          '';
                      final sDate = _fmtDate(s['date']);
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.07),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          sDate.isNotEmpty ? '$sName · $sDate' : sName,
                          style: AppTypography.s11Regular(
                              color: AppColors.primary),
                        ),
                      );
                    }).toList()),
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
    if (loading)
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
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
        padding: const EdgeInsets.all(16),
        itemCount: results.length,
        itemBuilder: (_, i) {
          final r = results[i];
          final examName = r['exam']?['name'] as String? ?? 'Exam';
          final marks = r['marks'] as List<dynamic>? ?? [];
          num totalMarks = 0, totalMax = 0;
          for (final m in marks) {
            totalMarks += (m['marksObtained'] as num? ?? 0);
            totalMax += (m['maxMarks'] as num? ?? 100);
          }
          final pct = totalMax > 0 ? (totalMarks / totalMax * 100).round() : 0;
          final grade = r['grade'] as String? ?? _grade(pct);

          return Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                    child: Text(examName,
                        style: AppTypography.s15SemiBold(
                            color: isDark
                                ? Colors.white
                                : AppColors.textPrimary))),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _gradeColor(pct).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(grade,
                        style: AppTypography.s16Bold(color: _gradeColor(pct))),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Text('Total: ',
                    style:
                        AppTypography.s13Regular(color: AppColors.textMuted)),
                Text('$totalMarks / $totalMax',
                    style: AppTypography.s13SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary)),
                const SizedBox(width: 12),
                Text('$pct%',
                    style: AppTypography.s13SemiBold(color: _gradeColor(pct))),
              ]),
              if (marks.isNotEmpty) ...[
                const SizedBox(height: 10),
                const Divider(height: 1),
                const SizedBox(height: 10),
                ...marks.map((m) {
                  final subj = m['subject']?['name'] as String? ?? 'Subject';
                  final got = (m['marksObtained'] as num? ?? 0).toInt();
                  final max = (m['maxMarks'] as num? ?? 100).toInt();
                  final sPct = max > 0 ? (got / max * 100).round() : 0;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      Expanded(
                          child: Text(subj,
                              style: AppTypography.s13Regular(
                                  color: isDark
                                      ? Colors.white70
                                      : AppColors.textSecondary))),
                      Text('$got/$max',
                          style: AppTypography.s13SemiBold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      const SizedBox(width: 8),
                      Text('$sPct%',
                          style: AppTypography.s12Regular(
                              color: _gradeColor(sPct))),
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

  String _grade(int pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  }

  Color _gradeColor(num pct) {
    if (pct >= 75) return AppColors.accentGreen;
    if (pct >= 50) return AppColors.warning;
    return AppColors.accentRed;
  }
}
