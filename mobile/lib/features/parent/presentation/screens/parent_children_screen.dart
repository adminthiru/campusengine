import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/exams/presentation/widgets/exam_result_card.dart';
import 'package:skl_teacher/features/homework/presentation/widgets/homework_submission_sheet.dart';
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
                  return _HomeworkTab(studentId: widget.child.id);
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

  static String _str(dynamic v) => (v is String) ? v : (v == null ? '' : '$v');

  static String _cap(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

  static String _fmtDate(dynamic v) {
    try {
      final dt = DateTime.parse(v.toString()).toLocal();
      const m = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day} ${m[dt.month]} ${dt.year}';
    } catch (_) {
      return _str(v);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final s = child.raw;

    final guardians = (s['guardians'] is List) ? s['guardians'] as List : const [];
    final primaryG = (s['primaryGuardian'] is Map)
        ? s['primaryGuardian'] as Map
        : (guardians.isNotEmpty && guardians.first is Map
            ? guardians.first as Map
            : null);
    final primaryId = primaryG?['_id']?.toString();

    final addr = s['address'] is Map ? s['address'] as Map : const {};
    final addrLine = [addr['street'], addr['city'], addr['state'], addr['pincode']]
        .where((v) => v != null && v.toString().trim().isNotEmpty)
        .join(', ');

    final transport = s['transportRoute'] is Map ? s['transportRoute'] as Map : null;
    final busStop =
        (s['busStop'] is String) ? (s['busStop'] as String).trim() : '';
    final driver = transport != null ? _str(transport['driverName']).trim() : '';
    final driverPhone =
        transport != null ? _str(transport['driverPhone']).trim() : '';
    final conductor =
        transport != null ? _str(transport['conductorName']).trim() : '';
    final conductorPhone =
        transport != null ? _str(transport['conductorPhone']).trim() : '';
    final busLabel = transport == null
        ? ''
        : [
            if (_str(transport['routeNumber']).trim().isNotEmpty)
              '#${_str(transport['routeNumber']).trim()}',
            if (_str(transport['vehicleNumber']).trim().isNotEmpty)
              _str(transport['vehicleNumber']).trim(),
            if (_str(transport['routeName']).trim().isNotEmpty)
              _str(transport['routeName']).trim(),
          ].join(' · ');

    final med = s['medicalInfo'] is Map ? s['medicalInfo'] as Map : const {};
    final conditions = (med['conditions'] is List)
        ? (med['conditions'] as List)
            .where((c) => c != null && c.toString().trim().isNotEmpty)
            .map((c) => c.toString())
            .toList()
        : <String>[];

    final bg = <String, String>{};
    void addBg(String k, dynamic v) {
      if (v != null && v.toString().trim().isNotEmpty) bg[k] = v.toString();
    }
    addBg('Nationality', s['nationality']);
    addBg('Religion', s['religion']);
    addBg('Mother Tongue', s['motherTongue']);
    addBg('Caste', s['caste']);
    addBg('Category', s['category'] is String ? _cap(s['category']) : null);
    addBg('Previous School', s['previousSchool']);
    addBg('Identification Mark', s['identificationMark']);

    return RefreshIndicator(
      onRefresh: () => context.read<ParentDataProvider>().fetchChildren(),
      child: SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _profileHeader(isDark, s),
        const SizedBox(height: 18),

        _section('Academic Details'),
        _card(isDark, [
          _row('Admission No.', child.admissionNumber, isDark),
          if (_str(s['rollNumber']).isNotEmpty)
            _row('Roll Number', _str(s['rollNumber']), isDark),
          _row('Class', child.classLabel, isDark),
          if (s['admissionDate'] != null)
            _row('Admission Date', _fmtDate(s['admissionDate']), isDark),
          if (_str(s['academicYear']).isNotEmpty)
            _row('Academic Year', _str(s['academicYear']), isDark),
        ]),
        const SizedBox(height: 16),

        _section('Personal Details'),
        _card(isDark, [
          if (_str(s['gender']).isNotEmpty)
            _row('Gender', _cap(_str(s['gender'])), isDark),
          if (s['dateOfBirth'] != null)
            _row('Date of Birth', _fmtDate(s['dateOfBirth']), isDark),
          if (_str(s['bloodGroup']).isNotEmpty)
            _row('Blood Group', _str(s['bloodGroup']), isDark),
          if (_str(s['aadharNumber']).isNotEmpty)
            _row('Aadhar No.', _str(s['aadharNumber']), isDark),
          if (_str(s['phone']).isNotEmpty) _row('Phone', _str(s['phone']), isDark),
          if (_str(s['alternativeMobile']).isNotEmpty)
            _row('Alt. Mobile', _str(s['alternativeMobile']), isDark),
          if (_str(s['email']).isNotEmpty) _row('Email', _str(s['email']), isDark),
          if (s['isHosteller'] == true) _row('Hosteller', 'Yes', isDark),
        ]),
        const SizedBox(height: 16),

        if (transport != null || busStop.isNotEmpty) ...[
          _section('Transport'),
          _card(isDark, [
            if (busLabel.isNotEmpty) _row('Bus Assigned', busLabel, isDark),
            if (busStop.isNotEmpty) _row('Bus Stop', busStop, isDark),
            if (driver.isNotEmpty)
              _row('Driver',
                  driverPhone.isNotEmpty ? '$driver · $driverPhone' : driver,
                  isDark),
            if (conductor.isNotEmpty)
              _row(
                  'Conductor',
                  conductorPhone.isNotEmpty
                      ? '$conductor · $conductorPhone'
                      : conductor,
                  isDark),
          ]),
          const SizedBox(height: 16),
        ],

        if (primaryG != null) ...[
          _section('Primary Guardian'),
          _guardianCard(primaryG, true, isDark),
          const SizedBox(height: 16),
        ],

        if (guardians.length > 1) ...[
          _section('Parents / Guardians'),
          ...guardians.whereType<Map>().map((g) => _guardianCard(
              g, primaryId != null && g['_id']?.toString() == primaryId, isDark)),
          const SizedBox(height: 16),
        ],

        if (addrLine.isNotEmpty) ...[
          _section('Address'),
          _card(isDark, [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.location_on_outlined,
                    size: 16, color: AppColors.textMuted),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(addrLine,
                        style: GoogleFonts.inter(
                            fontSize: 13,
                            color: isDark
                                ? Colors.white70
                                : AppColors.textSecondary))),
              ]),
            ),
          ]),
          const SizedBox(height: 16),
        ],

        if (bg.isNotEmpty) ...[
          _section('Background'),
          _card(isDark,
              bg.entries.map((e) => _row(e.key, e.value, isDark)).toList()),
          const SizedBox(height: 16),
        ],

        if (conditions.isNotEmpty) ...[
          _section('Medical Conditions'),
          _card(isDark, [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: conditions
                    .map((c) => Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(c,
                              style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.warning)),
                        ))
                    .toList(),
              ),
            ),
          ]),
          const SizedBox(height: 16),
        ],

        if (_str(s['remarks']).isNotEmpty) ...[
          _section('Remarks'),
          _card(isDark, [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_str(s['remarks']),
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
            ),
          ]),
        ],
        const SizedBox(height: 24),
      ]),
    ),
    );
  }

  Widget _profileHeader(bool isDark, Map s) {
    final status = _str(s['status']);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(children: [
        CircleAvatar(
          radius: 32,
          backgroundColor: AppColors.primary.withValues(alpha: 0.1),
          child: Text(child.initial,
              style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary)),
        ),
        const SizedBox(height: 12),
        Text(child.name,
            style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(child.classLabel,
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted)),
        if (status.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: (status == 'active' ? AppColors.accentGreen : AppColors.warning)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(_cap(status),
                style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: status == 'active'
                        ? AppColors.accentGreen
                        : AppColors.warning)),
          ),
        ],
      ]),
    );
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8, left: 2),
        child: Text(title.toUpperCase(),
            style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
                color: AppColors.textMuted)),
      );

  Widget _card(bool isDark, List<Widget> children) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        child: Column(children: children),
      );

  Widget _row(String label, String value, bool isDark) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 120,
            child: Text(label,
                style: GoogleFonts.inter(
                    fontSize: 13, color: AppColors.textMuted)),
          ),
          Expanded(
              child: Text(value,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : AppColors.textPrimary))),
        ]),
      );

  Widget _guardianCard(Map g, bool isPrimary, bool isDark) {
    final name = _str(g['name']).isEmpty ? '—' : _str(g['name']);
    final initial = name == '—' ? '?' : name.trim()[0].toUpperCase();
    final relation = _cap(_str(g['relation']));
    final phone = _str(g['phone']);
    final altPhone = _str(g['alternatePhone']);
    final occupation = _str(g['occupation']);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: isPrimary ? AppColors.primary : AppColors.textSecondary,
          child: Text(initial,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(
                child: Text(name,
                    style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : AppColors.textPrimary),
                    overflow: TextOverflow.ellipsis),
              ),
              if (isPrimary) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10)),
                  child: Text('Primary',
                      style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary)),
                ),
              ],
            ]),
            if (relation.isNotEmpty || occupation.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                    [relation, occupation].where((e) => e.isNotEmpty).join(' · '),
                    style: GoogleFonts.inter(
                        fontSize: 12, color: AppColors.textMuted)),
              ),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          if (phone.isNotEmpty)
            Text(phone,
                style: GoogleFonts.inter(
                    fontSize: 13, color: AppColors.textSecondary)),
          if (altPhone.isNotEmpty)
            Text('$altPhone (Alt)',
                style:
                    GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted)),
        ]),
      ]),
    );
  }
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

    // Each record is a full attendance document with a `records[]` array;
    // pull out THIS child's per-day status (full word, e.g. 'half_day').
    final Map<int, String> dayStatus = {};
    for (final doc in _records) {
      if (doc is! Map) continue;
      if (doc['type'] != null && doc['type'] != 'student') continue;
      DateTime d;
      try {
        d = DateTime.parse(doc['date'].toString()).toUtc();
      } catch (_) {
        continue;
      }
      final recs = doc['records'];
      if (recs is! List) continue;
      for (final rec in recs) {
        if (rec is! Map) continue;
        if (_recStudentId(rec) != widget.childId) continue;
        final st = rec['status'];
        if (st is String && st.isNotEmpty) dayStatus[d.day] = st;
        break;
      }
    }

    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final firstWeekday = DateTime(_month.year, _month.month, 1).weekday;

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
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in _categories)
                _statChip(
                  '${c.$2} ${dayStatus.values.where((s) => s == c.$1).length}',
                  c.$3,
                ),
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
                  final color = _colorFor(status);
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

  // The five student-attendance categories shown to parents, in full words.
  static const List<(String, String, Color)> _categories = [
    ('present', 'Present', AppColors.accentGreen),
    ('absent', 'Absent', AppColors.accentRed),
    ('half_day', 'Half Day', AppColors.accentOrange),
    ('late', 'Late', AppColors.warning),
    ('excused', 'Excused', AppColors.info),
  ];

  Color? _colorFor(String? status) {
    for (final c in _categories) {
      if (c.$1 == status) return c.$3;
    }
    return null;
  }

  // The student ref may be a populated map ({_id,...}) or a bare id string.
  String _recStudentId(Map rec) {
    final s = rec['student'];
    if (s is Map) return (s['_id'] ?? '').toString();
    if (s is String) return s;
    return '';
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
  final String studentId;
  const _HomeworkTab({required this.studentId});
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
    if (widget.studentId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    try {
      // Per-student homework + this child's submission status & attachments.
      final res = await ApiClient.get('/homework/student-summary',
          params: {'studentId': widget.studentId});
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
        itemBuilder: (_, i) => _HomeworkCard(
            hw: _items[i] as Map,
            studentId: widget.studentId,
            onChanged: _load,
            isDark: isDark),
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  final Map hw;
  final String studentId;
  final Future<void> Function() onChanged;
  final bool isDark;
  const _HomeworkCard({
    required this.hw,
    required this.studentId,
    required this.onChanged,
    required this.isDark,
  });

  static String _fmtDate(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString()).toLocal();
      const m = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day} ${m[dt.month]} ${dt.year}';
    } catch (_) {
      return d?.toString() ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final sub = hw['submission'] is Map ? hw['submission'] as Map : null;
    final status = (sub?['status'] as String?) ?? 'pending';
    final attachments = (sub?['attachments'] is List)
        ? (sub!['attachments'] as List).whereType<Map>().toList()
        : const <Map>[];
    final due = _fmtDate(hw['dueDate']);
    final subjName = hw['subject'] is Map ? hw['subject']['name'] : null;
    final desc = (hw['description'] as String?)?.trim() ?? '';
    final note = (sub?['note'] as String?)?.trim() ?? '';

    final (statusLabel, statusColor) = switch (status) {
      'completed' => ('Submitted', AppColors.accentGreen),
      'in_progress' => ('In Progress', AppColors.warning),
      _ => ('Pending', AppColors.textMuted),
    };
    final completed = status == 'completed';

    // Overdue = past due date and not yet submitted.
    bool overdue = false;
    if (!completed && hw['dueDate'] != null) {
      try {
        final d = DateTime.parse(hw['dueDate'].toString()).toLocal();
        final now = DateTime.now();
        overdue = DateTime(d.year, d.month, d.day)
            .isBefore(DateTime(now.year, now.month, now.day));
      } catch (_) {}
    }
    final dueColor = overdue ? AppColors.accentRed : AppColors.textMuted;
    final hasSubInfo =
        note.isNotEmpty || sub?['submittedAt'] != null || attachments.isNotEmpty;

    final divider = Divider(
      height: 24,
      thickness: 1,
      color: isDark ? AppColors.borderDark : AppColors.borderLight,
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // ── Title + status pill ──
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Text(hw['title'] ?? 'Homework',
                style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    height: 1.25,
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 6,
                height: 6,
                decoration:
                    BoxDecoration(color: statusColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(statusLabel,
                  style: GoogleFonts.inter(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: statusColor)),
            ]),
          ),
        ]),
        // ── Description ──
        if (desc.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(desc,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    height: 1.4,
                    color: isDark ? Colors.white70 : AppColors.textSecondary)),
          ),
        // ── Meta: subject chip + due date ──
        if (subjName != null || due.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Wrap(
              spacing: 10,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (subjName != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.primary
                          .withValues(alpha: isDark ? 0.2 : 0.09),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.menu_book_rounded,
                          size: 13, color: AppColors.primary),
                      const SizedBox(width: 5),
                      Text(subjName.toString(),
                          style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary)),
                    ]),
                  ),
                if (due.isNotEmpty)
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.event_outlined, size: 14, color: dueColor),
                    const SizedBox(width: 5),
                    Text('${overdue ? 'Overdue' : 'Due'} $due',
                        style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight:
                                overdue ? FontWeight.w600 : FontWeight.w500,
                            color: dueColor)),
                  ]),
              ],
            ),
          ),
        // ── Submission details ──
        if (hasSubInfo) ...[
          divider,
          if (sub?['submittedAt'] != null)
            Row(children: [
              const Icon(Icons.check_circle_rounded,
                  size: 15, color: AppColors.accentGreen),
              const SizedBox(width: 6),
              Text('Submitted on ${_fmtDate(sub!['submittedAt'])}',
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
            ]),
          if (note.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(note,
                style: GoogleFonts.inter(
                    fontSize: 12.5,
                    height: 1.35,
                    color: isDark ? Colors.white70 : AppColors.textSecondary)),
          ],
          ...attachments.map((a) {
            final url = (a['url'] as String?) ?? '';
            final name = (a['name'] as String?) ?? 'Attachment';
            final isImage = a['fileType'] == 'image';
            return Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Material(
                color: AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.07),
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: url.isEmpty ? null : () => openServerFile(context, url),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 10),
                    child: Row(children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: AppColors.primary
                              .withValues(alpha: isDark ? 0.22 : 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                            isImage
                                ? Icons.image_outlined
                                : Icons.picture_as_pdf_rounded,
                            color: AppColors.primary,
                            size: 19),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(name,
                            style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.open_in_new_rounded,
                          color: AppColors.primary, size: 17),
                    ]),
                  ),
                ),
              ),
            );
          }),
        ] else
          divider,
        // ── Action CTA ──
        const SizedBox(height: 2),
        SizedBox(
          width: double.infinity,
          child: completed
              ? OutlinedButton.icon(
                  onPressed: () => _openSheet(context, sub),
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Update Submission'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    side: BorderSide(
                        color: AppColors.primary.withValues(alpha: 0.45)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    textStyle: GoogleFonts.inter(
                        fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                )
              : ElevatedButton.icon(
                  onPressed: () => _openSheet(context, sub),
                  icon: const Icon(Icons.upload_file_rounded, size: 18),
                  label: const Text('Submit Homework'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    textStyle: GoogleFonts.inter(
                        fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
        ),
      ]),
    );
  }

  Future<void> _openSheet(BuildContext context, Map? sub) async {
    final changed = await showHomeworkSubmissionSheet(
      context,
      homeworkId: (hw['_id'] ?? '').toString(),
      studentId: studentId,
      title: (hw['title'] ?? 'Homework').toString(),
      submission: sub,
    );
    if (changed) onChanged();
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

  // Open the result sheet instantly; it fetches & shows its own loading state.
  void _openResult(String examId) {
    showExamResultSheet(context,
        examId: examId, studentId: widget.studentId);
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
        final e = _exams[i] as Map;
        final examId = e['_id']?.toString() ?? '';
        return _ExamCard(
          exam: e,
          classId: widget.classId,
          isDark: isDark,
          onOpenResult: () => _openResult(examId),
        );
      },
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  final Map exam;
  final String classId;
  final bool isDark;
  final VoidCallback onOpenResult;
  const _ExamCard({
    required this.exam,
    required this.classId,
    required this.isDark,
    required this.onOpenResult,
  });

  static String _classId(dynamic c) {
    if (c is Map) return (c['_id'] ?? '').toString();
    if (c is String) return c;
    return '';
  }

  static String _fmtDate(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString());
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return d?.toString() ?? '';
    }
  }

  static String _fmtShort(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString()).toLocal();
      const m = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day} ${m[dt.month]}';
    } catch (_) {
      return '';
    }
  }

  // Show a time with AM/PM, handling both 24h ("20:00") and "h:mm A" strings.
  static String _fmtTime(dynamic raw) {
    final t = (raw ?? '').toString().trim();
    if (t.isEmpty) return '';
    final m = RegExp(r'^(\d{1,2}):(\d{2})\s*(AM|PM)?$', caseSensitive: false)
        .firstMatch(t);
    if (m == null) return t;
    final ap = m.group(3)?.toUpperCase();
    final min = m.group(2)!;
    if (ap != null) return '${int.parse(m.group(1)!)}:$min $ap';
    final h = int.parse(m.group(1)!);
    final period = h >= 12 ? 'PM' : 'AM';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '$h12:$min $period';
  }

  @override
  Widget build(BuildContext context) {
    final isPublished = exam['isResultPublished'] as bool? ?? false;
    final name = exam['name']?.toString() ?? 'Exam';
    final examDate = exam['examDate'] ?? exam['date'];

    // Subject-wise schedule for this student's class.
    final raw = exam['schedule'];
    final List<Map> schedule = [];
    if (raw is List) {
      for (final s in raw) {
        if (s is! Map) continue;
        final cid = _classId(s['class']);
        if (cid.isEmpty || classId.isEmpty || cid == classId) schedule.add(s);
      }
    }
    schedule.sort((a, b) =>
        (a['date']?.toString() ?? '').compareTo(b['date']?.toString() ?? ''));

    final divider = Divider(
      height: 22,
      thickness: 1,
      color: isDark ? AppColors.borderDark : AppColors.borderLight,
    );
    final statusColor = isPublished ? AppColors.accentGreen : AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // ── Header ──
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color:
                              isDark ? Colors.white : AppColors.textPrimary)),
                  if (examDate != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(_fmtDate(examDate),
                          style: GoogleFonts.inter(
                              fontSize: 12, color: AppColors.textMuted)),
                    ),
                ]),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 6,
                height: 6,
                decoration:
                    BoxDecoration(color: statusColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(isPublished ? 'Results Out' : 'Scheduled',
                  style: GoogleFonts.inter(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: statusColor)),
            ]),
          ),
        ]),
        // ── Subject-wise schedule ──
        if (schedule.isNotEmpty) ...[
          divider,
          Text('EXAM SCHEDULE',
              style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                  color: AppColors.textMuted)),
          const SizedBox(height: 10),
          ...schedule.map(_scheduleRow),
        ],
        // ── View results ──
        if (isPublished) ...[
          divider,
          InkWell(
            onTap: onOpenResult,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                const Icon(Icons.assignment_turned_in_outlined,
                    size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Text('View Results',
                    style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary)),
                const Spacer(),
                const Icon(Icons.chevron_right,
                    size: 20, color: AppColors.primary),
              ]),
            ),
          ),
        ],
      ]),
    );
  }

  Widget _scheduleRow(Map s) {
    final subj = s['subject'] is Map
        ? (s['subject']['name'] ?? '').toString()
        : (s['subject']?.toString() ?? '');
    final date = _fmtShort(s['date']);
    final start = _fmtTime(s['startTime']);
    final end = _fmtTime(s['endTime']);
    final time = [start, end].where((t) => t.isNotEmpty).join(' – ');
    final meta = [if (date.isNotEmpty) date, if (time.isNotEmpty) time].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 6,
          height: 6,
          margin: const EdgeInsets.only(top: 6, right: 9),
          decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.55),
              shape: BoxShape.circle),
        ),
        Expanded(
          child: Text(subj.isEmpty ? 'Subject' : subj,
              style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : AppColors.textPrimary)),
        ),
        const SizedBox(width: 10),
        Text(meta.isEmpty ? 'TBA' : meta,
            style: GoogleFonts.inter(
                fontSize: 12, color: AppColors.textSecondary)),
      ]),
    );
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

    // Break fees down per term (a fee record carries a terms[] array). Falls
    // back to the record-level aggregate for legacy records without terms.
    final rows = <Map<String, dynamic>>[];
    int totalDue = 0, totalPaid = 0;
    for (final f in _fees) {
      if (f is! Map) continue;
      final terms = (f['terms'] is List) ? f['terms'] as List : const [];
      if (terms.isNotEmpty) {
        for (final t in terms) {
          if (t is! Map) continue;
          final net = (t['netAmount'] as num? ?? 0).toInt();
          final paid = (t['paidAmount'] as num? ?? 0).toInt();
          rows.add({
            'name': (t['name'] ?? 'Term').toString(),
            'paid': paid,
            'net': net,
            'status': (t['status'] ?? _deriveStatus(paid, net)).toString(),
          });
          totalDue += net;
          totalPaid += paid;
        }
      } else {
        final net = (f['netAmount'] as num? ?? 0).toInt();
        final paid = (f['paidAmount'] as num? ?? 0).toInt();
        rows.add({
          'name': (f['feeType']?['name'] ?? f['description'] ?? 'Fee').toString(),
          'paid': paid,
          'net': net,
          'status': (f['status'] ?? _deriveStatus(paid, net)).toString(),
        });
        totalDue += net;
        totalPaid += paid;
      }
    }
    final pending = totalDue - totalPaid;
    final totalStatus =
        totalPaid <= 0 ? 'pending' : (totalPaid >= totalDue ? 'paid' : 'partial');

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            _summaryCard('Total', '₹$totalDue',
                isDark ? Colors.white : AppColors.textPrimary),
            const SizedBox(width: 12),
            _summaryCard('Paid', '₹$totalPaid', AppColors.accentGreen),
            const SizedBox(width: 12),
            _summaryCard('Pending', '₹$pending',
                pending > 0 ? AppColors.accentRed : AppColors.accentGreen),
          ]),
          const SizedBox(height: 16),
          ...rows.map((r) => _feeRow(r['name'] as String, r['paid'] as int,
              r['net'] as int, r['status'] as String, isDark)),
          _totalRow(totalPaid, totalDue, totalStatus, isDark),
        ],
      ),
    );
  }

  Widget _feeRow(String name, int paid, int net, String status, bool isDark) =>
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        child: Row(children: [
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name,
                  style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('₹$paid / ₹$net',
                  style: GoogleFonts.inter(
                      fontSize: 12, color: AppColors.textMuted)),
            ]),
          ),
          _statusBadge(status),
        ]),
      );

  Widget _totalRow(int paid, int net, String status, bool isDark) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        ),
        child: Row(children: [
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Total Fees',
                  style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : AppColors.textPrimary)),
              const SizedBox(height: 2),
              Text('₹$paid / ₹$net',
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary)),
            ]),
          ),
          _statusBadge(status),
        ]),
      );

  Widget _statusBadge(String status) {
    final sColor = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: sColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.isEmpty ? '' : status[0].toUpperCase() + status.substring(1),
        style: GoogleFonts.inter(
            fontSize: 12, color: sColor, fontWeight: FontWeight.w600),
      ),
    );
  }

  String _deriveStatus(int paid, int net) {
    if (paid <= 0) return 'pending';
    if (paid >= net) return 'paid';
    return 'partial';
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
