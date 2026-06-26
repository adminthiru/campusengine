import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/skeleton.dart';
import '../providers/teacher_provider.dart';

class TeacherSubjectStudentsScreen extends StatefulWidget {
  final String classId;
  final String className;
  final String subjectName;

  const TeacherSubjectStudentsScreen({
    super.key,
    required this.classId,
    required this.className,
    required this.subjectName,
  });

  @override
  State<TeacherSubjectStudentsScreen> createState() =>
      _TeacherSubjectStudentsScreenState();
}

class _TeacherSubjectStudentsScreenState
    extends State<TeacherSubjectStudentsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TeacherProvider>().fetchStudentsForClass(widget.classId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeacherProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
            Text('Students - ${widget.className}', style: const TextStyle(fontSize: 16)),
            Text(widget.subjectName,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
      ),
      body: provider.isLoadingStudents
          ? const SkeletonList()
          : provider.error != null
              ? Center(child: Text(provider.error!))
              : RefreshIndicator(
                  onRefresh: () =>
                      provider.fetchStudentsForClass(widget.classId),
                  color: AppColors.primary,
                  child: _buildStudentsList(context, provider, isDark),
                ),
    );
  }

  Widget _buildStudentsList(
      BuildContext context, TeacherProvider provider, bool isDark) {
    final students = provider.students;

    if (students.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.3),
          Center(
            child: Text(
              'No students in this class.',
              style: AppTypography.s16Regular(
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: students.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final student = students[index];
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            child: Text(
              student.name.isNotEmpty ? student.name[0].toUpperCase() : '?',
              style: const TextStyle(color: AppColors.primary),
            ),
          ),
          title: Text(student.name,
              style: AppTypography.s14Bold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          subtitle: Text('Admission No: ${student.admissionNumber ?? "N/A"}',
              style: AppTypography.s12Regular(
                  color:
                      isDark ? AppColors.textMuted : AppColors.textSecondary)),
        );
      },
    );
  }
}
