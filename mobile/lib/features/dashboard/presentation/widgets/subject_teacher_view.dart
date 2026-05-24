import 'package:flutter/material.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/schedule_and_tasks.dart';
// Note: We can reuse QuickActionsGrid or create a specific one for Subject Teacher later.
import 'package:skl_teacher/features/dashboard/presentation/widgets/quick_actions_grid.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/homework_and_exams.dart';

class SubjectTeacherView extends StatelessWidget {
  const SubjectTeacherView({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              // A simpler version of quick actions for subjects
              QuickActionsGrid(),
              Divider(height: 32, thickness: 8, color: Colors.black12),
              ScheduleAndTasks(),
              Divider(height: 32, thickness: 8, color: Colors.black12),
              // Reusing homework and exams, assuming it shows across multiple classes here
              HomeworkAndExams(),
              Divider(height: 32, thickness: 8, color: Colors.black12),
            ],
          ),
        ),
      ],
    );
  }
}
