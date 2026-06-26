import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/exams/presentation/widgets/exam_result_card.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';

class ParentChildrenScreen extends StatefulWidget {
  const ParentChildrenScreen({super.key});
  @override
  State<ParentChildrenScreen> createState() => _ParentChildrenScreenState();
}

class _ParentChildrenScreenState extends State<ParentChildrenScreen> {
  int _selectedChildIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pp = context.read<ParentDataProvider>();
      if (pp.children.isEmpty && !pp.loading) pp.fetchChildren();
    });
  }

  @override
  Widget build(BuildContext context) {
    final pp = context.watch<ParentDataProvider>();
    final perms = context.watch<SchoolPermissionsProvider>();

    if (pp.loading) return const SkeletonList();
    if (pp.children.isEmpty) {
      return Center(
        child: Text('No children linked to this account',
            style: GoogleFonts.inter(color: AppColors.textMuted)),
      );
    }

    final child = pp.children[_selectedChildIndex];

    return Column(
      children: [
        if (pp.children.length > 1)
          _ChildSelector(
            children: pp.children,
            selectedIndex: _selectedChildIndex,
            onSelect: (i) => setState(() => _selectedChildIndex = i),
          ),
        Expanded(
          child: _ChildDetailView(child: child, perms: perms),
        ),
      ],
    );
  }
}

