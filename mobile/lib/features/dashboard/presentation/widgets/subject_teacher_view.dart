import 'package:flutter/material.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/schedule_and_tasks.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/quick_actions_grid.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/homework_and_exams.dart';

class SubjectTeacherView extends StatelessWidget {
  const SubjectTeacherView({super.key});

  @override
  Widget build(BuildContext context) {
    return const CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(height: 8),
              QuickActionsGrid(),
              SizedBox(height: 12),
              ScheduleAndTasks(),
              SizedBox(height: 12),
              HomeworkAndExams(),
              SizedBox(height: 24),
            ],
          ),
        ),
      ],
    );
  }
}
