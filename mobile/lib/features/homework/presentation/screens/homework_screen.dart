import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../../../../core/models/homework.dart';
import '../../../../core/models/student.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../providers/homework_provider.dart';

class HomeworkScreen extends StatelessWidget {
  const HomeworkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) {
        final provider = HomeworkProvider();
        provider.fetchProfile().then((_) {
          provider.fetchHomework(); // load all homework, no date filter
        });
        return provider;
      },
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

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppColors.error : AppColors.success,
    ));
  }

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
  String _dateFilter = DateTime.now().toIso8601String().split('T')[0];
  String _statusFilter = '';

  Color _hexToColor(String? hex) {
    if (hex == null || hex.isEmpty) return Colors.grey;
    final buffer = StringBuffer();
    if (hex.length == 6 || hex.length == 7) buffer.write('ff');
    buffer.write(hex.replaceFirst('#', ''));
    return Color(int.parse(buffer.toString(), radix: 16));
  }

  void _applyFilters() {
    context.read<HomeworkProvider>().fetchHomework(
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
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => ChangeNotifierProvider.value(
                    value: provider,
                    child: const _AddEditSheet(),
                  ),
                ).then((_) => _applyFilters());
              },
              backgroundColor: AppColors.primary,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
      body: Column(
        children: [
          // Stats
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(child: _StatCard(title: 'Total', value: allHw.length, color: AppColors.primary, bg: AppColors.primary.withValues(alpha: 0.1), isDark: isDark)),
                const SizedBox(width: 8),
                Expanded(child: _StatCard(title: 'Active', value: activeCount, color: AppColors.success, bg: AppColors.success.withValues(alpha: 0.1), isDark: isDark)),
                const SizedBox(width: 8),
                Expanded(child: _StatCard(title: 'Due Today', value: dueTodayCount, color: AppColors.warning, bg: AppColors.warning.withValues(alpha: 0.1), isDark: isDark)),
              ],
            ),
          ),
          
          // Filters
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: GestureDetector(
                    onTap: () async {
                      final dt = await showDatePicker(
                        context: context,
                        initialDate: DateTime.parse(_dateFilter),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2100),
                      );
                      if (dt != null) {
                        setState(() => _dateFilter = dt.toIso8601String().split('T')[0]);
                        _applyFilters();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.cardDark : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_today, size: 16, color: isDark ? AppColors.textMuted : AppColors.textSecondary),
                          const SizedBox(width: 8),
                          Text(DateFormat('dd MMM yyyy').format(DateTime.parse(_dateFilter)), style: AppTypography.s12Medium(color: isDark ? Colors.white : AppColors.textPrimary)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.cardDark : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _statusFilter,
                        isExpanded: true,
                        dropdownColor: isDark ? AppColors.cardDark : Colors.white,
                        style: AppTypography.s12Medium(color: isDark ? Colors.white : AppColors.textPrimary),
                        items: const [
                          DropdownMenuItem(value: '', child: Text('All Status')),
                          DropdownMenuItem(value: 'active', child: Text('Active')),
                          DropdownMenuItem(value: 'completed', child: Text('Completed')),
                          DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                        ],
                        onChanged: (v) {
                          if (v != null) {
                            setState(() => _statusFilter = v);
                            _applyFilters();
                          }
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Class Tabs
          Container(
            height: 48,
            margin: const EdgeInsets.only(top: 12, bottom: 4),
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _ClassTab(
                  label: 'All Classes',
                  isActive: _activeClass == 'all',
                  onTap: () {
                    setState(() => _activeClass = 'all');
                    _applyFilters();
                  },
                ),
                ...provider.classes.map((c) => _ClassTab(
                  label: c.fullName,
                  isActive: _activeClass == c.id,
                  onTap: () {
                    setState(() => _activeClass = c.id);
                    _applyFilters();
                  },
                )),
              ],
            ),
          ),
          
          // List
          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
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
                    ? Center(child: Text('No homework matches filters', style: AppTypography.s14Regular(color: AppColors.textMuted)))
                    : ListView.separated(
                        padding: const EdgeInsets.all(16).copyWith(bottom: 80),
                        itemCount: allHw.length,
                        separatorBuilder: (c, i) => const SizedBox(height: 12),
                        itemBuilder: (c, i) {
                          final hw = allHw[i];
                          final isOverdue = hw.dueDate != null && DateTime.parse(hw.dueDate!).isBefore(DateTime.now()) && hw.status == 'active';
                          
                          return GestureDetector(
                            onTap: () => widget.onViewDetail(hw.id),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: isDark ? AppColors.cardDark : Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                                boxShadow: isDark ? [] : AppColors.shadowSm,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(hw.title, style: AppTypography.s16Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
                                            if (hw.description?.isNotEmpty == true) ...[
                                              const SizedBox(height: 4),
                                              Text(hw.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppTypography.s12Regular(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                                            ]
                                          ],
                                        ),
                                      ),
                                      _StatusBadge(status: hw.status),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      if (hw.subject != null)
                                        Row(
                                          children: [
                                            Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: _hexToColor(hw.subject!.color))),
                                            const SizedBox(width: 6),
                                            Text(hw.subject!.name, style: AppTypography.s12Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                                          ],
                                        ),
                                      Text(hw.classRef?.fullName ?? '', style: AppTypography.s12Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
                                    ],
                                  ),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 10),
                                    child: Divider(height: 1),
                                  ),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('Assigned', style: AppTypography.s10Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                                          Text(hw.assignedDate != null ? DateFormat('dd MMM').format(DateTime.parse(hw.assignedDate!)) : '—', style: AppTypography.s12Medium(color: isDark ? Colors.white : AppColors.textPrimary)),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('Due', style: AppTypography.s10Medium(color: isOverdue ? AppColors.error : (isDark ? AppColors.textMuted : AppColors.textSecondary))),
                                          Text(hw.dueDate != null ? DateFormat('dd MMM').format(DateTime.parse(hw.dueDate!)) : '—', style: AppTypography.s12Bold(color: isOverdue ? AppColors.error : (isDark ? Colors.white : AppColors.textPrimary))),
                                        ],
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(color: AppColors.info.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
                                        child: Text(hw.assignedTo == 'all' ? 'All Students' : '${hw.students.length} Students', style: AppTypography.s10Medium(color: AppColors.info)),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final int value;
  final Color color;
  final Color bg;
  final bool isDark;

  const _StatCard({required this.title, required this.value, required this.color, required this.bg, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Text(value.toString(), style: AppTypography.s16Bold(color: color)),
          ),
          const SizedBox(height: 6),
          Text(title, style: AppTypography.s10Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary), textAlign: TextAlign.center, maxLines: 1),
        ],
      ),
    );
  }
}

