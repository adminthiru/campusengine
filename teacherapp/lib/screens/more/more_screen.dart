import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants.dart';
import '../../providers/teacher_profile_provider.dart';
import 'exams_screen.dart';
import 'students_screen.dart';
import 'leave_screen.dart';

void showMoreBottomSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    backgroundColor: kCardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _MoreSheetContent(parentContext: context),
  );
}

class _MoreSheetContent extends StatelessWidget {
  final BuildContext parentContext;
  const _MoreSheetContent({required this.parentContext});

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<TeacherProfileProvider>().profile;
    final ctPerms = profile?.permissions.classTeacher;
    final stPerms = profile?.permissions.subjectTeacher;
    final isClassTeacher = profile?.isClassTeacher ?? false;
    final isSubjectTeacher = profile?.isSubjectTeacher ?? false;

    final canViewExams = (isClassTeacher && (ctPerms?.viewAndEnterExamMarks ?? false)) ||
        (isSubjectTeacher && (stPerms?.enterExamMarks ?? false));
    final canViewStudents = (isClassTeacher && (ctPerms?.viewStudents ?? false)) ||
        (isSubjectTeacher && (stPerms?.viewSubjectStudents ?? false));

    void go(Widget screen) {
      Navigator.pop(context);
      Navigator.push(parentContext, MaterialPageRoute(builder: (_) => screen));
    }

    final tiles = <_Tile>[
      if (canViewExams)
        _Tile('Exams & Marks', Icons.assignment_rounded, kDanger, kDangerLight,
            () => go(const ExamsScreen())),
      if (canViewStudents)
        _Tile('Students', Icons.groups_rounded, kPrimary, kPrimaryLight,
            () => go(const StudentsScreen())),
      _Tile('Leave Request', Icons.beach_access_rounded, kWarning, kWarningLight,
          () => go(const LeaveScreen())),
    ];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Center(
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                width: 36, height: 4,
                decoration: BoxDecoration(
                  color: kBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Title
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('More', style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: kTextPrimary,
              )),
            ),
            const SizedBox(height: 16),
            // Tiles — fill full width equally
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (int i = 0; i < tiles.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(child: _TileCard(tile: tiles[i])),
                ],
              ],
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _Tile {
  final String label;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;
  const _Tile(this.label, this.icon, this.color, this.bgColor, this.onTap);
}

class _TileCard extends StatelessWidget {
  final _Tile tile;
  const _TileCard({required this.tile});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: tile.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: kBackground,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kBorder),
          boxShadow: [BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6, offset: const Offset(0, 2),
          )],
        ),
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: tile.bgColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(tile.icon, color: tile.color, size: 22),
            ),
            const SizedBox(height: 10),
            Text(tile.label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w600,
                color: kTextPrimary, height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