class _ChildSelector extends StatelessWidget {
  final List<ChildInfo> children;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  const _ChildSelector({
    required this.children,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: List.generate(children.length, (i) {
          final sel = i == selectedIndex;
          return GestureDetector(
            onTap: () => onSelect(i),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: sel ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: sel ? AppColors.primary : AppColors.borderLight),
              ),
              child: Text(
                children[i].name,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: sel ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _ChildDetailView extends StatefulWidget {
  final ChildInfo child;
  final SchoolPermissionsProvider perms;
  const _ChildDetailView({required this.child, required this.perms});

  @override
  State<_ChildDetailView> createState() => _ChildDetailViewState();
}

class _ChildDetailViewState extends State<_ChildDetailView>
    with TickerProviderStateMixin {
  late TabController _tab;
  final List<String> _tabLabels = [];

  @override
  void initState() {
    super.initState();
    _buildTabs();
  }

  @override
  void didUpdateWidget(_ChildDetailView old) {
    super.didUpdateWidget(old);
    if (old.child.id != widget.child.id || old.perms != widget.perms) {
      _tab.dispose();
      _buildTabs();
    }
  }

  void _buildTabs() {
    _tabLabels.clear();
    _tabLabels.add('Info');
    if (widget.perms.parentCan('viewAttendance')) _tabLabels.add('Attendance');
    if (widget.perms.parentCan('viewHomework')) _tabLabels.add('Homework');
    if (widget.perms.parentCan('viewExams')) _tabLabels.add('Exams');
    if (widget.perms.parentCan('viewFees')) _tabLabels.add('Fees');
    _tab = TabController(length: _tabLabels.length, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tab,
          isScrollable: true,
          tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
        ),
        Expanded(
          child: TabBarView(
            controller: _tab,
            children: _tabLabels.map((label) {
              switch (label) {
                case 'Info':
                  return _InfoTab(child: widget.child);
                case 'Attendance':
                  return _AttendanceTab(childId: widget.child.id);
                case 'Homework':
                  return _HomeworkTab(classId: widget.child.classId ?? '');
                case 'Exams':
                  return _ExamsTab(
                      classId: widget.child.classId ?? '',
                      studentId: widget.child.id);
                case 'Fees':
                  return _FeesTab(studentId: widget.child.id);
                default:
                  return const SizedBox();
              }
            }).toList(),
          ),
        ),
      ],
    );
  }
}

// ─── Info Tab ───────────────────────────────────────────────────────────────

class _InfoTab extends StatelessWidget {
  final ChildInfo child;
  const _InfoTab({required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        child: Column(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              child: Text(
                child.initial,
                style: GoogleFonts.inter(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary),
              ),
            ),
            const SizedBox(height: 12),
            Text(child.name,
                style: GoogleFonts.inter(
                    fontSize: 17, fontWeight: FontWeight.w700)),
            Text(child.classLabel,
                style: GoogleFonts.inter(
                    fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(height: 16),
            _infoRow('Admission No.', child.admissionNumber),
            if (child.bloodGroup != null)
              _infoRow('Blood Group', child.bloodGroup!),
            if (child.phone != null) _infoRow('Phone', child.phone!),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            SizedBox(
              width: 120,
              child: Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 13, color: AppColors.textMuted)),
            ),
            Expanded(
                child: Text(value,
                    style: GoogleFonts.inter(
                        fontSize: 13, fontWeight: FontWeight.w500))),
          ],
        ),
      );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────

class _AttendanceTab extends StatefulWidget {
  final String childId;
  const _AttendanceTab({required this.childId});
  @override
  State<_AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<_AttendanceTab> {
  List<dynamic> _records = [];
  bool _loading = true;
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/attendance', params: {
        'studentId': widget.childId,
        'month': _month.month.toString(),
        'year': _month.year.toString(),
      });
      setState(() {
        _records = res.data['attendance'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() => _month = DateTime(_month.year, _month.month + delta));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final Map<int, String> dayStatus = {};
    for (final r in _records) {
      try {
        final d = DateTime.parse(r['date'].toString());
        dayStatus[d.day] = r['status'] as String? ?? 'P';
      } catch (_) {}
    }

    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final firstWeekday = DateTime(_month.year, _month.month, 1).weekday;
    final present = dayStatus.values.where((s) => s == 'P').length;
    final absent = dayStatus.values.where((s) => s == 'A').length;
    final leave = dayStatus.values.where((s) => s == 'L').length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                  onPressed: () => _changeMonth(-1),
                  icon: const Icon(Icons.chevron_left)),
              Text(
                '${_monthName(_month.month)} ${_month.year}',
                style: GoogleFonts.inter(
                    fontSize: 15, fontWeight: FontWeight.w600),
              ),
              IconButton(
                  onPressed: () => _changeMonth(1),
                  icon: const Icon(Icons.chevron_right)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              _statChip('P $present', AppColors.accentGreen),
              const SizedBox(width: 8),
              _statChip('A $absent', AppColors.accentRed),
              const SizedBox(width: 8),
              _statChip('L $leave', AppColors.warning),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Expanded(child: SkeletonList())
        else
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: RefreshIndicator(
                onRefresh: _load,
                child: GridView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                ),
                itemCount: daysInMonth + (firstWeekday - 1),
                itemBuilder: (_, i) {
                  if (i < firstWeekday - 1) return const SizedBox();
                  final day = i - (firstWeekday - 2);
                  final status = dayStatus[day];
                  final color = status == 'P'
                      ? AppColors.accentGreen
                      : status == 'A'
                          ? AppColors.accentRed
                          : status == 'L'
                              ? AppColors.warning
                              : null;
                  return Container(
                    decoration: BoxDecoration(
                      color: color != null
                          ? color.withValues(alpha: 0.15)
                          : (isDark ? AppColors.cardDark : Colors.white),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: color ??
                            (isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        '$day',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: color ?? AppColors.textSecondary,
                        ),
                      ),
                    ),
                  );
                },
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _statChip(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label,
            style: GoogleFonts.inter(
                fontSize: 12, color: color, fontWeight: FontWeight.w600)),
      );

  String _monthName(int m) => const [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m];
}

// ─── Homework Tab ────────────────────────────────────────────────────────────

class _HomeworkTab extends StatefulWidget {
  final String classId;
  const _HomeworkTab({required this.classId});
  @override
  State<_HomeworkTab> createState() => _HomeworkTabState();
}

class _HomeworkTabState extends State<_HomeworkTab> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.classId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    try {
      final res =
          await ApiClient.get('/homework', params: {'classId': widget.classId});
      setState(() {
        _items = res.data['homework'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SkeletonList(showLeading: false);
    if (_items.isEmpty) {
      return Center(
          child: Text('No homework',
              style: GoogleFonts.inter(color: AppColors.textMuted)));
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _items.length,
      itemBuilder: (_, i) {
        final h = _items[i];
        final due = _fmtDate(h['dueDate']);
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(h['title'] ?? 'Homework',
                  style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w600)),
              if (h['subject']?['name'] != null)
                Text(h['subject']['name'],
                    style: GoogleFonts.inter(
                        fontSize: 12, color: AppColors.primary)),
              if (due.isNotEmpty)
                Text('Due: $due',
                    style: GoogleFonts.inter(
                        fontSize: 12, color: AppColors.textMuted)),
            ],
          ),
        );
      },
      ),
    );
  }

  String _fmtDate(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString());
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return d?.toString() ?? '';
    }
  }
}

// ─── Exams Tab ───────────────────────────────────────────────────────────────

class _ExamsTab extends StatefulWidget {
  final String classId;
  final String studentId;
  const _ExamsTab({required this.classId, required this.studentId});
  @override
  State<_ExamsTab> createState() => _ExamsTabState();
}

