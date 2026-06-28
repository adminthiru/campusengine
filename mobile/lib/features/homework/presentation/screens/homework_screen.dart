import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../../../../core/models/homework.dart';
import '../../../../core/models/student.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/skeleton.dart';
import '../providers/homework_provider.dart';

class HomeworkScreen extends StatelessWidget {
  const HomeworkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HomeworkProvider()..initialize(),
      child: const _HomeworkScreenContent(),
    );
  }
}

class _HomeworkScreenContent extends StatefulWidget {
  const _HomeworkScreenContent();

  @override
  State<_HomeworkScreenContent> createState() => _HomeworkScreenContentState();
}

class _HomeworkScreenContentState extends State<_HomeworkScreenContent> {
  String? _viewHwId;

  @override
  Widget build(BuildContext context) {
    if (_viewHwId != null) {
      return _HomeworkDetail(
        hwId: _viewHwId!,
        onBack: () {
          setState(() => _viewHwId = null);
          final p = context.read<HomeworkProvider>();
          p.fetchHomework();
        },
      );
    }
    return _HomeworkList(
      onViewDetail: (id) => setState(() => _viewHwId = id),
    );
  }
}

// ─── List Screen ─────────────────────────────────────────────────────────────
class _HomeworkList extends StatefulWidget {
  final Function(String) onViewDetail;
  const _HomeworkList({required this.onViewDetail});

  @override
  State<_HomeworkList> createState() => _HomeworkListState();
}

class _HomeworkListState extends State<_HomeworkList> {
  String _activeClass = 'all';
  String? _dateFilter; // null = any date
  String _statusFilter = '';

  Color _hexToColor(String? hex) {
    if (hex == null || hex.isEmpty) return Colors.grey;
    final buffer = StringBuffer();
    if (hex.length == 6 || hex.length == 7) buffer.write('ff');
    buffer.write(hex.replaceFirst('#', ''));
    return Color(int.parse(buffer.toString(), radix: 16));
  }

