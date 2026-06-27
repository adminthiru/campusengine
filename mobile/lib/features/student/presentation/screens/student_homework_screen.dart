import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/homework/presentation/widgets/homework_submission_sheet.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentHomeworkScreen extends StatefulWidget {
  const StudentHomeworkScreen({super.key});
  @override
  State<StudentHomeworkScreen> createState() => _StudentHomeworkScreenState();
}

class _StudentHomeworkScreenState extends State<StudentHomeworkScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  List<dynamic> _all = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final studentId = context.read<StudentProfileProvider>().profile?.id;
    if (studentId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/homework/student-summary',
          params: {'studentId': studentId});
      setState(() {
        _all = res.data['homework'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<dynamic> get _pending => _all.where((h) {
        final sub = h['submission'];
        return h['status'] == 'active' && sub?['status'] != 'completed';
      }).toList();

  List<dynamic> get _completed => _all.where((h) {
        final sub = h['submission'];
        return sub?['status'] == 'completed';
      }).toList();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final studentId =
        context.watch<StudentProfileProvider>().profile?.id ?? '';
    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            child: TabBar(
              controller: _tab,
              tabs: [
                Tab(text: 'All (${_all.length})'),
                Tab(text: 'Pending (${_pending.length})'),
                Tab(text: 'Done (${_completed.length})'),
              ],
              indicatorColor: AppColors.primary,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textMuted,
              labelStyle: AppTypography.s13SemiBold(),
            ),
          ),
          Expanded(
            child: _loading
                ? const SkeletonList(showLeading: false, itemHeight: 120)
                : TabBarView(
                    controller: _tab,
                    children: [
                      _HomeworkList(
                          items: _all,
                          onRefresh: _load,
                          studentId: studentId,
                          isDark: isDark),
                      _HomeworkList(
                          items: _pending,
                          onRefresh: _load,
                          studentId: studentId,
                          isDark: isDark),
                      _HomeworkList(
                          items: _completed,
                          onRefresh: _load,
                          studentId: studentId,
                          isDark: isDark),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _HomeworkList extends StatelessWidget {
  final List<dynamic> items;
  final Future<void> Function() onRefresh;
  final String studentId;
  final bool isDark;
  const _HomeworkList(
      {required this.items,
      required this.onRefresh,
      required this.studentId,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined,
                size: 56, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text('No homework here',
                style: AppTypography.s16SemiBold(color: AppColors.textMuted)),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (_, i) => _HwCard(
            hw: items[i],
            studentId: studentId,
            onChanged: onRefresh,
            isDark: isDark),
      ),
    );
  }
}

class _HwCard extends StatelessWidget {
  final dynamic hw;
  final String studentId;
  final Future<void> Function() onChanged;
  final bool isDark;
  const _HwCard({
    required this.hw,
    required this.studentId,
    required this.onChanged,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final title = hw['title'] as String? ?? 'Homework';
    final desc = hw['description'] as String? ?? '';
    final subject = hw['subject']?['name'] as String? ?? '';
    final subjectColor = hw['subject']?['color'] as String?;
    final dueDate = hw['dueDate'];
    final status = hw['status'] as String? ?? 'active';
    final sub = hw['submission'];
    final isDone = sub?['status'] == 'completed';
    final isOverdue = status == 'active' &&
        !isDone &&
        dueDate != null &&
        DateTime.tryParse(dueDate.toString())?.isBefore(DateTime.now()) == true;

    Color accentColor;
    try {
      accentColor = Color(
          int.parse((subjectColor ?? '#1A56E8').replaceFirst('#', '0xFF')));
    } catch (_) {
      accentColor = AppColors.primary;
    }

    String dueLabel = '';
    try {
      dueLabel =
          DateFormat('dd MMM yyyy').format(DateTime.parse(dueDate.toString()));
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isOverdue
                ? AppColors.accentRed.withValues(alpha: 0.4)
                : (isDark ? AppColors.borderDark : AppColors.borderLight)),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(width: 5, color: accentColor),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (subject.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: accentColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(subject,
                                  style: AppTypography.s11SemiBold(
                                      color: accentColor)),
                            ),
                          const Spacer(),
                          _StatusBadge(isDone: isDone, isOverdue: isOverdue),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(title,
                          style: AppTypography.s14SemiBold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(desc,
                            style: AppTypography.s12Regular(
                                color: AppColors.textMuted),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis),
                      ],
                      if (dueLabel.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.calendar_today_outlined,
                                size: 13,
                                color: isOverdue
                                    ? AppColors.accentRed
                                    : AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text('Due: $dueLabel',
                                style: AppTypography.s12Regular(
                                    color: isOverdue
                                        ? AppColors.accentRed
                                        : AppColors.textMuted)),
                          ],
                        ),
                      ],
                      if (isDone && sub?['submittedAt'] != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.check_circle_outline,
                                size: 13, color: AppColors.accentGreen),
                            const SizedBox(width: 4),
                            Text(
                              'Submitted on ${_fmtDate(sub!['submittedAt'])}',
                              style: AppTypography.s12Regular(
                                  color: AppColors.accentGreen),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final changed =
                                await showHomeworkSubmissionSheet(
                              context,
                              homeworkId: (hw['_id'] ?? '').toString(),
                              studentId: studentId,
                              title: title,
                              submission: sub is Map ? sub : null,
                            );
                            if (changed) onChanged();
                          },
                          icon: Icon(
                              isDone
                                  ? Icons.edit_outlined
                                  : Icons.upload_file,
                              size: 18),
                          label: Text(isDone
                              ? 'Update Submission'
                              : 'Submit Homework'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            padding:
                                const EdgeInsets.symmetric(vertical: 9),
                            side: BorderSide(
                                color: AppColors.primary
                                    .withValues(alpha: 0.5)),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtDate(dynamic d) {
    try {
      return DateFormat('dd MMM').format(DateTime.parse(d.toString()));
    } catch (_) {
      return '';
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final bool isDone, isOverdue;
  const _StatusBadge({required this.isDone, required this.isOverdue});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;
    if (isDone) {
      color = AppColors.accentGreen;
      label = 'Completed';
    } else if (isOverdue) {
      color = AppColors.accentRed;
      label = 'Overdue';
    } else {
      color = AppColors.warning;
      label = 'Pending';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: AppTypography.s11SemiBold(color: color)),
    );
  }
}