class _ExamsTabState extends State<_ExamsTab> {
  List<dynamic> _exams = [];
  bool _loading = true;
  bool _opening = false; // reentrancy guard while a result is being fetched

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.classId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    try {
      final res =
          await ApiClient.get('/exams', params: {'classId': widget.classId});
      setState(() {
        _exams = res.data['exams'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  // Fetch this child's published result for the exam and show it in a sheet.
  Future<void> _openResult(String examId) async {
    if (_opening) return;
    _opening = true;
    try {
      final res = await ApiClient.get('/exams/results',
          params: {'examId': examId, 'studentId': widget.studentId});
      final results = res.data['results'] as List<dynamic>? ?? [];
      if (!mounted) return;
      if (results.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Marks are not available for this student yet.')));
        return;
      }
      await showExamResultSheet(context,
          result: Map<String, dynamic>.from(results.first as Map));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e))));
    } finally {
      _opening = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SkeletonList(showLeading: false);
    if (_exams.isEmpty) {
      return Center(
          child: Text('No exams',
              style: GoogleFonts.inter(color: AppColors.textMuted)));
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _exams.length,
      itemBuilder: (_, i) {
        final e = _exams[i];
        final examId = e['_id']?.toString() ?? '';
        final isPublished = e['isResultPublished'] as bool? ?? false;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: isPublished ? () => _openResult(examId) : null,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e['name'] ?? 'Exam',
                            style: GoogleFonts.inter(
                                fontSize: 14, fontWeight: FontWeight.w600)),
                        Text(_fmtDate(e['examDate'] ?? e['date']),
                            style: GoogleFonts.inter(
                                fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (isPublished
                              ? AppColors.accentGreen
                              : AppColors.warning)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isPublished ? 'Results Out' : 'Scheduled',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isPublished
                            ? AppColors.accentGreen
                            : AppColors.warning,
                      ),
                    ),
                  ),
                  if (isPublished) ...[
                    const SizedBox(width: 6),
                    Icon(Icons.chevron_right,
                        size: 20, color: AppColors.textMuted),
                  ],
                ],
              ),
            ),
          ),
        );
      },
      ),
    );
  }

  String _fmtDate(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString());
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return d?.toString() ?? '';
    }
  }
}

// ─── Fees Tab ────────────────────────────────────────────────────────────────

class _FeesTab extends StatefulWidget {
  final String studentId;
  const _FeesTab({required this.studentId});
  @override
  State<_FeesTab> createState() => _FeesTabState();
}

class _FeesTabState extends State<_FeesTab> {
  List<dynamic> _fees = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res =
          await ApiClient.get('/fees', params: {'studentId': widget.studentId});
      setState(() {
        _fees = res.data['fees'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SkeletonList(showLeading: false);
    if (_fees.isEmpty) {
      return Center(
          child: Text('No fee records',
              style: GoogleFonts.inter(color: AppColors.textMuted)));
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    int totalDue = 0, totalPaid = 0;
    for (final f in _fees) {
      totalDue += (f['netAmount'] as num? ?? 0).toInt();
      totalPaid += (f['paidAmount'] as num? ?? 0).toInt();
    }
    final pending = totalDue - totalPaid;

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              _summaryCard('Total', '₹$totalDue', AppColors.textPrimary),
              const SizedBox(width: 12),
              _summaryCard('Paid', '₹$totalPaid', AppColors.accentGreen),
              const SizedBox(width: 12),
              _summaryCard('Pending', '₹$pending',
                  pending > 0 ? AppColors.accentRed : AppColors.accentGreen),
            ],
          ),
          const SizedBox(height: 16),
          ...List.generate(_fees.length, (i) {
            final f = _fees[i];
            final status = f['status'] as String? ?? '';
            final sColor = _statusColor(status);
            final net = (f['netAmount'] as num? ?? 0).toInt();
            final paid = (f['paidAmount'] as num? ?? 0).toInt();
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(f['feeType']?['name'] ?? f['description'] ?? 'Fee',
                            style: GoogleFonts.inter(
                                fontSize: 14, fontWeight: FontWeight.w600)),
                        Text('₹$paid / ₹$net',
                            style: GoogleFonts.inter(
                                fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: sColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      status.isEmpty
                          ? ''
                          : status[0].toUpperCase() + status.substring(1),
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          color: sColor,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
      ),
    );
  }

  Widget _summaryCard(String label, String val, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.07),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(children: [
            Text(val,
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w700, color: color)),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 11, color: AppColors.textMuted)),
          ]),
        ),
      );

  Color _statusColor(String s) {
    switch (s) {
      case 'paid':
        return AppColors.accentGreen;
      case 'partial':
        return AppColors.warning;
      case 'overdue':
        return AppColors.accentRed;
      default:
        return AppColors.textMuted;
    }
  }
}
