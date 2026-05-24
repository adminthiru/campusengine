import 'package:flutter/material.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/quick_actions_grid.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/attendance_overview.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/homework_and_exams.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/admin_and_events.dart';

class ClassTeacherView extends StatelessWidget {
  const ClassTeacherView({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              QuickActionsGrid(),
              Divider(height: 32, thickness: 8, color: Colors.black12),
              AttendanceOverview(),
              Divider(height: 32, thickness: 8, color: Colors.black12),
              HomeworkAndExams(),
              Divider(height: 32, thickness: 8, color: Colors.black12),
              AdminAndEvents(),
            ],
          ),
        ),
      ],
    );
  }
}
