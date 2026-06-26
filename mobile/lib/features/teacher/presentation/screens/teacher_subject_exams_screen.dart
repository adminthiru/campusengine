import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/models/student.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../exams/presentation/providers/exams_provider.dart';

// ── Grade helpers ─────────────────────────────────────────────────────────────

String _gradeFromPct(double pct, {bool absent = false}) {
  if (absent) return 'AB';
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C+';
  if (pct >= 40) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

Color _gradeColor(String grade) {
  switch (grade) {
    case 'A+':
    case 'A':
      return AppColors.success;
    case 'B+':
    case 'B':
      return AppColors.primary;
    case 'C+':
    case 'C':
      return AppColors.warning;
    case 'D':
      return const Color(0xFFEAB308);
    default:
      return AppColors.error;
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────

class TeacherSubjectExamsScreen extends StatefulWidget {
  final String classId;
  final String className;
  final String subjectId;
  final String subjectName;

  const TeacherSubjectExamsScreen({
    super.key,
    required this.classId,
    required this.className,
    required this.subjectId,
    required this.subjectName,
  });

  @override
  State<TeacherSubjectExamsScreen> createState() =>
      _TeacherSubjectExamsScreenState();
}

class _TeacherSubjectExamsScreenState
    extends State<TeacherSubjectExamsScreen> {
  ExamInfo? _selectedExam;
  int _maxMarks = 100;
  int _passingMarks = 35;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final p = context.read<ExamsProvider>();
      await p.fetchProfile();
      if (mounted) await p.fetchExams();
    });
  }

  void _onExamSelected(ExamInfo? exam) {
    if (exam == null) return;
    final entry = exam.schedule.firstWhere(
      (s) => s.classId == widget.classId && s.subjectId == widget.subjectId,
      orElse: () => ExamScheduleEntry(maxMarks: 100, passingMarks: 35),
    );
    setState(() {
      _selectedExam = exam;
      _maxMarks = entry.maxMarks;
      _passingMarks = entry.passingMarks;
    });
    context.read<ExamsProvider>().fetchStudentsAndResults(
          widget.classId,
          exam.id,
          widget.subjectId,
        );
  }

  void _openMarkSheet(Student student) {
    final p = context.read<ExamsProvider>();
    final entry = p.marksMap[student.id] ?? ExamMarkEntry();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: p,
        child: _MarkEntrySheet(
          student: student,
          initialEntry: entry,
          maxMarks: _maxMarks,
          passingMarks: _passingMarks,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final validExams = p.exams.where((e) => e.schedule.any(
          (s) => s.classId == widget.classId && s.subjectId == widget.subjectId,
        )).toList();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Enter Marks – ${widget.className}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text(widget.subjectName,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
      ),
      body: p.isLoading
          ? const SkeletonList()
          : Column(
              children: [
                // ── Exam picker ────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Select Exam',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: isDark ? AppColors.cardDark : Colors.white,
                    ),
                    // Match by stable id (not object identity) so the value
                    // stays valid across provider refreshes.
                    initialValue: validExams.any((e) => e.id == _selectedExam?.id)
                        ? _selectedExam?.id
                        : null,
                    isExpanded: true,
                    items: validExams
                        .map((e) => DropdownMenuItem(
                            value: e.id,
                            child: Text(e.name, overflow: TextOverflow.ellipsis)))
                        .toList(),
                    onChanged: (id) {
                      if (id == null) return;
                      final exam =
                          validExams.where((e) => e.id == id).firstOrNull;
                      if (exam != null) _onExamSelected(exam);
                    },
                  ),
                ),

                // ── Body ───────────────────────────────────────────────────
                if (_selectedExam == null)
                  Expanded(
                    child: Center(
                      child: Text(
                        validExams.isEmpty
                            ? 'No exams scheduled for this class and subject.'
                            : 'Select an exam to enter marks.',
                        style: AppTypography.s14Regular(
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                else if (p.isLoadingStudents)
                  const Expanded(child: SkeletonList())
                else if (p.error != null)
                  Expanded(
                    child: Center(
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
                    ),
                  )
                else if (p.students.isEmpty)
                  Expanded(
                    child: Center(
                        child: Text('No students found in this class.',
                            style: AppTypography.s14Regular(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary))),
                  )
                else
                  Expanded(child: _buildStudentList(context, p, isDark)),
              ],
            ),

      // ── Save all button ────────────────────────────────────────────────
      bottomNavigationBar: _selectedExam != null && p.students.isNotEmpty
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: p.isSaving
                      ? null
                      : () async {
                          final ok = await p.saveMarks(
                            _selectedExam!.id,
                            widget.classId,
                            widget.subjectId,
                          );
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(ok
                                ? 'Marks saved successfully'
                                : (p.error ?? 'Failed to save marks')),
                            backgroundColor:
                                ok ? AppColors.success : AppColors.error,
                          ));
                        },
                  child: p.isSaving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Save All Marks',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16)),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildStudentList(
      BuildContext context, ExamsProvider p, bool isDark) {
    return RefreshIndicator(
      onRefresh: () => p.fetchStudentsAndResults(
        widget.classId,
        _selectedExam!.id,
        widget.subjectId,
      ),
      color: AppColors.primary,
      child: ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      itemCount: p.students.length,
      itemBuilder: (_, i) {
        final student = p.students[i];
        final entry = p.marksMap[student.id] ?? ExamMarkEntry();
        final total =
            entry.isAbsent ? 0.0 : (entry.theoryMarks + entry.practicalMarks);
        final pct = _maxMarks > 0 ? (total / _maxMarks * 100) : 0.0;
        final grade = _gradeFromPct(pct, absent: entry.isAbsent);

        return GestureDetector(
          onTap: () => _openMarkSheet(student),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: isDark
                      ? AppColors.borderDark
                      : AppColors.borderLight),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child: Row(
              children: [
                // Avatar
                CircleAvatar(
                  radius: 20,
                  backgroundColor: entry.isAbsent
                      ? AppColors.error.withValues(alpha: 0.12)
                      : AppColors.primary.withValues(alpha: 0.10),
                  child: Text(
                    student.name.isNotEmpty
                        ? student.name[0].toUpperCase()
                        : '?',
                    style: TextStyle(
                      color: entry.isAbsent ? AppColors.error : AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Name + admission no.
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(student.name,
                          style: AppTypography.s14Bold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      if (student.admissionNumber?.isNotEmpty == true)
                        Text(student.admissionNumber!,
                            style: AppTypography.s11Medium(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                    ],
                  ),
                ),

                // Marks summary / absent badge
                if (entry.isAbsent)
                  _Badge('ABSENT', AppColors.error,
                      AppColors.error.withValues(alpha: 0.10))
                else ...[
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${_fmtNum(total)} / $_maxMarks',
                        style: AppTypography.s13Bold(
                            color: isDark
                                ? Colors.white
                                : AppColors.textPrimary),
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(grade,
                              style: AppTypography.s11Bold(
                                  color: _gradeColor(grade))),
                          Text(
                            '  ${pct.toStringAsFixed(1)}%',
                            style: AppTypography.s11Medium(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
                const SizedBox(width: 8),
                Icon(Icons.chevron_right,
                    size: 18,
                    color:
                        isDark ? AppColors.textMuted : AppColors.textSecondary),
              ],
            ),
          ),
        );
      },
    ),
    );
  }
}

String _fmtNum(double v) =>
    v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1);

// ── Student card badge ────────────────────────────────────────────────────────

class _Badge extends StatelessWidget {
  final String text;
  final Color fg, bg;
  const _Badge(this.text, this.fg, this.bg);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(text, style: AppTypography.s10Bold(color: fg)),
      );
}

// ── Mark-entry bottom sheet ───────────────────────────────────────────────────

class _MarkEntrySheet extends StatefulWidget {
  final Student student;
  final ExamMarkEntry initialEntry;
  final int maxMarks;
  final int passingMarks;

  const _MarkEntrySheet({
    required this.student,
    required this.initialEntry,
    required this.maxMarks,
    required this.passingMarks,
  });

  @override
  State<_MarkEntrySheet> createState() => _MarkEntrySheetState();
}

class _MarkEntrySheetState extends State<_MarkEntrySheet> {
  late bool _absent;
  late TextEditingController _theoryCtrl;
  late TextEditingController _practicalCtrl;
  late TextEditingController _remarksCtrl;

  @override
  void initState() {
    super.initState();
    _absent = widget.initialEntry.isAbsent;
    _theoryCtrl = TextEditingController(
        text: widget.initialEntry.theoryMarks > 0
            ? _fmtNum(widget.initialEntry.theoryMarks)
            : '');
    _practicalCtrl = TextEditingController(
        text: widget.initialEntry.practicalMarks > 0
            ? _fmtNum(widget.initialEntry.practicalMarks)
            : '');
    _remarksCtrl =
        TextEditingController(text: widget.initialEntry.remarks);
  }

  @override
  void dispose() {
    _theoryCtrl.dispose();
    _practicalCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  double get _theory => double.tryParse(_theoryCtrl.text) ?? 0;
  double get _practical => double.tryParse(_practicalCtrl.text) ?? 0;
  double get _total => _theory + _practical;
  double get _pct =>
      widget.maxMarks > 0 ? (_total / widget.maxMarks * 100) : 0;
  String get _grade => _gradeFromPct(_pct, absent: _absent);
  Color get _gColor => _gradeColor(_grade);
  bool get _passing => !_absent && _pct >= widget.passingMarks;

  void _apply() {
    context.read<ExamsProvider>().updateMark(
          widget.student.id,
          absent: _absent,
          theory: _absent ? 0 : _theory,
          practical: _absent ? 0 : _practical,
          remarks: _remarksCtrl.text.trim(),
        );
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.cardDark : Colors.white;
    final sheetBg =
        isDark ? AppColors.bgDark : const Color(0xFFF8FAFC);

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.72,
        minChildSize: 0.50,
        maxChildSize: 0.95,
        expand: false,
        builder: (_, scrollCtrl) => Container(
          decoration: BoxDecoration(
            color: sheetBg,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // ── Student header ───────────────────────────────────────
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor:
                          AppColors.primary.withValues(alpha: 0.12),
                      child: Text(
                        widget.student.name.isNotEmpty
                            ? widget.student.name[0].toUpperCase()
                            : '?',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.student.name,
                              style: AppTypography.s16Bold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary)),
                          if (widget.student.admissionNumber?.isNotEmpty ==
                              true)
                            Text(widget.student.admissionNumber!,
                                style: AppTypography.s12Regular(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    // Absent toggle
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text('Absent',
                            style: AppTypography.s12SemiBold(
                                color: _absent
                                    ? AppColors.error
                                    : (isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary))),
                        Switch(
                          value: _absent,
                          onChanged: (v) => setState(() => _absent = v),
                          activeTrackColor:
                              AppColors.error.withValues(alpha: 0.45),
                          activeThumbColor: AppColors.error,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              Divider(
                  height: 1,
                  color:
                      isDark ? AppColors.borderDark : AppColors.borderLight),

              // ── Scrollable content ──────────────────────────────────
              Expanded(
                child: ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                  children: [
                    // Absent state
                    if (_absent) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: AppColors.error.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.person_off_outlined,
                                color: AppColors.error, size: 20),
                            const SizedBox(width: 10),
                            Text('Marked as Absent — no marks recorded',
                                style: AppTypography.s13SemiBold(
                                    color: AppColors.error)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Mark input fields (hidden when absent)
                    if (!_absent) ...[
                      Row(
                        children: [
                          Expanded(
                            child: _MarksField(
                              controller: _theoryCtrl,
                              label: 'Theory',
                              maxMarks: widget.maxMarks,
                              isDark: isDark,
                              cardBg: cardBg,
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _MarksField(
                              controller: _practicalCtrl,
                              label: 'Practical',
                              maxMarks: widget.maxMarks,
                              isDark: isDark,
                              cardBg: cardBg,
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // ── Auto-calculated stats ──────────────────────
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: isDark
                              ? AppColors.bgDark
                              : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: isDark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _StatCell(
                              label: 'Total',
                              value:
                                  '${_fmtNum(_total)} / ${widget.maxMarks}',
                              isDark: isDark,
                            ),
                            _StatCell(
                              label: '%',
                              value: '${_pct.toStringAsFixed(1)}%',
                              isDark: isDark,
                            ),
                            _StatCell(
                              label: 'Grade',
                              value: _grade,
                              color: _gColor,
                              bold: true,
                              isDark: isDark,
                            ),
                            _StatCell(
                              label: 'Result',
                              value: _passing ? 'PASS' : 'FAIL',
                              color: _passing
                                  ? AppColors.success
                                  : AppColors.error,
                              bold: true,
                              isDark: isDark,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Remarks
                    TextField(
                      controller: _remarksCtrl,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'Remarks (Optional)',
                        hintText: 'Any notes...',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10)),
                        filled: true,
                        fillColor: cardBg,
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),

              // ── Apply button ─────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _apply,
                    child: const Text('Apply',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
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

// ── Marks input field ─────────────────────────────────────────────────────────

class _MarksField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final int maxMarks;
  final bool isDark;
  final Color cardBg;
  final ValueChanged<String> onChanged;

  const _MarksField({
    required this.controller,
    required this.label,
    required this.maxMarks,
    required this.isDark,
    required this.cardBg,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: label,
        hintText: '0',
        suffixText: '/ $maxMarks',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: cardBg,
      ),
      onChanged: onChanged,
    );
  }
}

// ── Auto-calc stat cell ───────────────────────────────────────────────────────

class _StatCell extends StatelessWidget {
  final String label, value;
  final Color? color;
  final bool bold, isDark;

  const _StatCell({
    required this.label,
    required this.value,
    this.color,
    this.bold = false,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final defaultColor =
        isDark ? Colors.white : AppColors.textPrimary;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: AppTypography.s10Medium(
                color: isDark
                    ? AppColors.textMuted
                    : AppColors.textSecondary)),
        const SizedBox(height: 4),
        Text(
          value,
          style: bold
              ? AppTypography.s14Bold(color: color ?? defaultColor)
              : AppTypography.s13Medium(color: color ?? defaultColor),
        ),
      ],
    );
  }
}
