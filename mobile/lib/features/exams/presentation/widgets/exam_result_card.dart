import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';

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
    final examName = (result['exam']?['name'] as String?) ?? 'Exam';
    final marks = (result['marks'] as List?) ?? const [];

    // Prefer the backend-computed aggregates; fall back to summing the rows.
    num total = (result['totalMarksObtained'] as num?) ?? 0;
    num totalMax = (result['totalMaxMarks'] as num?) ?? 0;
    if (totalMax == 0) {
      total = 0;
      for (final m in marks) {
        if (m['isAbsent'] == true) continue;
        total += _markValue(m);
        totalMax += (m['maxMarks'] as num?) ?? 0;
      }
    }
    final pct = (result['percentage'] as num?) ??
        (totalMax > 0 ? (total / totalMax * 100).round() : 0);
    final grade = (result['grade'] as String?)?.trim();
    final gradeLabel =
        (grade != null && grade.isNotEmpty) ? grade : _grade(pct.round());

    // Subjects that have an uploaded answer paper.
    final papers = marks
        .where((m) =>
            (m['answerPaper']?['url'] as String?)?.isNotEmpty ?? false)
        .toList();

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
                subject: (m['subject']?['name'] as String?) ?? 'Subject',
                url: m['answerPaper']['url'] as String,
                fileName: m['answerPaper']['fileName'] as String?,
                isDark: isDark,
              )),
        ],
      ]),
    );
  }

  num _markValue(dynamic m) =>
      (m['totalMarks'] as num?) ??
      (((m['theoryMarks'] as num?) ?? 0) + ((m['practicalMarks'] as num?) ?? 0));

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
    final subj = (mark['subject']?['name'] as String?) ?? 'Subject';
    final isAbsent = mark['isAbsent'] == true;
    final got = ((mark['totalMarks'] as num?) ??
            (((mark['theoryMarks'] as num?) ?? 0) +
                ((mark['practicalMarks'] as num?) ?? 0)))
        .toInt();
    final max = ((mark['maxMarks'] as num?) ?? 100).toInt();
    final sPct = max > 0 ? (got / max * 100).round() : 0;

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
  final String? fileName;
  final bool isDark;
  const _PaperTile(
      {required this.subject,
      required this.url,
      this.fileName,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    final hasName = fileName != null && fileName!.trim().isNotEmpty;
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$subject — Answer Paper',
                        style:
                            AppTypography.s13SemiBold(color: AppColors.primary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    if (hasName)
                      Text(fileName!,
                          style: AppTypography.s11Regular(
                              color: AppColors.textMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                  ],
                ),
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

/// Opens a single exam result in a modal bottom sheet. Used by the parent
/// Exams tab where the result is fetched on demand for the selected child.
Future<void> showExamResultSheet(
  BuildContext context, {
  required Map<String, dynamic> result,
}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: AppColors.textMuted.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              child: ExamResultCard(
                  result: result, isDark: isDark, margin: EdgeInsets.zero),
            ),
          ),
        ],
      ),
    ),
  );
}
