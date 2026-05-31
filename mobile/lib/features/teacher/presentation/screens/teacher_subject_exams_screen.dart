import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../exams/presentation/providers/exams_provider.dart';

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

class _TeacherSubjectExamsScreenState extends State<TeacherSubjectExamsScreen> {
  ExamInfo? _selectedExam;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final p = context.read<ExamsProvider>();
      await p.fetchProfile();
      if (mounted) {
        await p.fetchExams(); // fetches all exams
      }
    });
  }

  void _onExamSelected(ExamInfo? exam) {
    setState(() {
      _selectedExam = exam;
    });
    if (exam != null) {
      context.read<ExamsProvider>().fetchStudentsAndResults(
            widget.classId,
            exam.id,
            widget.subjectId,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ExamsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Filter exams that have the current class and subject in their schedule
    final validExams = p.exams.where((e) {
      return e.schedule.any((s) =>
          s.classId == widget.classId && s.subjectId == widget.subjectId);
    }).toList();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Enter Marks - ${widget.className}',
                style: const TextStyle(fontSize: 16)),
            Text(widget.subjectName,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
      ),
      body: p.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: DropdownButtonFormField<ExamInfo>(
                    decoration: InputDecoration(
                      labelText: 'Select Exam',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      filled: true,
                      fillColor: isDark ? AppColors.cardDark : Colors.white,
                    ),
                    initialValue: _selectedExam,
                    items: validExams.map((e) {
                      return DropdownMenuItem(
                        value: e,
                        child: Text(e.name),
                      );
                    }).toList(),
                    onChanged: _onExamSelected,
                  ),
                ),
                if (_selectedExam == null)
                  Expanded(
                    child: Center(
                      child: Text(
                        validExams.isEmpty
                            ? 'No exams scheduled for this class and subject.'
                            : 'Please select an exam to enter marks.',
                        style: AppTypography.s14Regular(
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary),
                      ),
                    ),
                  )
                else if (p.isLoadingStudents)
                  const Expanded(
                    child: Center(
                        child: CircularProgressIndicator(
                            color: AppColors.primary)),
                  )
                else if (p.students.isEmpty)
                  Expanded(
                    child: Center(
                      child: Text('No students found in this class.',
                          style: AppTypography.s14Regular(
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary)),
                    ),
                  )
                else
                  Expanded(
                    child: _buildMarksList(context, p, isDark),
                  ),
              ],
            ),
      bottomNavigationBar: _selectedExam != null && p.students.isNotEmpty
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: p.isSaving
                      ? null
                      : () async {
                          final success = await p.saveMarks(
                            _selectedExam!.id,
                            widget.classId,
                            widget.subjectId,
                          );
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(success
                                ? 'Marks saved successfully'
                                : (p.error ?? 'Failed to save marks')),
                            backgroundColor:
                                success ? AppColors.success : AppColors.error,
                          ));
                        },
                  child: p.isSaving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Save Marks',
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

  Widget _buildMarksList(BuildContext context, ExamsProvider p, bool isDark) {
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 20),
      itemCount: p.students.length,
      itemBuilder: (context, index) {
        final student = p.students[index];
        final entry = p.marksMap[student.id];
        if (entry == null) return const SizedBox();

        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: isDark ? AppColors.cardDark : Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                      child: Text(
                          student.name.isNotEmpty
                              ? student.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              color: AppColors.primary, fontSize: 12)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(student.name,
                              style: AppTypography.s14Bold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary)),
                          Text(
                              'Admission No: ${student.admissionNumber ?? "N/A"}',
                              style: AppTypography.s12Regular(
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        Text('Absent',
                            style: AppTypography.s12Regular(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                        Switch(
                          value: entry.isAbsent,
                          onChanged: (val) {
                            p.updateMark(student.id, absent: val);
                          },
                          activeTrackColor:
                              AppColors.error.withValues(alpha: 0.5),
                          activeThumbColor: AppColors.error,
                        ),
                      ],
                    ),
                  ],
                ),
                if (!entry.isAbsent) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          initialValue: entry.theoryMarks > 0
                              ? entry.theoryMarks.toString()
                              : '',
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Theory',
                            isDense: true,
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          onChanged: (val) {
                            p.updateMark(student.id,
                                theory: double.tryParse(val) ?? 0);
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          initialValue: entry.practicalMarks > 0
                              ? entry.practicalMarks.toString()
                              : '',
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Practical',
                            isDense: true,
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          onChanged: (val) {
                            p.updateMark(student.id,
                                practical: double.tryParse(val) ?? 0);
                          },
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                TextFormField(
                  initialValue: entry.remarks,
                  decoration: InputDecoration(
                    labelText: 'Remarks (Optional)',
                    isDense: true,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  onChanged: (val) {
                    p.updateMark(student.id, remarks: val);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
