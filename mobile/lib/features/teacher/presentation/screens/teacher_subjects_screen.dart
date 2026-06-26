import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/skeleton.dart';
import '../providers/teacher_provider.dart';

class TeacherSubjectsScreen extends StatefulWidget {
  const TeacherSubjectsScreen({super.key});

  @override
  State<TeacherSubjectsScreen> createState() => _TeacherSubjectsScreenState();
}

class _TeacherSubjectsScreenState extends State<TeacherSubjectsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TeacherProvider>().fetchProfile();
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
        title: const Text('My Subject Classes'),
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
      ),
      body: provider.isLoading
          ? const SkeletonList()
          : provider.error != null
              ? Center(child: Text(provider.error!))
              : RefreshIndicator(
                  onRefresh: () => provider.fetchProfile(),
                  color: AppColors.primary,
                  child: _buildList(context, provider, isDark),
                ),
    );
  }

  Widget _buildList(
      BuildContext context, TeacherProvider provider, bool isDark) {
    final assignments = provider.profile?.subjectTeacher ?? [];

    if (assignments.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.3),
          Center(
            child: Text(
              'No subject classes assigned.',
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
      itemCount: assignments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = assignments[index];
        final className = item.classInfo.fullName;
        final subjectName = item.subject.name;
        final colorStr = item.subject.color;
        Color color = AppColors.primary;
        if (colorStr != null && colorStr.startsWith('#')) {
          color = Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
        }

        return InkWell(
          onTap: () => _showOptions(context, item.classInfo.id, className,
              item.subject.id, subjectName),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border(left: BorderSide(color: color, width: 4)),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subjectName,
                    style: AppTypography.s16Bold(
                        color: isDark ? Colors.white : AppColors.textPrimary)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.class_, size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 6),
                    Text(className,
                        style: AppTypography.s14Regular(
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showOptions(BuildContext context, String classId, String className,
      String subjectId, String subjectName) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text('$subjectName - $className',
                    style: AppTypography.s16Bold()),
              ),
              ListTile(
                leading: const Icon(Icons.people, color: AppColors.primary),
                title: const Text('View Students'),
                onTap: () {
                  Navigator.pop(context);
                  context.push(
                    '/teacher/students?classId=$classId&className=$className&subjectName=$subjectName',
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit_note, color: AppColors.success),
                title: const Text('Enter Exam Marks'),
                onTap: () {
                  Navigator.pop(context);
                  context.push(
                    '/teacher/exams?classId=$classId&className=$className&subjectId=$subjectId&subjectName=$subjectName',
                  );
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }
}