  Future<void> _applyFilters() {
    return context.read<HomeworkProvider>().fetchHomework(
          classId: _activeClass,
          date: _dateFilter,
          status: _statusFilter,
        );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeworkProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    final allHw = provider.homeworkList;
    final activeCount = allHw.where((h) => h.status == 'active').length;
    final todayStr = DateTime.now().toIso8601String().split('T')[0];
    final dueTodayCount = allHw.where((h) => h.dueDate?.startsWith(todayStr) == true && h.status == 'active').length;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      floatingActionButton: provider.canManage
          ? FloatingActionButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ChangeNotifierProvider.value(
                      value: provider,
                      child: const _AddEditScreen(),
                    ),
                  ),
                ).then((_) => _applyFilters());
              },
              backgroundColor: AppColors.primary,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
      body: Column(
        children: [
          // ── Compact stats strip ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                Expanded(child: _StatCard(title: 'Total', value: allHw.length, color: AppColors.primary, isDark: isDark)),
                const SizedBox(width: 10),
                Expanded(child: _StatCard(title: 'Active', value: activeCount, color: AppColors.success, isDark: isDark)),
                const SizedBox(width: 10),
                Expanded(child: _StatCard(title: 'Due Today', value: dueTodayCount, color: AppColors.warning, isDark: isDark)),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // ── Status filter chips + date toggle ────────────────────────────
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              children: [
                for (final s in const [
                  ['', 'All'],
                  ['active', 'Active'],
                  ['completed', 'Completed'],
                  ['cancelled', 'Cancelled'],
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _Chip(
                      label: s[1],
                      isActive: _statusFilter == s[0],
                      onTap: () {
                        setState(() => _statusFilter = s[0]);
                        _applyFilters();
                      },
                    ),
                  ),
                _DateChip(
                  date: _dateFilter,
                  isDark: isDark,
                  onPick: () async {
                    final dt = await showDatePicker(
                      context: context,
                      initialDate: _dateFilter != null
                          ? DateTime.parse(_dateFilter!)
                          : DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (dt != null) {
                      setState(() =>
                          _dateFilter = dt.toIso8601String().split('T')[0]);
                      _applyFilters();
                    }
                  },
                  onClear: () {
                    setState(() => _dateFilter = null);
                    _applyFilters();
                  },
                ),
              ],
            ),
          ),

          // ── Class filter chips ───────────────────────────────────────────
          if (provider.classes.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _Chip(
                      label: 'All Classes',
                      isActive: _activeClass == 'all',
                      icon: Icons.class_outlined,
                      onTap: () {
                        setState(() => _activeClass = 'all');
                        _applyFilters();
                      },
                    ),
                  ),
                  ...provider.classes.map((c) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _Chip(
                          label: c.fullName,
                          isActive: _activeClass == c.id,
                          onTap: () {
                            setState(() => _activeClass = c.id);
                            _applyFilters();
                          },
                        ),
                      )),
                ],
              ),
            ),
          ],

          const SizedBox(height: 12),

          // ── List ─────────────────────────────────────────────────────────
          Expanded(
            child: provider.isLoading
                ? const SkeletonList(showLeading: false)
                : provider.error != null
                    ? Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          const Icon(Icons.error_outline, color: Colors.red, size: 36),
                          const SizedBox(height: 8),
                          Text(provider.error!, style: AppTypography.s14Regular(color: Colors.red), textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          ElevatedButton(onPressed: () => context.read<HomeworkProvider>().fetchHomework(), child: const Text('Retry')),
                        ]),
                      )
                    : allHw.isEmpty
                        ? RefreshIndicator(
                            onRefresh: _applyFilters,
                            child: ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height * 0.6,
                                  child: _EmptyHomework(isDark: isDark),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _applyFilters,
                            child: ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                              itemCount: allHw.length,
                              separatorBuilder: (c, i) => const SizedBox(height: 10),
                              itemBuilder: (c, i) => _HomeworkCard(
                                hw: allHw[i],
                                color: _hexToColor(allHw[i].subject?.color),
                                isDark: isDark,
                                onTap: () => widget.onViewDetail(allHw[i].id),
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ─── Empty state ─────────────────────────────────────────────────────────────
class _EmptyHomework extends StatelessWidget {
  final bool isDark;
  const _EmptyHomework({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.assignment_outlined,
              size: 52,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          const SizedBox(height: 12),
          Text('No homework found',
              style: AppTypography.s15SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text('Try changing the filters above',
              style: AppTypography.s13Regular(color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

// ─── Homework card ───────────────────────────────────────────────────────────
class _HomeworkCard extends StatelessWidget {
  final Homework hw;
  final Color color;
  final bool isDark;
  final VoidCallback onTap;

  const _HomeworkCard({
    required this.hw,
    required this.color,
    required this.isDark,
    required this.onTap,
  });

  String _dueLabel() {
    if (hw.dueDate == null) return '';
    final due = DateTime.tryParse(hw.dueDate!);
    if (due == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dueDay = DateTime(due.year, due.month, due.day);
    final diff = dueDay.difference(today).inDays;
    if (diff < 0) return 'Overdue';
    if (diff == 0) return 'Due today';
    if (diff == 1) return 'Due tomorrow';
    return 'Due ${DateFormat('dd MMM').format(due)}';
  }

  @override
  Widget build(BuildContext context) {
    final dueLabel = _dueLabel();
    final isUrgent = (dueLabel == 'Overdue' || dueLabel == 'Due today') &&
        hw.status == 'active';
    final studentsLabel =
        hw.assignedTo == 'all' ? 'All students' : '${hw.students.length} students';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Subject color accent bar
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(14)),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title + status
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              hw.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.s15Bold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary),
                            ),
                          ),
                          const SizedBox(width: 8),
                          _StatusBadge(status: hw.status),
                        ],
                      ),
                      // Subject · class
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration:
                                BoxDecoration(shape: BoxShape.circle, color: color),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              hw.subject?.name ?? 'No subject',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.s12Medium(
                                  color: isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                            ),
                          ),
                          if (hw.classRef != null) ...[
                            Text('  ·  ',
                                style: AppTypography.s12Medium(
                                    color: AppColors.textMuted)),
                            Text(
                              hw.classRef!.fullName,
                              style: AppTypography.s12SemiBold(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.textPrimary),
                            ),
                          ],
                        ],
                      ),
                      if (hw.description?.isNotEmpty == true) ...[
                        const SizedBox(height: 6),
                        Text(
                          hw.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.s12Regular(
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary),
                        ),
                      ],
                      const SizedBox(height: 10),
                      // Footer chips
                      Row(
                        children: [
                          if (dueLabel.isNotEmpty)
                            _MetaPill(
                              icon: Icons.event_outlined,
                              label: dueLabel,
                              color: isUrgent ? AppColors.error : AppColors.info,
                            ),
                          if (dueLabel.isNotEmpty) const SizedBox(width: 8),
                          _MetaPill(
                            icon: Icons.group_outlined,
                            label: studentsLabel,
                            color: AppColors.textSecondary,
                            subtle: true,
                            isDark: isDark,
                          ),
                          const Spacer(),
                          Icon(Icons.chevron_right,
                              size: 18,
                              color: isDark
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary),
                        ],
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
}

// ─── Small meta pill (due date / students) ────────────────────────────────────
class _MetaPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool subtle;
  final bool isDark;

  const _MetaPill({
    required this.icon,
    required this.label,
    required this.color,
    this.subtle = false,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    final fg = subtle
        ? (isDark ? AppColors.textMuted : AppColors.textSecondary)
        : color;
    final bg = subtle
        ? (isDark ? AppColors.bgDark : AppColors.bgLight)
        : color.withValues(alpha: 0.1);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: fg),
          const SizedBox(width: 4),
          Text(label, style: AppTypography.s10Bold(color: fg)),
        ],
      ),
    );
  }
}

