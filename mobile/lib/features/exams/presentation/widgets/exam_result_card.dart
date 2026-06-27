import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';

/// Opens a server file (answer-paper PDF) in an external app/browser. Tries the
/// external handler first and falls back to the platform default; surfaces a
/// snackbar if nothing can open it (instead of silently doing nothing).
Future<void> openServerFile(BuildContext context, String rawUrl) async {
  final uri = Uri.parse(ApiClient.fileUrl(rawUrl));
  try {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (ok) return;
  } catch (_) {/* fall through to platform default */}
  try {
    final ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
    if (ok) return;
  } catch (_) {/* show error below */}
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the PDF.')));
  }
}

// ── Web-safe JSON accessors ──────────────────────────────────────────────────
// On Flutter web a missing nested value can surface as JS `undefined`, which the
// `?.` / `as String?` operators don't always catch (it throws
// "Cannot read properties of undefined (reading 'Symbol(dartx.isEmpty)')").
// These helpers use explicit `is` type checks, which are safe against undefined.

String _str(dynamic v, {String fallback = ''}) => v is String ? v : fallback;

num _num(dynamic v) => v is num ? v : 0;

String _subjectName(dynamic m) {
  final subj = m is Map ? m['subject'] : null;
  if (subj is Map && subj['name'] is String) return subj['name'] as String;
  return 'Subject';
}

num _subjectMarks(dynamic m) {
  if (m is! Map) return 0;
  if (m['totalMarks'] is num) return m['totalMarks'] as num;
  return _num(m['theoryMarks']) + _num(m['practicalMarks']);
}

Map? _answerPaper(dynamic m) {
  final ap = m is Map ? m['answerPaper'] : null;
  return ap is Map ? ap : null;
}

String? _paperUrl(dynamic m) {
  final u = _answerPaper(m)?['url'];
  return (u is String && u.isNotEmpty) ? u : null;
}

/// Renders a single published exam result: overall total/percentage/grade, a
/// per-subject marks breakdown, and a highlighted "Answer Papers" section with
/// a button to open each subject's PDF. Shared by the student Results tab and
/// the parent Exams tab.
class ExamResultCard extends StatelessWidget {
  final Map<String, dynamic> result;
  final bool isDark;
  final EdgeInsets margin;

  const ExamResultCard({
    super.key,
    required this.result,
    required this.isDark,
    this.margin = const EdgeInsets.only(bottom: 14),
  });

  @override
  Widget build(BuildContext context) {
    final examName = _str(result['exam'] is Map ? result['exam']['name'] : null,
        fallback: 'Exam');
    final marks = result['marks'] is List ? result['marks'] as List : const [];

    // Prefer the backend-computed aggregates; fall back to summing the rows.
    num total = _num(result['totalMarksObtained']);
    num totalMax = _num(result['totalMaxMarks']);
    if (totalMax == 0) {
      total = 0;
      for (final m in marks) {
        if (m is Map && m['isAbsent'] == true) continue;
        total += _markValue(m);
        totalMax += (m is Map && m['maxMarks'] is num) ? m['maxMarks'] as num : 0;
      }
    }
    final pct = result['percentage'] is num
        ? result['percentage'] as num
        : (totalMax > 0 ? (total / totalMax * 100).round() : 0);
    // Prefer the school's configured grade (matches the admin exam module),
    // then the grade stored on the result, then a percentage-based fallback.
    final configured = context.watch<SchoolPermissionsProvider>().gradeFor(pct);
    final stored = _str(result['grade']).trim();
    final gradeLabel = configured.isNotEmpty
        ? configured
        : (stored.isNotEmpty ? stored : _grade(pct.round()));

    // Subjects that have an uploaded answer paper.
    final papers = marks.where((m) => _paperUrl(m) != null).toList();

    return Container(
      margin: margin,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(examName,
                style: AppTypography.s15SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _gradeColor(pct).withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(gradeLabel,
                  style: AppTypography.s16Bold(color: _gradeColor(pct))),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Text('Total: ',
              style: AppTypography.s13Regular(color: AppColors.textMuted)),
          Text('${_fmt(total)} / ${_fmt(totalMax)}',
              style: AppTypography.s13SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const SizedBox(width: 12),
          Text('${pct.round()}%',
              style: AppTypography.s13SemiBold(color: _gradeColor(pct))),
        ]),
        if (marks.isNotEmpty) ...[
          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 6),
          ...marks.map((m) => _SubjectRow(mark: m, isDark: isDark)),
        ],
        if (papers.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('ANSWER PAPERS',
              style: AppTypography.s11SemiBold(color: AppColors.textMuted)),
          const SizedBox(height: 8),
          ...papers.map((m) => _PaperTile(
                subject: _subjectName(m),
                url: _paperUrl(m)!,
                isDark: isDark,
              )),
        ],
      ]),
    );
  }

  num _markValue(dynamic m) => _subjectMarks(m);

  String _fmt(num n) => n == n.roundToDouble() ? n.toInt().toString() : '$n';

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

