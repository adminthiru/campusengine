import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/models/student.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/skeleton.dart';
import '../providers/exams_provider.dart';

class ExamsScreen extends StatelessWidget {
  const ExamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ExamsProvider()..initialize(),
      child: const _ExamsScreenContent(),
    );
  }
}

// ── State machine ─────────────────────────────────────────────────────────────

enum _View { list, detail, marks, results }

class _ExamsScreenContent extends StatefulWidget {
  const _ExamsScreenContent();

  @override
  State<_ExamsScreenContent> createState() => _ExamsScreenContentState();
}

class _ExamsScreenContentState extends State<_ExamsScreenContent> {
  _View _view = _View.list;
  ExamInfo? _selectedExam;
  ExamScheduleEntry? _selectedSchedule;
  String? _resultsClassId;

  void _openDetail(ExamInfo exam) => setState(() {
        _selectedExam = exam;
        _view = _View.detail;
      });

  void _openMarks(ExamScheduleEntry s) {
    final classId = s.classId;
    final subjectId = s.subjectId;
    final exam = _selectedExam;
    if (classId == null || subjectId == null || exam == null) return;
    setState(() {
      _selectedSchedule = s;
      _view = _View.marks;
    });
    context
        .read<ExamsProvider>()
        .fetchStudentsAndResults(classId, exam.id, subjectId);
  }

  void _openResults({String? classId}) {
    final exam = _selectedExam;
    if (exam == null) return;
    setState(() {
      _resultsClassId = classId;
      _view = _View.results;
    });
    context.read<ExamsProvider>().fetchExamResults(exam.id, classId: classId);
  }