// ─── Filter chip (status + class) ─────────────────────────────────────────────
class _Chip extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  final IconData? icon;

  const _Chip({
    required this.label,
    required this.isActive,
    required this.onTap,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isActive
              ? AppColors.primary
              : (isDark ? AppColors.cardDark : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: isActive
                  ? AppColors.primary
                  : (isDark ? AppColors.borderDark : AppColors.borderLight)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon,
                  size: 14,
                  color: isActive
                      ? Colors.white
                      : (isDark ? AppColors.textMuted : AppColors.textSecondary)),
              const SizedBox(width: 6),
            ],
            Text(label,
                style: AppTypography.s12SemiBold(
                    color: isActive
                        ? Colors.white
                        : (isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary))),
          ],
        ),
      ),
    );
  }
}

// ─── Date filter chip ─────────────────────────────────────────────────────────
class _DateChip extends StatelessWidget {
  final String? date;
  final bool isDark;
  final VoidCallback onPick;
  final VoidCallback onClear;

  const _DateChip({
    required this.date,
    required this.isDark,
    required this.onPick,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final active = date != null;
    final label =
        active ? DateFormat('dd MMM').format(DateTime.parse(date!)) : 'Any date';
    return GestureDetector(
      onTap: onPick,
      child: Container(
        padding: EdgeInsets.only(left: 12, right: active ? 6 : 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary.withValues(alpha: 0.12)
              : (isDark ? AppColors.cardDark : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: active
                  ? AppColors.primary
                  : (isDark ? AppColors.borderDark : AppColors.borderLight)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.calendar_today,
                size: 13,
                color: active
                    ? AppColors.primary
                    : (isDark ? AppColors.textMuted : AppColors.textSecondary)),
            const SizedBox(width: 6),
            Text(label,
                style: AppTypography.s12SemiBold(
                    color: active
                        ? AppColors.primary
                        : (isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary))),
            if (active) ...[
              const SizedBox(width: 2),
              GestureDetector(
                onTap: onClear,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close, size: 14, color: AppColors.primary),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final int value;
  final Color color;
  final bool isDark;

  const _StatCard({
    required this.title,
    required this.value,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.s11Medium(
                      color: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(value.toString(), style: AppTypography.s20Bold(color: color)),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color, bg;
    if (status == 'completed') {
      color = AppColors.success;
      bg = AppColors.badgeSuccessBg;
    } else if (status == 'cancelled') {
      color = AppColors.error;
      bg = AppColors.badgeDangerBg;
    } else {
      color = AppColors.success;
      bg = AppColors.badgeSuccessBg;
    }
    
    // Fallback logic for badge colors based on 'active' matching UI green in admin panel
    if (status == 'active') {
       color = AppColors.success;
       bg = const Color(0xFFDCFCE7);
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(status.toUpperCase(), style: AppTypography.s10Bold(color: color)),
    );
  }
}

// ─── Detail Screen ───────────────────────────────────────────────────────────
class _HomeworkDetail extends StatefulWidget {
  final String hwId;
  final VoidCallback onBack;

  const _HomeworkDetail({required this.hwId, required this.onBack});

  @override
  State<_HomeworkDetail> createState() => _HomeworkDetailState();
}

class _HomeworkDetailState extends State<_HomeworkDetail> {
  Homework? _hw;
  List<HwSubmission> _submissions = [];
  List<Student> _students = [];
  bool _isLoading = true;
  bool _editMode = false;
  Map<String, String> _localStatuses = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadData();
    });
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    final p = context.read<HomeworkProvider>();
    final hw = await p.fetchDetail(widget.hwId);
    if (hw != null) {
      final subs = await p.fetchSubmissions(widget.hwId);
      List<Student> st = [];
      if (hw.assignedTo == 'all' && hw.classRef != null) {
        st = await p.fetchStudents(hw.classRef!.id);
      } else {
        // Map StudentRef to Student
        st = hw.students.map((s) => Student(id: s.id, name: s.name, admissionNumber: s.admissionNumber)).toList();
      }
      if (mounted) {
        setState(() {
          _hw = hw;
          _submissions = subs;
          _students = st;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: isError ? AppColors.error : AppColors.success));
  }

  void _saveStatuses() async {
    final p = context.read<HomeworkProvider>();
    setState(() => _isLoading = true);
    bool allOk = true;
    for (var s in _students) {
      final status = _localStatuses[s.id] ?? _getSubStatus(s.id);
      final currentSub = _submissions.firstWhere((sub) => sub.student?.id == s.id, orElse: () => HwSubmission(id: '', status: 'pending'));
      if (status != currentSub.status) {
        final ok = await p.updateSubmissionStatus(widget.hwId, s.id, status);
        if (!ok) allOk = false;
      }
    }
    if (allOk) {
      _showSnack('Statuses updated!');
    } else {
      _showSnack('Some updates failed', isError: true);
    }
    
    setState(() => _editMode = false);
    _loadData();
  }

  String _getSubStatus(String studentId) {
    try {
      return _submissions.firstWhere((s) => s.student?.id == studentId).status;
    } catch (_) {
      return 'pending';
    }
  }

  Color _hexToColor(String? hex) {
    if (hex == null || hex.isEmpty) return AppColors.primary;
    var h = hex.replaceFirst('#', '');
    if (h.length == 6) h = 'ff$h';
    final v = int.tryParse(h, radix: 16);
    return v == null ? AppColors.primary : Color(v);
  }

  Widget _header(BuildContext context, HomeworkProvider p, bool isDark) {
    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      padding: const EdgeInsets.only(right: 4),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_ios_new,
                size: 20, color: isDark ? Colors.white : AppColors.textPrimary),
            onPressed: widget.onBack,
          ),
          Expanded(
            child: Text('Homework',
                style: AppTypography.s16Bold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          if (p.canManage)
            IconButton(
              icon: Icon(Icons.more_vert,
                  color: isDark ? AppColors.textMuted : AppColors.textSecondary),
              onPressed: () => _showActionsSheet(p),
            ),
        ],
      ),
    );
  }

  void _showActionsSheet(HomeworkProvider p) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: Row(
                  children: [
                    Text('Homework Actions',
                        style: AppTypography.s13SemiBold(
                            color: isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary)),
                  ],
                ),
              ),
              _ActionTile(
                icon: Icons.notifications_active_outlined,
                color: AppColors.warning,
                title: 'Notify Parents',
                subtitle: 'Send a reminder to parents',
                isDark: isDark,
                onTap: () async {
                  Navigator.pop(sheetCtx);
                  final ok = await p.notifyParents(widget.hwId);
                  _showSnack(ok ? 'Parents notified' : 'Failed to notify',
                      isError: !ok);
                },
              ),
              _ActionTile(
                icon: Icons.edit_outlined,
                color: AppColors.primary,
                title: 'Edit Homework',
                subtitle: 'Update details and assignment',
                isDark: isDark,
                onTap: () {
                  Navigator.pop(sheetCtx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ChangeNotifierProvider.value(
                        value: p,
                        child: _AddEditScreen(hw: _hw),
                      ),
                    ),
                  ).then((_) => _loadData());
                },
              ),
              _ActionTile(
                icon: Icons.delete_outline,
                color: AppColors.error,
                title: 'Delete Homework',
                subtitle: 'Permanently remove this homework',
                isDark: isDark,
                destructive: true,
                onTap: () {
                  Navigator.pop(sheetCtx);
                  _confirmDelete(context, p);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, HomeworkProvider p) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Delete Homework?'),
        content:
            const Text('Are you sure you want to delete this homework?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Delete',
                  style: TextStyle(color: AppColors.error))),
        ],
      ),
    );
    if (confirm == true) {
      final ok = await p.deleteHomework(widget.hwId);
      if (ok) {
        _showSnack('Deleted successfully');
        widget.onBack();
      } else {
        _showSnack('Failed to delete', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final p = context.watch<HomeworkProvider>();

    if (_isLoading) {
      return const Scaffold(body: SkeletonList());
    }

    if (_hw == null) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
        body: Column(
          children: [
            _header(context, p, isDark),
            const Expanded(child: Center(child: Text('Homework not found'))),
          ],
        ),
      );
    }

    final hw = _hw!;
    final accent = _hexToColor(hw.subject?.color);
    final isOverdue = hw.dueDate != null &&
        DateTime.parse(hw.dueDate!).isBefore(DateTime.now()) &&
        hw.status == 'active';

    int completed = 0, inProgress = 0;
    for (var s in _students) {
      final st = _getSubStatus(s.id);
      if (st == 'completed') completed++;
      if (st == 'in_progress') inProgress++;
    }
    final pending = _students.length - completed - inProgress;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          _header(context, p, isDark),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                // ── Hero card ──────────────────────────────────────────────
                _card(
                  isDark,
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 4,
                            height: 40,
                            decoration: BoxDecoration(
                                color: accent,
                                borderRadius: BorderRadius.circular(4)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(hw.title,
                                style: AppTypography.s18Bold(
                                    color: isDark
                                        ? Colors.white
                                        : AppColors.textPrimary)),
                          ),
                          const SizedBox(width: 8),
                          _StatusBadge(status: hw.status),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                                shape: BoxShape.circle, color: accent),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(hw.subject?.name ?? 'No subject',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.s13Medium(
                                    color: isDark
                                        ? AppColors.textMuted
                                        : AppColors.textSecondary)),
                          ),
                          if (hw.classRef != null) ...[
                            Text('  ·  ',
                                style: AppTypography.s13Medium(
                                    color: AppColors.textMuted)),
                            Text(hw.classRef!.fullName,
                                style: AppTypography.s13SemiBold(
                                    color: isDark
                                        ? Colors.white
                                        : AppColors.textPrimary)),
                          ],
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: _DateTile(
                              label: 'ASSIGNED',
                              value: hw.assignedDate != null
                                  ? DateFormat('dd MMM yyyy')
                                      .format(DateTime.parse(hw.assignedDate!))
                                  : '—',
                              isDark: isDark,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _DateTile(
                              label: isOverdue ? 'DUE · OVERDUE' : 'DUE',
                              value: hw.dueDate != null
                                  ? DateFormat('dd MMM yyyy')
                                      .format(DateTime.parse(hw.dueDate!))
                                  : '—',
                              isDark: isDark,
                              danger: isOverdue,
                            ),
                          ),
                        ],
                      ),
                      if (hw.description?.isNotEmpty == true) ...[
                        const SizedBox(height: 14),
                        Text('DESCRIPTION',
                            style: AppTypography.s10Bold(
                                color: isDark
                                    ? AppColors.textMuted
                                    : AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        Text(hw.description!,
                            style: AppTypography.s14Regular(
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                      ],
                    ],
                  ),
                ),

                // ── Progress card ──────────────────────────────────────────
                if (_students.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _card(
                    isDark,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Submission Progress',
                            style: AppTypography.s13SemiBold(
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                        const SizedBox(height: 10),
                        _ProgressBar(
                          completed: completed,
                          inProgress: inProgress,
                          pending: pending,
                          total: _students.length,
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 16,
                          runSpacing: 6,
                          children: [
                            _Legend(
                                color: AppColors.success,
                                label: 'Completed',
                                count: completed),
                            _Legend(
                                color: AppColors.warning,
                                label: 'In progress',
                                count: inProgress),
                            _Legend(
                                color: AppColors.error,
                                label: 'Pending',
                                count: pending),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],

                // ── Students ───────────────────────────────────────────────
                const SizedBox(height: 16),
                Row(
                  children: [
                    Text('Students (${_students.length})',
                        style: AppTypography.s16Bold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    const Spacer(),
                    if (p.canManage && _students.isNotEmpty && !_editMode)
                      TextButton.icon(
                        onPressed: () {
                          final initMap = <String, String>{};
                          for (var s in _students) {
                            initMap[s.id] = _getSubStatus(s.id);
                          }
                          setState(() {
                            _localStatuses = initMap;
                            _editMode = true;
                          });
                        },
                        icon: const Icon(Icons.edit_outlined, size: 16),
                        label: const Text('Edit status'),
                        style: TextButton.styleFrom(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 8),
                            minimumSize: Size.zero),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_students.isEmpty)
                  _card(
                    isDark,
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text('No students assigned',
                            style: AppTypography.s14Regular(
                                color: AppColors.textMuted)),
                      ),
                    ),
                  )
                else
                  _card(
                    isDark,
                    Column(
                      children: [
                        for (int i = 0; i < _students.length; i++) ...[
                          if (i > 0)
                            Divider(
                                height: 18,
                                color: isDark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight),
                          _studentRow(i, isDark),
                        ],
                      ],
                    ),
                  ),
              ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _editMode
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.cardDark : Colors.white,
                  border: Border(
                      top: BorderSide(
                          color: isDark
                              ? AppColors.borderDark
                              : AppColors.borderLight)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() => _editMode = false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: _saveStatuses,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Save Changes',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  Widget _card(bool isDark, Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: child,
      );

  Widget _studentRow(int i, bool isDark) {
    final st = _students[i];
    final sub = _submissions.firstWhere((s) => s.student?.id == st.id,
        orElse: () => HwSubmission(id: '', status: 'pending'));
    final currentStatus =
        _editMode ? (_localStatuses[st.id] ?? 'pending') : sub.status;

    Color stColor;
    if (currentStatus == 'completed') {
      stColor = AppColors.success;
    } else if (currentStatus == 'in_progress') {
      stColor = AppColors.warning;
    } else {
      stColor = AppColors.error;
    }

    return Row(
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.primary.withValues(alpha: 0.1),
          child: Text(
            st.name.isNotEmpty ? st.name[0].toUpperCase() : '?',
            style: AppTypography.s12Bold(color: AppColors.primary),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(st.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.s14SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary)),
              if (st.admissionNumber != null)
                Text(st.admissionNumber!,
                    style: AppTypography.s11Regular(
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary)),
            ],
          ),
        ),
        if (_editMode)
          Row(
            children: ['pending', 'in_progress', 'completed'].map((opt) {
              final isSel = currentStatus == opt;
              final optC = opt == 'completed'
                  ? AppColors.success
                  : (opt == 'in_progress'
                      ? AppColors.warning
                      : AppColors.error);
              return GestureDetector(
                onTap: () => setState(() => _localStatuses[st.id] = opt),
                child: Container(
                  margin: const EdgeInsets.only(left: 5),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSel ? optC : Colors.transparent,
                    border: Border.all(
                        color: isSel
                            ? optC
                            : (isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    opt == 'in_progress'
                        ? 'Prog'
                        : (opt == 'completed' ? 'Done' : 'Pend'),
                    style: AppTypography.s10Bold(
                        color: isSel
                            ? Colors.white
                            : (isDark
                                ? AppColors.textMuted
                                : AppColors.textSecondary)),
                  ),
                ),
              );
            }).toList(),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: stColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                    width: 6,
                    height: 6,
                    decoration:
                        BoxDecoration(shape: BoxShape.circle, color: stColor)),
                const SizedBox(width: 5),
                Text(currentStatus.replaceAll('_', ' ').toUpperCase(),
                    style: AppTypography.s10Bold(color: stColor)),
              ],
            ),
          ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final bool isDark;
  final bool destructive;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.isDark,
    required this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: AppTypography.s14SemiBold(
                          color: destructive
                              ? AppColors.error
                              : (isDark
                                  ? Colors.white
                                  : AppColors.textPrimary))),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: AppTypography.s11Regular(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary)),
                ],
              ),
            ),
            Icon(Icons.chevron_right,
                size: 18,
                color: isDark ? AppColors.textMuted : AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}