class _SubjectRow extends StatelessWidget {
  final dynamic mark;
  final bool isDark;
  const _SubjectRow({required this.mark, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final subj = _subjectName(mark);
    final isAbsent = (mark is Map ? mark['isAbsent'] : null) == true;
    final got = _subjectMarks(mark).toInt();
    final max = ((mark is Map && mark['maxMarks'] is num)
            ? mark['maxMarks'] as num
            : 100)
        .toInt();
    final sPct = max > 0 ? (got / max * 100).round() : 0;
    final grade = (mark is Map && mark['grade'] is String)
        ? (mark['grade'] as String).trim()
        : '';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(
          child: Text(subj,
              style: AppTypography.s13Regular(
                  color: isDark ? Colors.white70 : AppColors.textSecondary)),
        ),
        if (isAbsent)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.accentRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('Absent',
                style: AppTypography.s11SemiBold(color: AppColors.accentRed)),
          )
        else ...[
          Text('$got/$max',
              style: AppTypography.s13SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const SizedBox(width: 8),
          Text('$sPct%',
              style: AppTypography.s12Regular(color: _gradeColor(sPct))),
          if (grade.isNotEmpty) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: _gradeColor(sPct).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(grade,
                  style: AppTypography.s11SemiBold(color: _gradeColor(sPct))),
            ),
          ],
        ],
      ]),
    );
  }

  Color _gradeColor(num pct) {
    if (pct >= 75) return AppColors.accentGreen;
    if (pct >= 50) return AppColors.warning;
    return AppColors.accentRed;
  }
}

/// A prominent, tappable tile for opening one subject's answer-paper PDF.
class _PaperTile extends StatelessWidget {
  final String subject;
  final String url;
  final bool isDark;
  const _PaperTile(
      {required this.subject, required this.url, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.08),
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => openServerFile(context, url),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.35)),
            ),
            child: Row(children: [
              const Icon(Icons.picture_as_pdf, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text('$subject — Answer Paper',
                    style: AppTypography.s13SemiBold(color: AppColors.primary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.open_in_new, color: AppColors.primary, size: 18),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Opens the exam result for a student in a modal bottom sheet. The sheet opens
/// immediately with a loading state and fetches the result itself — so the tap
/// feels instant instead of waiting on the network before anything appears.
Future<void> showExamResultSheet(
  BuildContext context, {
  required String examId,
  required String studentId,
}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) =>
        _ExamResultSheet(examId: examId, studentId: studentId, isDark: isDark),
  );
}

class _ExamResultSheet extends StatefulWidget {
  final String examId;
  final String studentId;
  final bool isDark;
  const _ExamResultSheet(
      {required this.examId, required this.studentId, required this.isDark});

  @override
  State<_ExamResultSheet> createState() => _ExamResultSheetState();
}

class _ExamResultSheetState extends State<_ExamResultSheet> {
  Map<String, dynamic>? _result;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.get('/exams/results',
          params: {'examId': widget.examId, 'studentId': widget.studentId});
      final results = res.data is Map ? res.data['results'] : null;
      final list = results is List ? results : const [];
      if (!mounted) return;
      setState(() {
        _loading = false;
        _result = list.isNotEmpty
            ? Map<String, dynamic>.from(list.first as Map)
            : null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ApiClient.errorMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    return ConstrainedBox(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 12,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: AppColors.textMuted.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Flexible(child: _content(isDark)),
        ]),
      ),
    );
  }

  Widget _content(bool isDark) {
    if (_loading) {
      return const SizedBox(
        height: 160,
        child:
            Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }
    if (_error != null) {
      return _message(Icons.cloud_off_outlined, "Couldn't load the result",
          'Pull down and try again.', isDark);
    }
    if (_result == null) {
      return _message(Icons.emoji_events_outlined, 'Not available yet',
          'Marks for this exam are not published for this student.', isDark);
    }
    return SingleChildScrollView(
      child: ExamResultCard(
          result: _result!, isDark: isDark, margin: EdgeInsets.zero),
    );
  }

  Widget _message(IconData icon, String title, String sub, bool isDark) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 28, 8, 40),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 48, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text(title,
              style: AppTypography.s16SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const SizedBox(height: 6),
          Text(sub,
              textAlign: TextAlign.center,
              style: AppTypography.s13Regular(color: AppColors.textMuted)),
        ]),
      );
}