class _ClassTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _ClassTab({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary : (isDark ? AppColors.cardDark : Colors.white),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isActive ? AppColors.primary : (isDark ? AppColors.borderDark : AppColors.borderLight)),
        ),
        child: Text(label, style: AppTypography.s12Medium(color: isActive ? Colors.white : (isDark ? AppColors.textMuted : AppColors.textSecondary))),
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
    _loadData();
  }

  Future<void> _loadData() async {
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
    if (allOk) _showSnack('Statuses updated!');
    else _showSnack('Some updates failed', isError: true);
    
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

  Widget _inlineHeader(BuildContext context, HomeworkProvider p, bool isDark) {
    return Container(
      color: isDark ? AppColors.cardDark : Colors.white,
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back,
                color: isDark ? Colors.white : AppColors.textPrimary),
            onPressed: widget.onBack,
          ),
          Expanded(
            child: Text('Homework Details',
                style: AppTypography.s16Bold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          if (p.canManage) ...[
            IconButton(
              icon: Icon(Icons.notifications_active, color: AppColors.warning),
              onPressed: () async {
                final ok = await p.notifyParents(widget.hwId);
                _showSnack(
                    ok ? 'Parents notified' : 'Failed to notify',
                    isError: !ok);
              },
            ),
            IconButton(
              icon: Icon(Icons.edit,
                  color: isDark ? Colors.white : AppColors.textPrimary),
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => ChangeNotifierProvider.value(
                    value: p,
                    child: _AddEditSheet(hw: _hw),
                  ),
                ).then((_) => _loadData());
              },
            ),
            IconButton(
              icon: Icon(Icons.delete, color: AppColors.error),
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: const Text('Delete Homework?'),
                    content: const Text(
                        'Are you sure you want to delete this homework?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(c, false),
                          child: const Text('Cancel')),
                      TextButton(
                          onPressed: () => Navigator.pop(c, true),
                          child: const Text('Delete',
                              style: TextStyle(color: Colors.red))),
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
              },
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final p = context.watch<HomeworkProvider>();

    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_hw == null) {
      return Scaffold(
        body: Column(
          children: [
            _inlineHeader(context, p, isDark),
            const Expanded(child: Center(child: Text('Homework not found'))),
          ],
        ),
      );
    }

    final isOverdue = _hw!.dueDate != null && DateTime.parse(_hw!.dueDate!).isBefore(DateTime.now()) && _hw!.status == 'active';
    
    int completedCount = 0;
    int inProgressCount = 0;
    for (var s in _students) {
      final st = _getSubStatus(s.id);
      if (st == 'completed') completedCount++;
      if (st == 'in_progress') inProgressCount++;
    }
    int pendingCount = _students.length - completedCount - inProgressCount;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          _inlineHeader(context, p, isDark),
          // Header Info Card
          Container(
            padding: const EdgeInsets.all(20),
            color: isDark ? AppColors.cardDark : Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_hw!.title, style: AppTypography.s20Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _StatusBadge(status: _hw!.status),
                    const SizedBox(width: 8),
                    Text(_hw!.classRef?.fullName ?? '', style: AppTypography.s14Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                    if (_hw!.subject != null) ...[
                      const SizedBox(width: 8),
                      Text('•', style: AppTypography.s14Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                      const SizedBox(width: 8),
                      Text(_hw!.subject!.name, style: AppTypography.s14Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                    ]
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: isDark ? AppColors.bgDark : AppColors.bgLight, borderRadius: BorderRadius.circular(8)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('ASSIGNED', style: AppTypography.s10Bold(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                            const SizedBox(height: 4),
                            Text(_hw!.assignedDate != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(_hw!.assignedDate!)) : '—', style: AppTypography.s14Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isOverdue ? AppColors.badgeDangerBg : (isDark ? AppColors.bgDark : AppColors.bgLight), 
                          borderRadius: BorderRadius.circular(8),
                          border: isOverdue ? Border.all(color: AppColors.error.withValues(alpha: 0.3)) : null,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('DUE${isOverdue ? ' · OVERDUE' : ''}', style: AppTypography.s10Bold(color: isOverdue ? AppColors.error : (isDark ? AppColors.textMuted : AppColors.textSecondary))),
                            const SizedBox(height: 4),
                            Text(_hw!.dueDate != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(_hw!.dueDate!)) : '—', style: AppTypography.s14Bold(color: isOverdue ? AppColors.error : (isDark ? Colors.white : AppColors.textPrimary))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                if (_hw!.description?.isNotEmpty == true) ...[
                  const SizedBox(height: 16),
                  Text('DESCRIPTION', style: AppTypography.s10Bold(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text(_hw!.description!, style: AppTypography.s14Regular(color: isDark ? Colors.white : AppColors.textPrimary)),
                ]
              ],
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Students List
          Expanded(
            child: Container(
              color: isDark ? AppColors.cardDark : Colors.white,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Students (${_students.length})', style: AppTypography.s16Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
                        if (p.canManage && _students.isNotEmpty)
                          _editMode 
                            ? Row(
                                children: [
                                  TextButton(onPressed: () => setState(() => _editMode = false), child: const Text('Cancel')),
                                  ElevatedButton(
                                    onPressed: _saveStatuses, 
                                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, minimumSize: const Size(0, 36)),
                                    child: const Text('Save'),
                                  )
                                ],
                              )
                            : TextButton.icon(
                                onPressed: () {
                                  Map<String, String> initMap = {};
                                  for (var s in _students) {
                                    initMap[s.id] = _getSubStatus(s.id);
                                  }
                                  setState(() {
                                    _localStatuses = initMap;
                                    _editMode = true;
                                  });
                                }, 
                                icon: const Icon(Icons.edit, size: 16), 
                                label: const Text('Edit Status')
                              ),
                      ],
                    ),
                  ),
                  if (!_editMode)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: Row(
                        children: [
                          _StatusIndicator(color: AppColors.success, label: '$completedCount Completed'),
                          const SizedBox(width: 12),
                          _StatusIndicator(color: AppColors.warning, label: '$inProgressCount In Progress'),
                          const SizedBox(width: 12),
                          _StatusIndicator(color: AppColors.error, label: '$pendingCount Pending'),
                        ],
                      ),
                    ),
                  const Divider(),
                  Expanded(
                    child: _students.isEmpty
                        ? Center(child: Text('No students assigned', style: AppTypography.s14Regular(color: AppColors.textMuted)))
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _students.length,
                            separatorBuilder: (c, i) => const Divider(),
                            itemBuilder: (c, i) {
                              final st = _students[i];
                              final sub = _submissions.firstWhere((s) => s.student?.id == st.id, orElse: () => HwSubmission(id: '', status: 'pending'));
                              final currentStatus = _editMode ? (_localStatuses[st.id] ?? 'pending') : sub.status;
                              
                              Color stColor;
                              if (currentStatus == 'completed') stColor = AppColors.success;
                              else if (currentStatus == 'in_progress') stColor = AppColors.warning;
                              else stColor = AppColors.error;

                              return Row(
                                children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: isDark ? AppColors.borderDark : AppColors.borderLight,
                                    child: Text('${i+1}', style: AppTypography.s10Bold(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(st.name, style: AppTypography.s14Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
                                        if (st.admissionNumber != null)
                                          Text(st.admissionNumber!, style: AppTypography.s10Medium(color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
                                      ],
                                    ),
                                  ),
                                  if (_editMode)
                                    Row(
                                      children: ['pending', 'in_progress', 'completed'].map((opt) {
                                        final isSel = currentStatus == opt;
                                        Color optC = opt == 'completed' ? AppColors.success : (opt == 'in_progress' ? AppColors.warning : AppColors.error);
                                        return GestureDetector(
                                          onTap: () => setState(() => _localStatuses[st.id] = opt),
                                          child: Container(
                                            margin: const EdgeInsets.only(left: 4),
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: isSel ? optC : Colors.transparent,
                                              border: Border.all(color: isSel ? optC : (isDark ? AppColors.borderDark : AppColors.borderLight)),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              opt == 'in_progress' ? 'Prog' : (opt == 'completed' ? 'Done' : 'Pend'),
                                              style: AppTypography.s10Bold(color: isSel ? Colors.white : (isDark ? AppColors.textMuted : AppColors.textSecondary)),
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
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Row(
                                        children: [
                                          Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: stColor)),
                                          const SizedBox(width: 4),
                                          Text(currentStatus.replaceAll('_', ' ').toUpperCase(), style: AppTypography.s10Bold(color: stColor)),
                                        ],
                                      ),
                                    ),
                                ],
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusIndicator extends StatelessWidget {
  final Color color;
  final String label;
  const _StatusIndicator({required this.color, required this.label});
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
        const SizedBox(width: 4),
        Text(label, style: AppTypography.s10Bold(color: color)),
      ],
    );
  }
}

// ─── Add Edit Sheet ──────────────────────────────────────────────────────────
class _AddEditSheet extends StatefulWidget {
  final Homework? hw;
  const _AddEditSheet({this.hw});

  @override
  State<_AddEditSheet> createState() => _AddEditSheetState();
}

class _AddEditSheetState extends State<_AddEditSheet> {
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
    final bottomSpace = MediaQuery.of(context).viewInsets.bottom;
    
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomSpace),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(widget.hw != null ? 'Edit Homework' : 'Add Homework', style: AppTypography.s18Bold(color: isDark ? Colors.white : AppColors.textPrimary)),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const Divider(),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                children: [
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _classId.isEmpty ? null : _classId,
                    decoration: _inputDeco('Class *', isDark),
                    items: p.classes.map((c) => DropdownMenuItem(value: c.id, child: Text(c.fullName))).toList(),
                    onChanged: (v) {
                      setState(() {
                        _classId = v ?? '';
                        if (_assignedTo == 'selected') _loadStudents(_classId);
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _subjectId,
                    decoration: _inputDeco('Subject', isDark),
                    items: p.subjects.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                    onChanged: (v) => setState(() => _subjectId = v),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: _title,
                    decoration: _inputDeco('Title *', isDark),
                    validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    onSaved: (v) => _title = v!.trim(),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: _desc,
                    decoration: _inputDeco('Description', isDark),
                    maxLines: 3,
                    onSaved: (v) => _desc = v?.trim() ?? '',
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final dt = await showDatePicker(context: context, initialDate: _assignedDate, firstDate: DateTime(2020), lastDate: DateTime(2100));
                            if (dt != null) setState(() => _assignedDate = dt);
                          },
                          child: InputDecorator(
                            decoration: _inputDeco('Assigned Date', isDark),
                            child: Text(DateFormat('yyyy-MM-dd').format(_assignedDate)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final dt = await showDatePicker(context: context, initialDate: _dueDate, firstDate: DateTime(2020), lastDate: DateTime(2100));
                            if (dt != null) setState(() => _dueDate = dt);
                          },
                          child: InputDecorator(
                            decoration: _inputDeco('Due Date *', isDark),
                            child: Text(DateFormat('yyyy-MM-dd').format(_dueDate)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (widget.hw != null) ...[
                    DropdownButtonFormField<String>(
                      value: _status,
                      decoration: _inputDeco('Status', isDark),
                      items: const [
                        DropdownMenuItem(value: 'active', child: Text('Active')),
                        DropdownMenuItem(value: 'completed', child: Text('Completed')),
                        DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                      ],
                      onChanged: (v) => setState(() => _status = v!),
                    ),
                    const SizedBox(height: 16),
                  ],
                  
                  Text('Assign To', style: AppTypography.s14Medium(color: isDark ? Colors.white : AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('All Students'),
                          value: 'all',
                          groupValue: _assignedTo,
                          onChanged: (v) => setState(() => _assignedTo = v!),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('Selected'),
                          value: 'selected',
                          groupValue: _assignedTo,
                          onChanged: (v) {
                            setState(() {
                              _assignedTo = v!;
                              if (_classId.isNotEmpty && _classStudents.isEmpty) _loadStudents(_classId);
                            });
                          },
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ],
                  ),
                  
                  if (_assignedTo == 'selected' && _classId.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _loadingStudents 
                      ? const Center(child: CircularProgressIndicator())
                      : Container(
                          height: 150,
                          decoration: BoxDecoration(
                            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: ListView(
                            children: _classStudents.map((s) {
                              return CheckboxListTile(
                                title: Text(s.name, style: AppTypography.s12Medium(color: isDark ? Colors.white : AppColors.textPrimary)),
                                subtitle: s.admissionNumber != null ? Text(s.admissionNumber!) : null,
                                value: _selectedStudents.contains(s.id),
                                onChanged: (val) {
                                  setState(() {
                                    if (val == true) _selectedStudents.add(s.id);
                                    else _selectedStudents.remove(s.id);
                                  });
                                },
                              );
                            }).toList(),
                          ),
                        )
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: p.isSaving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: p.isSaving 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Save Homework', style: AppTypography.s16Bold(color: Colors.white)),
            ),
          )
        ],
      ),
    );
  }

  InputDecoration _inputDeco(String label, bool isDark) {
    return InputDecoration(
      labelText: label,
      labelStyle: AppTypography.s12Regular(color: isDark ? AppColors.textMuted : AppColors.textSecondary),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight)),
      filled: true,
      fillColor: isDark ? AppColors.bgDark : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );
  }
}
