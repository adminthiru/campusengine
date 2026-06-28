import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentDashboardScreen extends StatefulWidget {
  const StudentDashboardScreen({super.key});
  @override
  State<StudentDashboardScreen> createState() => _StudentDashboardScreenState();
}

class _StudentDashboardScreenState extends State<StudentDashboardScreen> {
  Map<String, dynamic>? _attSummary;
  List<dynamic> _homework = [];
  List<dynamic> _todayPeriods = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sp = context.read<StudentProfileProvider>();
      if (sp.profile == null && !sp.loading) {
        sp
            .fetchProfile()
            .then((_) => _load(sp.profile?.id, sp.profile?.classId));
      } else {
        _load(sp.profile?.id, sp.profile?.classId);
      }
    });
  }

  Future<void> _load(String? studentId, String? classId) async {
    if (studentId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final now = DateTime.now();

      Map<String, dynamic>? attSummary;
      List<dynamic> homework = [];
      List<dynamic> todaySlots = [];

      try {
        final r = await ApiClient.get('/attendance/summary', params: {
          'studentId': studentId,
          'month': now.month.toString(),
          'year': now.year.toString(),
        });
        attSummary = r.data['summary'] as Map<String, dynamic>?;
      } catch (_) {}

      try {
        final r = await ApiClient.get('/homework/student-summary',
            params: {'studentId': studentId});
        homework = (r.data['homework'] as List<dynamic>? ?? [])
            .where((h) => h['status'] == 'active')
            .take(5)
            .toList();
      } catch (_) {}

      if (classId != null && classId.isNotEmpty) {
        try {
          final r =
              await ApiClient.get('/timetable', params: {'classId': classId});
          final dayName = DateFormat('EEEE').format(now).toLowerCase();
          final map = r.data['timetable'] as Map<String, dynamic>? ?? {};
          todaySlots = (map[dayName] as List<dynamic>?) ?? [];
        } catch (_) {}
      }

      setState(() {
        _attSummary = attSummary;
        _homework = homework;
        _todayPeriods = todaySlots;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sp = context.watch<StudentProfileProvider>();
    final perms = context.watch<SchoolPermissionsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final student = sp.profile;

    if (_loading || sp.loading) {
      return const _DashboardSkeleton();
    }

    final present = (_attSummary?['present'] as num?)?.toInt() ?? 0;
    final total = (_attSummary?['total'] as num?)?.toInt() ?? 0;
    final attPct = total > 0 ? (present / total * 100).round() : 0;
    final absent = (_attSummary?['absent'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      onRefresh: () async => _load(student?.id, student?.classId),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          // ── Welcome Card ─────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Good ${_greeting()},',
                        style: AppTypography.s14Regular(
                            color: Colors.white.withValues(alpha: 0.85)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        student?.name ?? 'Student',
                        style: AppTypography.s20Bold(color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          student?.classLabel ?? 'No class',
                          style: AppTypography.s12SemiBold(color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Colors.white.withValues(alpha: 0.25),
                  child: Text(
                    (student?.name ?? 'S')[0].toUpperCase(),
                    style: AppTypography.s24Bold(color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Stats Row ────────────────────────────────────────────────────
          if (perms.studentCan('viewAttendance')) ...[
            Text('This Month',
                style: AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 10),
            Row(
              children: [
                _StatCard(
                  label: 'Attendance',
                  value: '$attPct%',
                  color: attPct >= 75
                      ? AppColors.accentGreen
                      : AppColors.accentRed,
                  icon: Icons.bar_chart,
                  isDark: isDark,
                ),
                const SizedBox(width: 10),
                _StatCard(
                  label: 'Present',
                  value: '$present',
                  color: AppColors.accentGreen,
                  icon: Icons.check_circle_outline,
                  isDark: isDark,
                ),
                const SizedBox(width: 10),
                _StatCard(
                  label: 'Absent',
                  value: '$absent',
                  color: AppColors.accentRed,
                  icon: Icons.cancel_outlined,
                  isDark: isDark,
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],

          // ── Quick Actions ────────────────────────────────────────────────
          Text('Quick Access',
              style: AppTypography.s14SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const SizedBox(height: 10),
          _QuickActions(perms: perms),
          const SizedBox(height: 20),

          // ── Today's Timetable ────────────────────────────────────────────
          if (perms.studentCan('viewTimetable') &&
              _todayPeriods.isNotEmpty) ...[
            _SectionHeader(
              title: "Today's Schedule",
              onSeeAll: () => context.go('/student/timetable'),
              isDark: isDark,
            ),
            const SizedBox(height: 10),
            ..._todayPeriods
                .take(4)
                .map((p) => _TimetableTile(period: p, isDark: isDark)),
            const SizedBox(height: 20),
          ],

          // ── Recent Homework ───────────────────────────────────────────────
          if (perms.studentCan('viewHomework') && _homework.isNotEmpty) ...[
            _SectionHeader(
              title: 'Homework',
              onSeeAll: () => context.go('/student/homework'),
              isDark: isDark,
            ),
            const SizedBox(height: 10),
            ..._homework.map((h) => _HomeworkTile(hw: h, isDark: isDark)),
          ],

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          // Welcome card
          const SkeletonBox(height: 110, radius: 20),
          const SizedBox(height: 20),
          // Section title
          const SkeletonBox(width: 120, height: 14),
          const SizedBox(height: 10),
          // Stats row
          Row(
            children: const [
              Expanded(child: SkeletonBox(height: 86, radius: 14)),
              SizedBox(width: 10),
              Expanded(child: SkeletonBox(height: 86, radius: 14)),
              SizedBox(width: 10),
              Expanded(child: SkeletonBox(height: 86, radius: 14)),
            ],
          ),
          const SizedBox(height: 20),
          // Quick access title
          const SkeletonBox(width: 120, height: 14),
          const SizedBox(height: 10),
          // Quick actions grid (2 rows of 3)
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.1,
            children: const [
              SkeletonBox(radius: 14),
              SkeletonBox(radius: 14),
              SkeletonBox(radius: 14),
              SkeletonBox(radius: 14),
              SkeletonBox(radius: 14),
              SkeletonBox(radius: 14),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final Color color;
  final IconData icon;
  final bool isDark;

  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 6),
              Text(value, style: AppTypography.s18Bold(color: color)),
              const SizedBox(height: 2),
              Text(label,
                  style: AppTypography.s11Regular(color: AppColors.textMuted),
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}

class _QuickActions extends StatelessWidget {
  final SchoolPermissionsProvider perms;
  const _QuickActions({required this.perms});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final items = <Map<String, dynamic>>[
      if (perms.studentCan('viewAttendance'))
        {
          'icon': Icons.fact_check_outlined,
          'label': 'Attendance',
          'color': AppColors.accentGreen,
          'route': '/student/attendance'
        },
      if (perms.studentCan('viewHomework'))
        {
          'icon': Icons.assignment_outlined,
          'label': 'Homework',
          'color': AppColors.accentOrange,
          'route': '/student/homework'
        },
      if (perms.studentCan('viewExams'))
        {
          'icon': Icons.quiz_outlined,
          'label': 'Exams',
          'color': AppColors.accentPurple,
          'route': '/student/exams'
        },
      if (perms.studentCan('viewFees'))
        {
          'icon': Icons.receipt_outlined,
          'label': 'Fees',
          'color': AppColors.accentRed,
          'route': '/student/fees'
        },
      if (perms.studentCan('viewTimetable'))
        {
          'icon': Icons.schedule_outlined,
          'label': 'Timetable',
          'color': AppColors.primary,
          'route': '/student/timetable'
        },
      if (perms.studentCan('submitLeaveRequest'))
        {
          'icon': Icons.event_note_outlined,
          'label': 'Leave',
          'color': AppColors.warning,
          'route': '/student/leave'
        },
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.1,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final item = items[i];
        final color = item['color'] as Color;
        return GestureDetector(
          onTap: () => context.go(item['route'] as String),
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(item['icon'] as IconData, color: color, size: 22),
                ),
                const SizedBox(height: 8),
                Text(item['label'] as String,
                    style: AppTypography.s12SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                    textAlign: TextAlign.center),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback onSeeAll;
  final bool isDark;
  const _SectionHeader(
      {required this.title, required this.onSeeAll, required this.isDark});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Text(title,
              style: AppTypography.s14SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const Spacer(),
          GestureDetector(
            onTap: onSeeAll,
            child: Text('See all',
                style: AppTypography.s13Regular(color: AppColors.primary)),
          ),
        ],
      );
}

class _TimetableTile extends StatelessWidget {
  final dynamic period;
  final bool isDark;
  const _TimetableTile({required this.period, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final subjectName = period['subject']?['name'] as String? ??
        period['subjectName'] as String? ??
        'Class';
    final periodNo = period['period'] as int? ?? 0;
    final start = period['startTime'] as String? ?? '';
    final end = period['endTime'] as String? ?? '';
    String colorStr = period['subject']?['color'] as String? ?? '#1A56E8';
    Color color;
    try {
      color = Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
    } catch (_) {
      color = AppColors.primary;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text('P$periodNo',
                  style: AppTypography.s12Bold(color: color)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(subjectName,
                style: AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          if (start.isNotEmpty)
            Text('$start–$end',
                style: AppTypography.s12Regular(color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

class _HomeworkTile extends StatelessWidget {
  final dynamic hw;
  final bool isDark;
  const _HomeworkTile({required this.hw, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final title = hw['title'] as String? ?? 'Homework';
    final subject = hw['subject']?['name'] as String? ?? '';
    final dueDate = hw['dueDate'];
    String due = '';
    try {
      due = DateFormat('dd MMM').format(DateTime.parse(dueDate.toString()));
    } catch (_) {}
    final sub = hw['submission'];
    final isDone = sub?['status'] == 'completed';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.accentOrange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.assignment_outlined,
                color: AppColors.accentOrange, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: AppTypography.s14SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if (subject.isNotEmpty)
                  Text(subject,
                      style:
                          AppTypography.s12Regular(color: AppColors.textMuted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (due.isNotEmpty)
                Text('Due $due',
                    style:
                        AppTypography.s12Regular(color: AppColors.textMuted)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: (isDone ? AppColors.accentGreen : AppColors.warning)
                      .withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isDone ? 'Done' : 'Pending',
                  style: AppTypography.s11Regular(
                    color: isDone ? AppColors.accentGreen : AppColors.warning,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