  void _back() {
    if (_view == _View.marks || _view == _View.results) {
      setState(() {
        _selectedSchedule = null;
        _view = _View.detail;
      });
    } else {
      setState(() {
        _selectedExam = null;
        _view = _View.list;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_view == _View.marks &&
        _selectedExam != null &&
        _selectedSchedule != null) {
      return _MarksEntryView(
        exam: _selectedExam!,
        schedule: _selectedSchedule!,
        onBack: _back,
      );
    }
    if (_view == _View.results && _selectedExam != null) {
      return _ResultsView(
        exam: _selectedExam!,
        classId: _resultsClassId,
        onBack: _back,
      );
    }
    if (_view == _View.detail && _selectedExam != null) {
      return _ExamDetailView(
        exam: _selectedExam!,
        onBack: _back,
        onSelectSchedule: _openMarks,
        onViewResults: _openResults,
        onExamUpdated: (updated) => setState(() => _selectedExam = updated),
        onExamDeleted: _back,
      );
    }

    if (!p.canEnterMarks && !p.isLoading && p.hasAnyPermission) {
      return _NoPermissionView(isDark: isDark);
    }

    return _ExamListView(onSelectExam: _openDetail);
  }
}

// ── No Permission ─────────────────────────────────────────────────────────────

class _NoPermissionView extends StatelessWidget {
  final bool isDark;
  const _NoPermissionView({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline,
                size: 64,
                color: isDark ? AppColors.textMuted : AppColors.textSecondary),
            const SizedBox(height: 16),
            Text('Access Restricted',
                style: AppTypography.s18Bold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 8),
            Text(
              'You do not have permission to view or enter exam marks.',
              style: AppTypography.s14Regular(
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Exam List ─────────────────────────────────────────────────────────────────

class _ExamListView extends StatefulWidget {
  final Function(ExamInfo) onSelectExam;
  const _ExamListView({required this.onSelectExam});

  @override
  State<_ExamListView> createState() => _ExamListViewState();
}

class _ExamListViewState extends State<_ExamListView> {
  String _statusFilter = '';

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final filtered = _statusFilter.isEmpty
        ? p.exams
        : p.exams.where((e) => e.status == _statusFilter).toList();

    final scheduled = p.exams.where((e) => e.status == 'scheduled').length;
    final ongoing = p.exams.where((e) => e.status == 'ongoing').length;
    final completed = p.exams.where((e) => e.status == 'completed').length;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                _StatChip('Scheduled', scheduled, AppColors.info, isDark),
                const SizedBox(width: 8),
                _StatChip('Ongoing', ongoing, AppColors.warning, isDark),
                const SizedBox(width: 8),
                _StatChip('Completed', completed, AppColors.success, isDark),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _FilterChip(
                  label: 'All',
                  selected: _statusFilter == '',
                  onTap: () => setState(() => _statusFilter = ''),
                  isDark: isDark,
                ),
                const SizedBox(width: 8),
                for (final s in [
                  'scheduled',
                  'ongoing',
                  'completed',
                  'cancelled'
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _FilterChip(
                      label: _cap(s),
                      selected: _statusFilter == s,
                      onTap: () => setState(() => _statusFilter = s),
                      isDark: isDark,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: p.isLoading
                ? const SkeletonList()
                : RefreshIndicator(
                    onRefresh: () => p.fetchExams(),
                    color: AppColors.primary,
                    child: filtered.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                              height:
                                  MediaQuery.of(context).size.height * 0.3),
                          Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.quiz_outlined,
                                    size: 52,
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary),
                                const SizedBox(height: 12),
                                Text(
                                  p.exams.isEmpty
                                      ? 'No exams yet'
                                      : 'No exams match the filter',
                                  style: AppTypography.s14Regular(
                                      color: isDark
                                          ? AppColors.textMuted
                                          : AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) => _ExamCard(
                          exam: filtered[i],
                          isDark: isDark,
                          onTap: () => widget.onSelectExam(filtered[i]),
                          onDelete: () =>
                              _confirmDelete(context, p, filtered[i]),
                        ),
                      ),
                  ),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(
      BuildContext context, ExamsProvider p, ExamInfo exam) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Exam'),
        content: Text('Delete "${exam.name}"? This also removes all results.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete',
                  style: TextStyle(color: AppColors.error))),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      final success = await p.deleteExam(exam.id);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content:
              Text(success ? 'Exam deleted' : (p.error ?? 'Delete failed')),
          backgroundColor: success ? AppColors.success : AppColors.error,
        ));
      }
    }
  }

  String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ── Exam Card ─────────────────────────────────────────────────────────────────

class _ExamCard extends StatelessWidget {
  final ExamInfo exam;
  final bool isDark;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _ExamCard(
      {required this.exam,
      required this.isDark,
      required this.onTap,
      required this.onDelete});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    Color statusBg;
    switch (exam.status) {
      case 'ongoing':
        statusColor = AppColors.warning;
        statusBg = AppColors.warning.withValues(alpha: 0.12);
        break;
      case 'completed':
        statusColor = AppColors.success;
        statusBg = AppColors.success.withValues(alpha: 0.12);
        break;
      case 'cancelled':
        statusColor = AppColors.error;
        statusBg = AppColors.error.withValues(alpha: 0.12);
        break;
      default:
        statusColor = AppColors.info;
        statusBg = AppColors.info.withValues(alpha: 0.12);
    }

    return InkWell(
      onTap: onTap,
      onLongPress: onDelete,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(exam.name,
                      style: AppTypography.s16Bold(
                          color:
                              isDark ? Colors.white : AppColors.textPrimary)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: statusBg, borderRadius: BorderRadius.circular(20)),
                  child: Text(exam.status.toUpperCase(),
                      style: AppTypography.s10Bold(color: statusColor)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.calendar_today,
                    size: 13,
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  exam.examDate != null
                      ? DateFormat('dd MMM yyyy').format(exam.examDate!)
                      : 'Date TBD',
                  style: AppTypography.s12Regular(
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                ),
                const SizedBox(width: 16),
                Icon(Icons.school_outlined,
                    size: 13,
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(exam.academicYear,
                    style: AppTypography.s12Regular(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary)),
              ],
            ),
            if (exam.isResultPublished) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.check_circle,
                      size: 13, color: AppColors.success),
                  const SizedBox(width: 4),
                  Text('Results Published',
                      style: AppTypography.s11Bold(color: AppColors.success)),
                ],
              ),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${exam.schedule.length} subject${exam.schedule.length == 1 ? '' : 's'}',
                    style: AppTypography.s12Regular(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary),
                  ),
                ),
                Icon(Icons.chevron_right,
                    size: 18,
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Exam Detail ───────────────────────────────────────────────────────────────

class _ExamDetailView extends StatelessWidget {
  final ExamInfo exam;
  final VoidCallback onBack;
  final Function(ExamScheduleEntry) onSelectSchedule;
  final Function({String? classId}) onViewResults;
  final Function(ExamInfo) onExamUpdated;
  final VoidCallback onExamDeleted;

  const _ExamDetailView({
    required this.exam,
    required this.onBack,
    required this.onSelectSchedule,
    required this.onViewResults,
    required this.onExamUpdated,
    required this.onExamDeleted,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Unique classes in schedule
    final classIds = exam.schedule
        .map((s) => s.classId)
        .whereType<String>()
        .where((id) => p.canViewResultsForClass(exam, id))
        .toSet()
        .toList();

    // Schedule entries this teacher is allowed to enter marks for
    final myEntries =
        exam.schedule.where((s) => p.canEnterMarksForEntry(s)).toList();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          // ── Header ────────────────────────────────────────────────────────
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            padding: const EdgeInsets.only(right: 4),
            child: Row(
              children: [
                IconButton(
                  icon: Icon(Icons.arrow_back_ios_new,
                      size: 20,
                      color: isDark ? Colors.white : AppColors.textPrimary),
                  onPressed: onBack,
                ),
                Expanded(
                  child: Text(exam.name,
                      style: AppTypography.s16Bold(
                          color: isDark ? Colors.white : AppColors.textPrimary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              children: [
                // ── Info card ──────────────────────────────────────────────
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(exam.name,
                          style: AppTypography.s18Bold(color: Colors.white)),
                      const SizedBox(height: 8),
                      Row(children: [
                        _InfoPill(_typeLabel(exam.type),
                            Colors.white.withValues(alpha: 0.25)),
                        const SizedBox(width: 8),
                        _InfoPill(exam.status.toUpperCase(),
                            Colors.white.withValues(alpha: 0.25)),
                        if (exam.isResultPublished) ...[
                          const SizedBox(width: 8),
                          _InfoPill('PUBLISHED',
                              AppColors.success.withValues(alpha: 0.7)),
                        ],
                      ]),
                      if (exam.examDate != null) ...[
                        const SizedBox(height: 8),
                        Row(children: [
                          Icon(Icons.calendar_today,
                              size: 13,
                              color: Colors.white.withValues(alpha: 0.8)),
                          const SizedBox(width: 6),
                          Text(
                            DateFormat('dd MMM yyyy').format(exam.examDate!),
                            style: AppTypography.s13Regular(
                                color: Colors.white.withValues(alpha: 0.9)),
                          ),
                        ]),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Schedule entries (only the ones this teacher can enter) ──
                Text('MY SUBJECTS',
                    style: AppTypography.s11Bold(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary)),
                const SizedBox(height: 10),
                if (p.isLoading)
                  const SkeletonShimmer(
                    child: Column(
                      children: [
                        SkeletonBox(
                            width: double.infinity, height: 72, radius: 12),
                        SizedBox(height: 10),
                        SkeletonBox(
                            width: double.infinity, height: 72, radius: 12),
                      ],
                    ),
                  )
                else if (myEntries.isEmpty)
                  _EmptyNote(
                    exam.schedule.isEmpty
                        ? 'No subjects scheduled for this exam yet'
                        : 'No subjects assigned to you for this exam',
                    isDark,
                  )
                else
                  ...myEntries.map((s) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ScheduleEntryCard(
                          entry: s,
                          isDark: isDark,
                          canEnter: !exam.isResultPublished,
                          onTap: () => onSelectSchedule(s),
                        ),
                      )),

                // ── Results section ─────────────────────────────────────────
                const SizedBox(height: 8),
                Text('RESULTS',
                    style: AppTypography.s11Bold(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary)),
                const SizedBox(height: 10),
                if (classIds.isEmpty)
                  _EmptyNote('No results available for your classes', isDark)
                else
                  ...classIds.map((cid) {
                    final entry = exam.schedule.firstWhere(
                        (s) => s.classId == cid,
                        orElse: () => exam.schedule.first);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _ResultsTile(
                        className: entry.classFullName,
                        isDark: isDark,
                        onTap: () => onViewResults(classId: cid),
                      ),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showEditSheet(BuildContext context, ExamsProvider p) async {
    await p.fetchClassesAndSubjects();
    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: p,
        child: _CreateEditExamSheet(existing: exam),
      ),
    );
  }

  String _typeLabel(String t) {
    switch (t) {
      case 'unit_test':
        return 'Unit Test';
      case 'mid_term':
        return 'Mid Term';
      case 'final':
        return 'Final Exam';
      default:
        return t.isNotEmpty ? t[0].toUpperCase() + t.substring(1) : 'Exam';
    }
  }
}

// ── Results View ──────────────────────────────────────────────────────────────

class _ResultsView extends StatelessWidget {
  final ExamInfo exam;
  final String? classId;
  final VoidCallback onBack;

  const _ResultsView(
      {required this.exam, required this.classId, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Resolve class name from schedule
    String className = 'Class';
    if (classId != null) {
      final match =
          exam.schedule.where((s) => s.classId == classId).firstOrNull;
      if (match != null) className = match.classFullName;
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            child: Row(
              children: [
                IconButton(
                  icon: Icon(Icons.arrow_back_ios_new,
                      size: 20,
                      color: isDark ? Colors.white : AppColors.textPrimary),
                  onPressed: onBack,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Results',
                          style: AppTypography.s16Bold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      Text('${exam.name} · $className',
                          style: AppTypography.s12Regular(
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: p.isResultsLoading
                ? const SkeletonList(showLeading: false)
                : p.results.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.bar_chart,
                                size: 52,
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary),
                            const SizedBox(height: 12),
                            Text('No results available yet',
                                style: AppTypography.s14Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary)),
                          ],
                        ),
                      )
                    : Column(
                        children: [
                          // Results header row
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 10),
                            color: isDark
                                ? AppColors.cardDark
                                : const Color(0xFFF1F5F9),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 36,
                                  child: Text('Rank',
                                      style: AppTypography.s11Bold(
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary)),
                                ),
                                Expanded(
                                    child: Text('Student',
                                        style: AppTypography.s11Bold(
                                            color: isDark
                                                ? AppColors.textMuted
                                                : AppColors.textSecondary))),
                                SizedBox(
                                  width: 60,
                                  child: Text('Marks',
                                      style: AppTypography.s11Bold(
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary),
                                      textAlign: TextAlign.center),
                                ),
                                SizedBox(
                                  width: 48,
                                  child: Text('%',
                                      style: AppTypography.s11Bold(
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary),
                                      textAlign: TextAlign.center),
                                ),
                                SizedBox(
                                  width: 36,
                                  child: Text('Grade',
                                      style: AppTypography.s11Bold(
                                          color: isDark
                                              ? AppColors.textMuted
                                              : AppColors.textSecondary),
                                      textAlign: TextAlign.center),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: ListView.separated(
                              padding: const EdgeInsets.only(bottom: 32),
                              itemCount: p.results.length,
                              separatorBuilder: (_, __) => Divider(
                                height: 1,
                                color: isDark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight,
                              ),
                              itemBuilder: (_, i) => _ResultRow(
                                result: p.results[i],
                                isDark: isDark,
                              ),
                            ),
                          ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  final ExamStudentResult result;
  final bool isDark;
  const _ResultRow({required this.result, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final pct = result.percentage;
    Color pctColor;
    if (pct >= 75) {
      pctColor = AppColors.success;
    } else if (pct >= 50) {
      pctColor = AppColors.warning;
    } else {
      pctColor = AppColors.error;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: isDark ? AppColors.bgDark : Colors.white,
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              result.rank > 0 ? '${result.rank}' : '-',
              style: AppTypography.s13Bold(
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(result.studentName,
                    style: AppTypography.s13SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if (result.admissionNumber != null)
                  Text(result.admissionNumber!,
                      style: AppTypography.s11Regular(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary)),
              ],
            ),
          ),
          SizedBox(
            width: 60,
            child: Text(
              '${result.totalMarksObtained.toInt()}/${result.totalMaxMarks.toInt()}',
              style: AppTypography.s12Medium(
                  color: isDark ? Colors.white : AppColors.textPrimary),
              textAlign: TextAlign.center,
            ),
          ),
          SizedBox(
            width: 48,
            child: Text(
              '${result.percentage.toStringAsFixed(1)}%',
              style: AppTypography.s12Bold(color: pctColor),
              textAlign: TextAlign.center,
            ),
          ),
          SizedBox(
            width: 36,
            child: Text(
              result.grade.isNotEmpty ? result.grade : '-',
              style: AppTypography.s12Bold(
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Create / Edit Exam Sheet ──────────────────────────────────────────────────

class _CreateEditExamSheet extends StatefulWidget {
  final ExamInfo? existing;
  const _CreateEditExamSheet({this.existing});

  @override
  State<_CreateEditExamSheet> createState() => _CreateEditExamSheetState();
}

class _CreateEditExamSheetState extends State<_CreateEditExamSheet> {
  final _nameCtrl = TextEditingController();
  String _type = 'unit_test';
  String _status = 'scheduled';
  DateTime? _examDate;
  final List<ScheduleEntryDraft> _schedule = [];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _nameCtrl.text = e.name;
      _type = e.type;
      _status = e.status;
      _examDate = e.examDate;
      for (final s in e.schedule) {
        if (s.classId != null && s.subjectId != null) {
          _schedule.add(ScheduleEntryDraft(
            classId: s.classId!,
            subjectId: s.subjectId!,
            className: s.classFullName,
            subjectName: s.subjectName ?? '',
            maxMarks: s.maxMarks,
            passingMarks: s.passingMarks,
            date: s.date,
          ));
        }
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isEdit = widget.existing != null;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.97,
      builder: (_, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.bgDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle + title
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(20)),
                border: Border(
                    bottom: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(isEdit ? 'Edit Exam' : 'Create Exam',
                        style: AppTypography.s18Bold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                  ),
                  TextButton(
                    onPressed: p.isActionLoading ? null : _save,
                    child: p.isActionLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: AppColors.primary),
                          )
                        : const Text('Save',
                            style: TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),

            // Form body
            Expanded(
              child: ListView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(16),
                children: [
                  // Name
                  _fieldLabel('Exam Name *', isDark),
                  const SizedBox(height: 6),
                  _textField(_nameCtrl, 'e.g. Unit Test 1', isDark),
                  const SizedBox(height: 16),

                  // Type + Status
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _fieldLabel('Type', isDark),
                            const SizedBox(height: 6),
                            _dropdown<String>(
                              value: _type,
                              items: const [
                                DropdownMenuItem(
                                    value: 'unit_test',
                                    child: Text('Unit Test')),
                                DropdownMenuItem(
                                    value: 'mid_term', child: Text('Mid Term')),
                                DropdownMenuItem(
                                    value: 'final', child: Text('Final Exam')),
                                DropdownMenuItem(
                                    value: 'other', child: Text('Other')),
                              ],
                              onChanged: (v) => setState(() => _type = v!),
                              isDark: isDark,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _fieldLabel('Status', isDark),
                            const SizedBox(height: 6),
                            _dropdown<String>(
                              value: _status,
                              items: const [
                                DropdownMenuItem(
                                    value: 'scheduled',
                                    child: Text('Scheduled')),
                                DropdownMenuItem(
                                    value: 'ongoing', child: Text('Ongoing')),
                                DropdownMenuItem(
                                    value: 'completed',
                                    child: Text('Completed')),
                              ],
                              onChanged: (v) => setState(() => _status = v!),
                              isDark: isDark,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Exam date
                  _fieldLabel('Exam Date (optional)', isDark),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () async {
                      final d = await showDatePicker(
                        context: context,
                        initialDate: _examDate ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2030),
                      );
                      if (d != null) setState(() => _examDate = d);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 13),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.cardDark
                            : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_today,
                              size: 16,
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary),
                          const SizedBox(width: 10),
                          Text(
                            _examDate != null
                                ? DateFormat('dd MMM yyyy').format(_examDate!)
                                : 'Select date',
                            style: AppTypography.s14Regular(
                                color: _examDate != null
                                    ? (isDark
                                        ? Colors.white
                                        : AppColors.textPrimary)
                                    : AppColors.textMuted),
                          ),
                          const Spacer(),
                          if (_examDate != null)
                            GestureDetector(
                              onTap: () => setState(() => _examDate = null),
                              child: const Icon(Icons.close,
                                  size: 16, color: AppColors.textMuted),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Schedule header
                  Row(
                    children: [
                      Expanded(
                        child: Text('SCHEDULE',
                            style: AppTypography.s11Bold(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                      ),
                      TextButton.icon(
                        onPressed: p.isMetaLoading
                            ? null
                            : () => _addEntry(context, p),
                        icon: const Icon(Icons.add,
                            size: 16, color: AppColors.primary),
                        label: const Text('Add Entry',
                            style: TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600,
                                fontSize: 13)),
                        style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (p.isMetaLoading)
                    const SkeletonShimmer(
                      child: SkeletonBox(
                          width: double.infinity, height: 80, radius: 10),
                    )
                  else if (_schedule.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.cardDark
                            : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight),
                      ),
                      child: Center(
                        child: Text('No schedule entries yet. Tap Add Entry.',
                            style: AppTypography.s13Regular(
                                color: AppColors.textMuted)),
                      ),
                    )
                  else
                    ..._schedule.asMap().entries.map((entry) {
                      final i = entry.key;
                      final s = entry.value;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ScheduleDraftCard(
                          entry: s,
                          index: i,
                          isDark: isDark,
                          classes: p.availableClasses,
                          subjects: p.availableSubjects,
                          onRemove: () => setState(() => _schedule.removeAt(i)),
                          onChanged: () => setState(() {}),
                        ),
                      );
                    }),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _addEntry(BuildContext context, ExamsProvider p) {
    if (p.availableClasses.isEmpty || p.availableSubjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('No classes/subjects found'),
        backgroundColor: AppColors.error,
      ));
      return;
    }
    setState(() {
      _schedule.add(ScheduleEntryDraft(
        classId: p.availableClasses.first.id,
        subjectId: p.availableSubjects.first.id,
        className: p.availableClasses.first.displayName,
        subjectName: p.availableSubjects.first.name,
      ));
    });
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Exam name is required'),
        backgroundColor: AppColors.error,
      ));
      return;
    }
    final p = context.read<ExamsProvider>();
    bool success;
    if (widget.existing != null) {
      success = await p.updateExam(
        widget.existing!.id,
        name: name,
        type: _type,
        status: _status,
        examDate: _examDate,
        schedule: _schedule,
      );
    } else {
      success = await p.createExam(
        name: name,
        type: _type,
        status: _status,
        examDate: _examDate,
        schedule: _schedule,
      );
    }
    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(success
            ? (widget.existing != null ? 'Exam updated!' : 'Exam created!')
            : (p.error ?? 'Something went wrong')),
        backgroundColor: success ? AppColors.success : AppColors.error,
      ));
    }
  }

  Widget _fieldLabel(String label, bool isDark) => Text(label,
      style: AppTypography.s12SemiBold(
          color: isDark ? AppColors.textMuted : AppColors.textSecondary));

  Widget _textField(TextEditingController ctrl, String hint, bool isDark) {
    return TextField(
      controller: ctrl,
      style: AppTypography.s14Regular(
          color: isDark ? Colors.white : AppColors.textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppTypography.s14Regular(color: AppColors.textMuted),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        filled: true,
        fillColor: isDark ? AppColors.cardDark : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(
                color: isDark ? AppColors.borderDark : AppColors.borderLight)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(
                color: isDark ? AppColors.borderDark : AppColors.borderLight)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      ),
    );
  }

  Widget _dropdown<T>({
    required T value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          dropdownColor: isDark ? AppColors.cardDark : Colors.white,
          style: AppTypography.s14Regular(
              color: isDark ? Colors.white : AppColors.textPrimary),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

// ── Schedule draft card (inside create/edit sheet) ────────────────────────────

class _ScheduleDraftCard extends StatefulWidget {
  final ScheduleEntryDraft entry;
  final int index;
  final bool isDark;
  final List<ClassOption> classes;
  final List<SubjectOption> subjects;
  final VoidCallback onRemove;
  final VoidCallback onChanged;

  const _ScheduleDraftCard({
    required this.entry,
    required this.index,
    required this.isDark,
    required this.classes,
    required this.subjects,
    required this.onRemove,
    required this.onChanged,
  });

  @override
  State<_ScheduleDraftCard> createState() => _ScheduleDraftCardState();
}

class _ScheduleDraftCardState extends State<_ScheduleDraftCard> {
  late final TextEditingController _maxCtrl;
  late final TextEditingController _passCtrl;

  @override
  void initState() {
    super.initState();
    _maxCtrl = TextEditingController(text: '${widget.entry.maxMarks}');
    _passCtrl = TextEditingController(text: '${widget.entry.passingMarks}');
  }

  @override
  void dispose() {
    _maxCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final entry = widget.entry;

    // Validate dropdown values exist in lists
    final classId = widget.classes.any((c) => c.id == entry.classId)
        ? entry.classId
        : (widget.classes.isNotEmpty ? widget.classes.first.id : entry.classId);
    final subjectId = widget.subjects.any((s) => s.id == entry.subjectId)
        ? entry.subjectId
        : (widget.subjects.isNotEmpty
            ? widget.subjects.first.id
            : entry.subjectId);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with remove
          Row(
            children: [
              Text('Entry ${widget.index + 1}',
                  style: AppTypography.s12Bold(
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary)),
              const Spacer(),
              InkWell(
                onTap: widget.onRemove,
                child:
                    const Icon(Icons.close, size: 18, color: AppColors.error),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Class
          _label('Class', isDark),
          const SizedBox(height: 4),
          _miniDropdown<String>(
            value: classId,
            items: widget.classes
                .map((c) =>
                    DropdownMenuItem(value: c.id, child: Text(c.displayName)))
                .toList(),
            onChanged: (v) {
              if (v == null) return;
              final cls = widget.classes.firstWhere((c) => c.id == v);
              setState(() {
                entry.classId = v;
                entry.className = cls.displayName;
              });
              widget.onChanged();
            },
            isDark: isDark,
          ),
          const SizedBox(height: 10),

          // Subject
          _label('Subject', isDark),
          const SizedBox(height: 4),
          _miniDropdown<String>(
            value: subjectId,
            items: widget.subjects
                .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                .toList(),
            onChanged: (v) {
              if (v == null) return;
              final subj = widget.subjects.firstWhere((s) => s.id == v);
              setState(() {
                entry.subjectId = v;
                entry.subjectName = subj.name;
              });
              widget.onChanged();
            },
            isDark: isDark,
          ),
          const SizedBox(height: 10),

          // Max / Passing marks
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Max Marks', isDark),
                    const SizedBox(height: 4),
                    _numField(_maxCtrl, isDark, (v) {
                      entry.maxMarks = int.tryParse(v) ?? entry.maxMarks;
                      widget.onChanged();
                    }),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Pass Marks', isDark),
                    const SizedBox(height: 4),
                    _numField(_passCtrl, isDark, (v) {
                      entry.passingMarks =
                          int.tryParse(v) ?? entry.passingMarks;
                      widget.onChanged();
                    }),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _label(String t, bool isDark) => Text(t,
      style: AppTypography.s11Regular(
          color: isDark ? AppColors.textMuted : AppColors.textSecondary));

  Widget _miniDropdown<T>({
    required T value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          dropdownColor: isDark ? AppColors.cardDark : Colors.white,
          style: AppTypography.s13Regular(
              color: isDark ? Colors.white : AppColors.textPrimary),
          items: items,
          onChanged: onChanged,
          isDense: true,
        ),
      ),
    );
  }

  Widget _numField(
      TextEditingController ctrl, bool isDark, Function(String) onChanged) {
    return TextField(
      controller: ctrl,
      keyboardType: TextInputType.number,
      style: AppTypography.s13Regular(
          color: isDark ? Colors.white : AppColors.textPrimary),
      onChanged: onChanged,
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        filled: true,
        fillColor: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(
                color: isDark ? AppColors.borderDark : AppColors.borderLight)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(
                color: isDark ? AppColors.borderDark : AppColors.borderLight)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      ),
    );
  }
}

// ── Marks Entry View ──────────────────────────────────────────────────────────

class _MarksEntryView extends StatefulWidget {
  final ExamInfo exam;
  final ExamScheduleEntry schedule;
  final VoidCallback onBack;

  const _MarksEntryView({
    required this.exam,
    required this.schedule,
    required this.onBack,
  });

  @override
  State<_MarksEntryView> createState() => _MarksEntryViewState();
}

class _MarksEntryViewState extends State<_MarksEntryView> {
  bool _isEditing = false;

  void _snack(BuildContext context, String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppColors.error : AppColors.success,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            child: Row(
              children: [
                IconButton(
                  icon: Icon(Icons.arrow_back_ios_new,
                      size: 20,
                      color: isDark ? Colors.white : AppColors.textPrimary),
                  onPressed: widget.onBack,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.schedule.subjectName ?? 'Subject',
                          style: AppTypography.s16Bold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      Text(
                        '${widget.exam.name} · ${widget.schedule.classFullName}',
                        style: AppTypography.s12Regular(
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                Container(
                  margin: const EdgeInsets.only(right: 16),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('Max: ${widget.schedule.maxMarks}',
                      style: AppTypography.s11Bold(color: AppColors.primary)),
                ),
              ],
            ),
          ),
          Expanded(
            child: p.isLoadingStudents
                ? const SkeletonList()
                : p.error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.error_outline,
                                  size: 40, color: AppColors.error),
                              const SizedBox(height: 8),
                              Text(p.error!,
                                  style: AppTypography.s13Regular(
                                      color: AppColors.error),
                                  textAlign: TextAlign.center),
                            ],
                          ),
                        ),
                      )
                    : p.students.isEmpty
                        ? Center(
                            child: Text('No students in this class',
                                style: AppTypography.s14Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary)))
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                            itemCount: p.students.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (_, i) {
                              final student = p.students[i];
                              final entry =
                                  p.marksMap[student.id] ?? ExamMarkEntry();
                              return _StudentMarkCard(
                                index: i + 1,
                                student: student,
                                entry: entry,
                                maxMarks: widget.schedule.maxMarks,
                                isDark: isDark,
                                isReadOnly: !_isEditing,
                                onChanged: (updated) => p.updateMark(
                                  student.id,
                                  theory: updated.theoryMarks,
                                  practical: updated.practicalMarks,
                                  absent: updated.isAbsent,
                                  remarks: updated.remarks,
                                ),
                                onUploadPdf: _isEditing
                                    ? (path, name, bytes) async {
                                        final success =
                                            await p.uploadAnswerPaper(
                                          examId: widget.exam.id,
                                          classId:
                                              widget.schedule.classId ?? '',
                                          studentId: student.id,
                                          subjectId:
                                              widget.schedule.subjectId ?? '',
                                          filePath: path,
                                          fileName: name,
                                          bytes: bytes,
                                        );
                                        if (!success &&
                                            context.mounted &&
                                            p.error != null) {
                                          ScaffoldMessenger.of(context)
                                              .showSnackBar(
                                            SnackBar(content: Text(p.error!)),
                                          );
                                        }
                                      }
                                    : null,
                              );
                            },
                          ),
          ),
          if (!_isEditing && !p.isLoadingStudents && p.students.isNotEmpty)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () => setState(() => _isEditing = true),
                    icon: const Icon(Icons.edit_outlined, color: Colors.white, size: 18),
                    label: const Text('Edit Marks',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: _isEditing && p.students.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: p.isSaving
                  ? null
                  : () async {
                      final classId = widget.schedule.classId;
                      final subjectId = widget.schedule.subjectId;
                      if (classId == null || subjectId == null) return;
                      final ok = await p.saveMarks(
                        widget.exam.id,
                        classId,
                        subjectId,
                      );
                      if (context.mounted) {
                        if (ok) {
                          setState(() => _isEditing = false);
                          _snack(context, 'Marks saved successfully!');
                        } else {
                          _snack(context, p.error ?? 'Failed to save marks',
                              isError: true);
                        }
                      }
                    },
              backgroundColor:
                  p.isSaving ? Colors.grey : const Color(0xFF16A34A),
              icon: p.isSaving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.save_rounded, color: Colors.white),
              label: Text(
                p.isSaving ? 'Saving…' : 'Save Marks',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14),
              ),
            )
          : null,
    );
  }
}

// ── Student Mark Card ─────────────────────────────────────────────────────────

class _StudentMarkCard extends StatefulWidget {
  final int index;
  final Student student;
  final ExamMarkEntry entry;
  final int maxMarks;
  final bool isDark;
  final bool isReadOnly;
  final Function(ExamMarkEntry) onChanged;
  final Future<void> Function(String? path, String name, Uint8List? bytes)? onUploadPdf;

  const _StudentMarkCard({
    required this.index,
    required this.student,
    required this.entry,
    required this.maxMarks,
    required this.isDark,
    this.isReadOnly = false,
    required this.onChanged,
    this.onUploadPdf,
  });

  @override
  State<_StudentMarkCard> createState() => _StudentMarkCardState();
}

class _StudentMarkCardState extends State<_StudentMarkCard> {
  late final TextEditingController _theoryCtrl;
  late final TextEditingController _practicalCtrl;
  late final TextEditingController _remarksCtrl;
  late bool _isAbsent;
  bool _isUploadingPdf = false;

  Future<void> _pickAndUploadPdf() async {
    if (widget.onUploadPdf == null) return;

    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      withData: true, // ensures bytes are loaded on Android content URIs
    );

    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    final name = file.name;
    final path = file.path;           // may be null on Android content URIs
    final bytes = file.bytes;         // always populated when withData: true
    if (path == null && bytes == null) return;

    setState(() => _isUploadingPdf = true);
    await widget.onUploadPdf!(path, name, bytes);
    if (mounted) setState(() => _isUploadingPdf = false);
  }

  @override
  void initState() {
    super.initState();
    _theoryCtrl = TextEditingController(
      text: widget.entry.theoryMarks > 0
          ? widget.entry.theoryMarks.toStringAsFixed(0)
          : '',
    );
    _practicalCtrl = TextEditingController(
      text: widget.entry.practicalMarks > 0
          ? widget.entry.practicalMarks.toStringAsFixed(0)
          : '',
    );
    _remarksCtrl = TextEditingController(text: widget.entry.remarks);
    _isAbsent = widget.entry.isAbsent;
  }

  @override
  void dispose() {
    _theoryCtrl.dispose();
    _practicalCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  void _notify() {
    widget.onChanged(ExamMarkEntry(
      theoryMarks: double.tryParse(_theoryCtrl.text) ?? 0,
      practicalMarks: double.tryParse(_practicalCtrl.text) ?? 0,
      isAbsent: _isAbsent,
      remarks: _remarksCtrl.text,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                backgroundImage: widget.student.photo != null
                    ? NetworkImage(widget.student.photo!)
                    : null,
                child: widget.student.photo == null
                    ? Text('${widget.index}',
                        style: AppTypography.s12Bold(color: AppColors.primary))
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.student.name,
                        style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    if (widget.student.admissionNumber != null)
                      Text(widget.student.admissionNumber!,
                          style: AppTypography.s11Regular(
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary)),
                  ],
                ),
              ),
              if (widget.isReadOnly) ...[
                // Read-only: show badge only when actually absent
                if (_isAbsent)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: AppColors.error.withValues(alpha: 0.4)),
                    ),
                    child: Text('Absent',
                        style: AppTypography.s11Bold(
                            color: AppColors.error)),
                  ),
              ] else ...[
                // Edit mode: checkbox
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Checkbox(
                      value: _isAbsent,
                      activeColor: AppColors.error,
                      onChanged: (v) {
                        if (v != null) {
                          setState(() => _isAbsent = v);
                          _notify();
                        }
                      },
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize:
                          MaterialTapTargetSize.shrinkWrap,
                    ),
                    const SizedBox(width: 4),
                    Text('Absent',
                        style: AppTypography.s12Medium(
                            color: _isAbsent
                                ? AppColors.error
                                : (isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary))),
                  ],
                ),
              ],
            ],
          ),
          if (!_isAbsent) ...[
            const SizedBox(height: 10),
            if (widget.isReadOnly) ...[
              // Read-only: show marks as static labelled values
              Row(
                children: [
                  Expanded(
                    child: _ReadOnlyField(
                      label: 'Theory Marks',
                      value: widget.entry.theoryMarks > 0
                          ? widget.entry.theoryMarks.toStringAsFixed(0)
                          : '–',
                      isDark: isDark,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ReadOnlyField(
                      label: 'Practical',
                      value: widget.entry.practicalMarks > 0
                          ? widget.entry.practicalMarks.toStringAsFixed(0)
                          : '–',
                      isDark: isDark,
                    ),
                  ),
                ],
              ),
              if (widget.entry.remarks.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.bgDark
                        : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight),
                  ),
                  child: Text('Remarks: ${widget.entry.remarks}',
                      style: AppTypography.s12Regular(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary)),
                ),
              ],
              if (widget.entry.answerPaperUrl != null) ...[
                const SizedBox(height: 8),
                InkWell(
                  onTap: () async {
                    final url = Uri.parse(
                        ApiClient.fileUrl(widget.entry.answerPaperUrl!));
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url,
                          mode: LaunchMode.externalApplication);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.bgDark
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: isDark
                              ? AppColors.borderDark
                              : AppColors.borderLight),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.picture_as_pdf,
                            color: AppColors.primary, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            widget.entry.answerPaperFileName ??
                                'Answer Paper',
                            style: AppTypography.s12Medium(
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Icon(Icons.open_in_new,
                            size: 16, color: AppColors.primary),
                      ],
                    ),
                  ),
                ),
              ],
            ] else ...[
              // Edit mode: active text fields
              Row(
                children: [
                  Expanded(
                    child: _MarksField(
                      controller: _theoryCtrl,
                      label: 'Theory Marks',
                      hint: '0–${widget.maxMarks}',
                      isDark: isDark,
                      onChanged: (_) => _notify(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MarksField(
                      controller: _practicalCtrl,
                      label: 'Practical',
                      hint: '0',
                      isDark: isDark,
                      onChanged: (_) => _notify(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _remarksCtrl,
                style: AppTypography.s12Regular(
                    color: isDark ? Colors.white : AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Remarks (optional)',
                  hintStyle:
                      AppTypography.s12Regular(color: AppColors.textMuted),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  filled: true,
                  fillColor:
                      isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(
                        color: AppColors.primary, width: 1.5),
                  ),
                ),
                onChanged: (_) => _notify(),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: widget.entry.answerPaperFileName != null
                        ? Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? AppColors.bgDark
                                  : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color: isDark
                                      ? AppColors.borderDark
                                      : AppColors.borderLight),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.picture_as_pdf,
                                    color: AppColors.primary, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    widget.entry.answerPaperFileName!,
                                    style: AppTypography.s12Medium(
                                        color: isDark
                                            ? Colors.white
                                            : AppColors.textPrimary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (_isUploadingPdf)
                                  const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2))
                                else
                                  InkWell(
                                    onTap: _pickAndUploadPdf,
                                    child: const Icon(Icons.edit_outlined,
                                        size: 16,
                                        color: AppColors.textSecondary),
                                  ),
                              ],
                            ),
                          )
                        : OutlinedButton.icon(
                            onPressed:
                                _isUploadingPdf ? null : _pickAndUploadPdf,
                            icon: _isUploadingPdf
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.upload_file, size: 16),
                            label: Text(_isUploadingPdf
                                ? 'Uploading...'
                                : 'Upload Answer PDF'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 8),
                              textStyle: AppTypography.s12Medium(),
                              side: BorderSide(
                                  color: isDark
                                      ? AppColors.borderDark
                                      : AppColors.borderLight),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                  ),
                  if (widget.entry.answerPaperUrl != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.open_in_new, size: 20),
                      color: AppColors.primary,
                      tooltip: 'View PDF',
                      onPressed: () async {
                        final url = Uri.parse(
                            ApiClient.fileUrl(widget.entry.answerPaperUrl!));
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                    ),
                  ],
                ],
              ),
            ],
          ] else ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border:
                    Border.all(color: AppColors.error.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.person_off_outlined,
                      color: AppColors.error, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Student marked as absent',
                    style: AppTypography.s13SemiBold(color: AppColors.error),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MarksField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final bool isDark;
  final Function(String) onChanged;

  const _MarksField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.isDark,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: AppTypography.s14SemiBold(
          color: isDark ? Colors.white : AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: AppTypography.s11Regular(
            color: isDark ? AppColors.textMuted : AppColors.textSecondary),
        hintText: hint,
        hintStyle: AppTypography.s12Regular(
            color: isDark ? AppColors.textMuted : AppColors.textSecondary),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        filled: true,
        fillColor: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
      onChanged: onChanged,
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;

  const _ReadOnlyField({
    required this.label,
    required this.value,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final isEmpty = value == '–';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: AppTypography.s11Regular(
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary)),
          const SizedBox(height: 2),
          Text(
            isEmpty ? '—' : value,
            style: isEmpty
                ? AppTypography.s13Regular(
                    color: isDark
                        ? AppColors.textMuted
                        : AppColors.textSecondary)
                : AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}

// ── Shared small widgets ──────────────────────────────────────────────────────

class _StatChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool isDark;
  const _StatChip(this.label, this.count, this.color, this.isDark);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(
          children: [
            Text('$count', style: AppTypography.s20Bold(color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: AppTypography.s10Medium(
                    color: isDark
                        ? AppColors.textMuted
                        : AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool isDark;
  const _FilterChip(
      {required this.label,
      required this.selected,
      required this.onTap,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary
              : (isDark ? AppColors.cardDark : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected
                  ? AppColors.primary
                  : (isDark ? AppColors.borderDark : AppColors.borderLight)),
        ),
        child: Text(label,
            style: AppTypography.s12Medium(
                color: selected
                    ? Colors.white
                    : (isDark
                        ? AppColors.textMuted
                        : AppColors.textSecondary))),
      ),
    );
  }
}

class _ScheduleEntryCard extends StatelessWidget {
  final ExamScheduleEntry entry;
  final bool isDark;
  final bool canEnter;
  final VoidCallback? onTap;

  const _ScheduleEntryCard(
      {required this.entry,
      required this.isDark,
      required this.canEnter,
      this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.menu_book_rounded,
                  color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.subjectName ?? 'Subject',
                      style: AppTypography.s14SemiBold(
                          color:
                              isDark ? Colors.white : AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(entry.classFullName,
                      style: AppTypography.s12Regular(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${entry.maxMarks} marks',
                    style: AppTypography.s12SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary)),
                Text('Pass: ${entry.passingMarks}',
                    style: AppTypography.s11Regular(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary)),
              ],
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right,
                size: 18, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}

class _ResultsTile extends StatelessWidget {
  final String className;
  final bool isDark;
  final VoidCallback onTap;
  const _ResultsTile(
      {required this.className, required this.isDark, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.bar_chart,
                  color: AppColors.success, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(className,
                  style: AppTypography.s14SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary)),
            ),
            Text('View Results',
                style: AppTypography.s12Medium(color: AppColors.primary)),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, size: 16, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  final String label;
  final Color bg;
  const _InfoPill(this.label, this.bg);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(label,
          style: const TextStyle(
              color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }
}

class _EmptyNote extends StatelessWidget {
  final String msg;
  final bool isDark;
  const _EmptyNote(this.msg, this.isDark);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(msg,
          style: AppTypography.s13Regular(
              color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
    );
  }
}