class _DateTile extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;
  final bool danger;
  const _DateTile({
    required this.label,
    required this.value,
    required this.isDark,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: danger
            ? AppColors.error.withValues(alpha: 0.08)
            : (isDark ? AppColors.bgDark : AppColors.bgLight),
        borderRadius: BorderRadius.circular(10),
        border: danger
            ? Border.all(color: AppColors.error.withValues(alpha: 0.3))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: AppTypography.s10Bold(
                  color: danger
                      ? AppColors.error
                      : (isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary))),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.event_outlined,
                  size: 14,
                  color: danger
                      ? AppColors.error
                      : (isDark ? Colors.white : AppColors.textPrimary)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.s13Bold(
                        color: danger
                            ? AppColors.error
                            : (isDark ? Colors.white : AppColors.textPrimary))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  final int completed, inProgress, pending, total;
  const _ProgressBar({
    required this.completed,
    required this.inProgress,
    required this.pending,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    if (total == 0) return const SizedBox.shrink();
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: SizedBox(
        height: 10,
        child: Row(
          children: [
            if (completed > 0)
              Expanded(flex: completed, child: Container(color: AppColors.success)),
            if (inProgress > 0)
              Expanded(flex: inProgress, child: Container(color: AppColors.warning)),
            if (pending > 0)
              Expanded(
                  flex: pending,
                  child: Container(
                      color: AppColors.error.withValues(alpha: 0.35))),
          ],
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  final int count;
  const _Legend(
      {required this.color, required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
        const SizedBox(width: 6),
        Text('$count $label',
            style: AppTypography.s11SemiBold(color: color)),
      ],
    );
  }
}

// ─── Add Edit Sheet ──────────────────────────────────────────────────────────
class _AddEditScreen extends StatefulWidget {
  final Homework? hw;
  const _AddEditScreen({this.hw});

  @override
  State<_AddEditScreen> createState() => _AddEditScreenState();
}

class _AddEditScreenState extends State<_AddEditScreen> {
  final _formKey = GlobalKey<FormState>();
  
  late String _classId;
  String? _subjectId;
  late String _title;
  late String _desc;
  late DateTime _assignedDate;
  late DateTime _dueDate;
  late String _status;
  late String _assignedTo;
  List<String> _selectedStudents = [];
  
  List<Student> _classStudents = [];
  bool _loadingStudents = false;

  @override
  void initState() {
    super.initState();
    final hw = widget.hw;
    _classId = hw?.classRef?.id ?? '';
    _subjectId = hw?.subject?.id;
    _title = hw?.title ?? '';
    _desc = hw?.description ?? '';
    _assignedDate = hw?.assignedDate != null ? DateTime.parse(hw!.assignedDate!) : DateTime.now();
    _dueDate = hw?.dueDate != null ? DateTime.parse(hw!.dueDate!) : DateTime.now().add(const Duration(days: 1));
    _status = hw?.status ?? 'active';
    _assignedTo = hw?.assignedTo ?? 'all';
    _selectedStudents = hw?.students.map((s) => s.id).toList() ?? [];
    
    if (_classId.isNotEmpty && _assignedTo == 'selected') {
      _loadStudents(_classId);
    }
  }
  
  Future<void> _loadStudents(String cid) async {
    setState(() => _loadingStudents = true);
    final p = context.read<HomeworkProvider>();
    final sts = await p.fetchStudents(cid);
    if (mounted) setState(() { _classStudents = sts; _loadingStudents = false; });
  }

  void _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_classId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a class'), backgroundColor: AppColors.error));
      return;
    }
    
    _formKey.currentState!.save();
    
    final p = context.read<HomeworkProvider>();
    final payload = {
      'class': _classId,
      'subject': _subjectId,
      'title': _title,
      'description': _desc,
      'assignedDate': _assignedDate.toIso8601String().split('T')[0],
      'dueDate': _dueDate.toIso8601String().split('T')[0],
      'assignedTo': _assignedTo,
      'students': _assignedTo == 'selected' ? _selectedStudents : [],
      'status': _status,
    };
    
    bool ok;
    if (widget.hw != null) {
      ok = await p.editHomework(widget.hw!.id, payload);
    } else {
      ok = await p.addHomework(payload);
    }
    
    if (ok && mounted) {
      Navigator.pop(context);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(p.error ?? 'Error saving'), backgroundColor: AppColors.error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final p = context.watch<HomeworkProvider>();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.hw != null ? 'Edit Homework' : 'New Homework',
          style: AppTypography.s18Bold(
              color: isDark ? Colors.white : AppColors.textPrimary),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                children: [
                  _field(
                    'Class',
                    isDark,
                    required: true,
                    child: _dropdown(
                      value: _classId.isEmpty ? null : _classId,
                      hint: 'Select class',
                      isDark: isDark,
                      items: p.classes
                          .map((c) => DropdownMenuItem(
                              value: c.id, child: Text(c.fullName)))
                          .toList(),
                      onChanged: (v) {
                        setState(() {
                          _classId = v ?? '';
                          _subjectId = null; // reset subject when class changes
                          if (_assignedTo == 'selected') {
                            _loadStudents(_classId);
                          }
                        });
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                  _field(
                    'Subject',
                    isDark,
                    child: _dropdown(
                      value: _subjectId,
                      hint: 'Select subject',
                      isDark: isDark,
                      items: p.subjectsForClass(_classId)
                          .map((s) => DropdownMenuItem(
                              value: s.id, child: Text(s.name)))
                          .toList(),
                      onChanged: (v) => setState(() => _subjectId = v),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _field(
                    'Title',
                    isDark,
                    required: true,
                    child: TextFormField(
                      initialValue: _title,
                      style: AppTypography.s14Regular(
                          color:
                              isDark ? Colors.white : AppColors.textPrimary),
                      decoration:
                          _boxDeco(isDark, hint: 'e.g. Chapter 5 exercises'),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Required' : null,
                      onSaved: (v) => _title = v!.trim(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _field(
                    'Description',
                    isDark,
                    child: TextFormField(
                      initialValue: _desc,
                      style: AppTypography.s14Regular(
                          color:
                              isDark ? Colors.white : AppColors.textPrimary),
                      decoration: _boxDeco(isDark,
                          hint: 'Optional notes for students'),
                      maxLines: 3,
                      onSaved: (v) => _desc = v?.trim() ?? '',
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _field(
                          'Assigned',
                          isDark,
                          child: _dateBox(
                            date: _assignedDate,
                            isDark: isDark,
                            onTap: () async {
                              final dt = await showDatePicker(
                                  context: context,
                                  initialDate: _assignedDate,
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime(2100));
                              if (dt != null) {
                                setState(() => _assignedDate = dt);
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _field(
                          'Due',
                          isDark,
                          required: true,
                          child: _dateBox(
                            date: _dueDate,
                            isDark: isDark,
                            danger: _dueDate.isBefore(DateTime.now()),
                            onTap: () async {
                              final dt = await showDatePicker(
                                  context: context,
                                  initialDate: _dueDate,
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime(2100));
                              if (dt != null) setState(() => _dueDate = dt);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (widget.hw != null) ...[
                    const SizedBox(height: 16),
                    _field(
                      'Status',
                      isDark,
                      child: _dropdown(
                        value: _status,
                        hint: 'Status',
                        isDark: isDark,
                        items: const [
                          DropdownMenuItem(
                              value: 'active', child: Text('Active')),
                          DropdownMenuItem(
                              value: 'completed', child: Text('Completed')),
                          DropdownMenuItem(
                              value: 'cancelled', child: Text('Cancelled')),
                        ],
                        onChanged: (v) =>
                            setState(() => _status = v ?? 'active'),
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),
                  _fieldLabel('Assign to', isDark),
                  const SizedBox(height: 8),
                  RadioGroup<String>(
                    groupValue: _assignedTo,
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() {
                        _assignedTo = v;
                        if (v == 'selected' &&
                            _classId.isNotEmpty &&
                            _classStudents.isEmpty) {
                          _loadStudents(_classId);
                        }
                      });
                    },
                    child: Row(
                      children: [
                        Expanded(child: _assignOption('all', 'All Students', isDark)),
                        const SizedBox(width: 10),
                        Expanded(child: _assignOption('selected', 'Selected', isDark)),
                      ],
                    ),
                  ),
                  if (_assignedTo == 'selected' && _classId.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _loadingStudents
                        ? const Center(
                            child: Padding(
                            padding: EdgeInsets.all(16),
                            child: CircularProgressIndicator(),
                          ))
                        : Container(
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.cardDark : Colors.white,
                              border: Border.all(
                                  color: isDark
                                      ? AppColors.borderDark
                                      : AppColors.borderLight),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(14, 10, 8, 6),
                                  child: Row(
                                    children: [
                                      Text(
                                        '${_selectedStudents.length} of ${_classStudents.length} selected',
                                        style: AppTypography.s12SemiBold(
                                            color: isDark
                                                ? AppColors.textMuted
                                                : AppColors.textSecondary),
                                      ),
                                      const Spacer(),
                                      GestureDetector(
                                        onTap: () => setState(() {
                                          if (_selectedStudents.length ==
                                              _classStudents.length) {
                                            _selectedStudents.clear();
                                          } else {
                                            _selectedStudents = _classStudents
                                                .map((s) => s.id)
                                                .toList();
                                          }
                                        }),
                                        child: Text(
                                          _selectedStudents.length ==
                                                  _classStudents.length
                                              ? 'Clear all'
                                              : 'Select all',
                                          style: AppTypography.s12SemiBold(
                                              color: AppColors.primary),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Divider(
                                    height: 1,
                                    color: isDark
                                        ? AppColors.borderDark
                                        : AppColors.borderLight),
                                ConstrainedBox(
                                  constraints:
                                      const BoxConstraints(maxHeight: 200),
                                  child: ListView(
                                    shrinkWrap: true,
                                    padding: EdgeInsets.zero,
                                    children: _classStudents.map((s) {
                                      final sel =
                                          _selectedStudents.contains(s.id);
                                      return CheckboxListTile(
                                        dense: true,
                                        controlAffinity:
                                            ListTileControlAffinity.leading,
                                        activeColor: AppColors.primary,
                                        title: Text(s.name,
                                            style: AppTypography.s13Medium(
                                                color: isDark
                                                    ? Colors.white
                                                    : AppColors.textPrimary)),
                                        subtitle: s.admissionNumber != null
                                            ? Text(s.admissionNumber!,
                                                style: AppTypography.s11Regular(
                                                    color: AppColors.textMuted))
                                            : null,
                                        value: sel,
                                        onChanged: (val) {
                                          setState(() {
                                            if (val == true) {
                                              _selectedStudents.add(s.id);
                                            } else {
                                              _selectedStudents.remove(s.id);
                                            }
                                          });
                                        },
                                      );
                                    }).toList(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                  ],
                ],
              ),
            ),
          ),
          // Save bar
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                border: Border(
                    top: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: p.isSaving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: p.isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : Text(widget.hw != null ? 'Save Changes' : 'Create Homework',
                          style: AppTypography.s15Bold(color: Colors.white)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text, bool isDark, {bool required = false}) => Row(
        children: [
          Text(text,
              style: AppTypography.s12SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary)),
          if (required)
            Text(' *', style: AppTypography.s12SemiBold(color: AppColors.error)),
        ],
      );

  Widget _field(String label, bool isDark,
      {bool required = false, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel(label, isDark, required: required),
        const SizedBox(height: 6),
        child,
      ],
    );
  }

  Widget _dropdown({
    required String? value,
    required String hint,
    required bool isDark,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    // Guard: only pre-select if the value exists in items, otherwise the
    // DropdownButtonFormField assertion fails and the form won't build.
    final safeValue =
        (value != null && items.any((it) => it.value == value)) ? value : null;
    return DropdownButtonFormField<String>(
      initialValue: safeValue,
      isExpanded: true,
      icon: Icon(Icons.keyboard_arrow_down_rounded,
          color: isDark ? AppColors.textMuted : AppColors.textSecondary),
      hint: Text(hint,
          style: AppTypography.s14Regular(color: AppColors.textMuted)),
      style: AppTypography.s14Regular(
          color: isDark ? Colors.white : AppColors.textPrimary),
      dropdownColor: isDark ? AppColors.cardDark : Colors.white,
      decoration: _boxDeco(isDark),
      items: items,
      onChanged: onChanged,
    );
  }

  Widget _assignOption(String value, String label, bool isDark) {
    final selected = _assignedTo == value;
    return GestureDetector(
      onTap: () {
        setState(() {
          _assignedTo = value;
          if (value == 'selected' &&
              _classId.isNotEmpty &&
              _classStudents.isEmpty) {
            _loadStudents(_classId);
          }
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withValues(alpha: 0.1)
              : (isDark ? AppColors.cardDark : Colors.white),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: selected
                  ? AppColors.primary
                  : (isDark ? AppColors.borderDark : AppColors.borderLight),
              width: selected ? 1.5 : 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              size: 16,
              color: selected
                  ? AppColors.primary
                  : (isDark ? AppColors.textMuted : AppColors.textSecondary),
            ),
            const SizedBox(width: 8),
            Text(label,
                style: AppTypography.s13SemiBold(
                    color: selected
                        ? AppColors.primary
                        : (isDark ? Colors.white : AppColors.textPrimary))),
          ],
        ),
      ),
    );
  }

  Widget _dateBox({
    required DateTime date,
    required bool isDark,
    required VoidCallback onTap,
    bool danger = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 50,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: danger
                  ? AppColors.error.withValues(alpha: 0.5)
                  : (isDark ? AppColors.borderDark : AppColors.borderLight)),
        ),
        child: Row(
          children: [
            Icon(Icons.calendar_today,
                size: 15,
                color: danger ? AppColors.error : AppColors.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                DateFormat('dd MMM yyyy').format(date),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.s14Medium(
                    color: danger
                        ? AppColors.error
                        : (isDark ? Colors.white : AppColors.textPrimary)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _boxDeco(bool isDark, {String? hint}) {
    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c, width: w),
        );
    final line = isDark ? AppColors.borderDark : AppColors.borderLight;
    return InputDecoration(
      hintText: hint,
      hintStyle: AppTypography.s14Regular(color: AppColors.textMuted),
      border: border(line),
      enabledBorder: border(line),
      focusedBorder: border(AppColors.primary, 1.5),
      errorBorder: border(AppColors.error),
      focusedErrorBorder: border(AppColors.error, 1.5),
      filled: true,
      fillColor: isDark ? AppColors.cardDark : Colors.white,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    );
  }
}
