// ── Student Detail Screen ─────────────────────────────────────────────────────
// Mirrors the web StudentDetail component with tabs:
// Overview | More Info | Attendance | Homework | Exams | Fees
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';

// Tab constants
const _tabs = [
  'Overview',
  'More Info',
  'Attendance',
  'Homework',
  'Exams',
  'Fees',
];

class StudentDetailScreen extends StatefulWidget {
  final String studentId;
  final String? studentName;
  const StudentDetailScreen(
      {super.key, required this.studentId, this.studentName});

  @override
  State<StudentDetailScreen> createState() => _StudentDetailScreenState();
}

class _StudentDetailScreenState extends State<StudentDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tc;
  dynamic _student;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tc = TabController(length: _tabs.length, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tc.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.get('/students/${widget.studentId}');
      setState(() {
        _student = res.data['student'] ?? res.data;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = ApiClient.errorMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_loading) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
        appBar: _buildAppBar(isDark, widget.studentName ?? 'Student'),
        body: const Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (_error != null || _student == null) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
        appBar: _buildAppBar(isDark, 'Error'),
        body: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.error_outline,
                size: 52, color: AppColors.accentRed),
            const SizedBox(height: 12),
            Text(_error ?? 'Failed to load student',
                style: AppTypography.s14Regular(color: AppColors.textMuted)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      );
    }

    final s = _student;
    final name = s['name'] as String? ?? '';
    final admNo = s['admissionNumber'] as String? ?? '';
    final cls = s['currentClass'];
    final classLabel =
        cls is Map ? '${cls['name'] ?? ''} ${cls['section'] ?? ''}'.trim() : '';
    final gender = s['gender'] as String? ?? '';
    final dob = s['dateOfBirth'] as String?;
    final status = s['status'] as String? ?? 'active';
    final photo = s['photo'] as String?;
    final roll = s['rollNumber'] as String? ?? '';
    final attSummary = s['attendanceSummary'];

    final genderColor = gender.toLowerCase() == 'female'
        ? const Color(0xFFEC4899)
        : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      appBar: _buildAppBar(isDark, name),
      body: Column(children: [
        // ── Profile Header Card ──────────────────────────────────────────────
        Container(
          color: isDark ? AppColors.cardDark : Colors.white,
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            // Avatar
            CircleAvatar(
              radius: 30,
              backgroundColor: genderColor.withValues(alpha: 0.12),
              backgroundImage: photo != null && photo.isNotEmpty
                  ? NetworkImage(photo)
                  : null,
              child: photo == null || photo.isEmpty
                  ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: AppTypography.s24Bold(color: genderColor))
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(name,
                      style: AppTypography.s16Bold(
                          color: isDark ? Colors.white : AppColors.textPrimary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 3),
                  Wrap(spacing: 6, children: [
                    if (admNo.isNotEmpty)
                      _Chip(admNo,
                          bg: AppColors.badgeInfoBg, fg: AppColors.primary),
                    if (classLabel.isNotEmpty)
                      _Chip(classLabel,
                          bg: AppColors.primary.withValues(alpha: 0.08),
                          fg: AppColors.primary),
                    if (roll.isNotEmpty)
                      _Chip('Roll $roll',
                          bg: AppColors.badgeSuccessBg,
                          fg: AppColors.accentGreen),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    _StatusDot(status),
                    const SizedBox(width: 5),
                    Text(status.toUpperCase(),
                        style: AppTypography.s12SemiBold(
                            color: status == 'active'
                                ? AppColors.accentGreen
                                : AppColors.textMuted)),
                  ]),
                ])),
          ]),
        ),

        // ── Tab Bar ─────────────────────────────────────────────────────────
        Container(
          color: isDark ? AppColors.cardDark : Colors.white,
          child: TabBar(
            controller: _tc,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelStyle:
                GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
            unselectedLabelStyle:
                GoogleFonts.inter(fontWeight: FontWeight.w400, fontSize: 13),
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.primary,
            indicatorWeight: 2.5,
            tabs: _tabs.map((t) => Tab(text: t)).toList(),
          ),
        ),

        // ── Tab Content ──────────────────────────────────────────────────────
        Expanded(
          child: TabBarView(controller: _tc, children: [
            _OverviewTab(student: s, isDark: isDark),
            _MoreInfoTab(student: s, isDark: isDark),
            _AttendanceTab(studentId: widget.studentId, isDark: isDark),
            _HomeworkTab(studentId: widget.studentId, isDark: isDark),
            _ExamsTab(studentId: widget.studentId, isDark: isDark),
            _FeesTab(studentId: widget.studentId, isDark: isDark),
          ]),
        ),
      ]),
    );
  }

  AppBar _buildAppBar(bool isDark, String title) => AppBar(
        title: Text(title,
            style:
                GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 17)),
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final dynamic student;
  final bool isDark;
  const _OverviewTab({required this.student, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final s = student;
    final cls = s['currentClass'];
    final classLabel =
        cls is Map ? '${cls['name'] ?? ''} — ${cls['section'] ?? ''}' : '—';
    final dob = s['dateOfBirth'] as String?;
    final dobFmt = dob != null ? _fmtDate(dob) : '—';
    final admDate = s['admissionDate'] as String?;
    final admDateFmt = admDate != null ? _fmtDate(admDate) : '—';
    final guardians = s['guardians'] as List? ?? [];
    final primaryG = guardians.isNotEmpty ? guardians[0] : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Academic Details
        _SectionTitle('Academic Details', isDark),
        _InfoCard(isDark: isDark, children: [
          _Row('Admission Number', s['admissionNumber'] ?? '—', isDark),
          _Row('Admission Date', admDateFmt, isDark),
          _Row('Class', classLabel, isDark),
          _Row('Roll Number', s['rollNumber'] ?? '—', isDark),
        ]),
        const SizedBox(height: 16),

        // Personal Details
        _SectionTitle('Personal Details', isDark),
        _InfoCard(isDark: isDark, children: [
          _Row('Full Name', s['name'] ?? '—', isDark),
          _Row('Gender', (s['gender'] ?? '—').toString().capitalize(), isDark),
          _Row('Date of Birth', dobFmt, isDark),
          _Row('Status', (s['status'] ?? '—').toString().capitalize(), isDark),
          if (s['bloodGroup'] != null)
            _Row('Blood Group', s['bloodGroup'], isDark),
          if (s['aadharNumber'] != null)
            _Row('Aadhar Number', s['aadharNumber'], isDark),
        ]),
        const SizedBox(height: 16),

        // Parent Contact
        if (primaryG != null) ...[
          _SectionTitle('Primary Guardian', isDark),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child: Row(children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.primary,
                child: Text((primaryG['name'] ?? 'P')[0].toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 16)),
              ),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(primaryG['name'] ?? '—',
                        style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.badgeInfoBg,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                          (primaryG['relation'] ?? '').toString().capitalize(),
                          style: AppTypography.s12SemiBold(
                              color: AppColors.primary)),
                    ),
                    if (primaryG['phone'] != null) ...[
                      const SizedBox(height: 4),
                      Row(children: [
                        Icon(Icons.phone_outlined,
                            size: 13, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(primaryG['phone'] ?? '',
                            style: AppTypography.s13Regular(
                                color: AppColors.textSecondary)),
                      ]),
                    ],
                  ])),
            ]),
          ),
          const SizedBox(height: 16),
        ],

        // Address
        if (s['address']?['street'] != null) ...[
          _SectionTitle('Address', isDark),
          _InfoCard(isDark: isDark, children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(children: [
                Icon(Icons.location_on_outlined,
                    size: 16, color: AppColors.textMuted),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(s['address']['street'] ?? '—',
                        style: AppTypography.s14Regular(
                            color: isDark
                                ? Colors.white
                                : AppColors.textSecondary))),
              ]),
            ),
          ]),
          const SizedBox(height: 16),
        ],
      ]),
    );
  }
}

// ─── More Info Tab ────────────────────────────────────────────────────────────

class _MoreInfoTab extends StatelessWidget {
  final dynamic student;
  final bool isDark;
  const _MoreInfoTab({required this.student, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final s = student;
    final guardians = s['guardians'] as List? ?? [];
    final medConds =
        (s['medicalInfo']?['conditions'] as List?)?.cast<String>() ?? [];
    final bgFields = {
      'Nationality': s['nationality'],
      'Religion': s['religion'],
      'Mother Tongue': s['motherTongue'],
      'Previous School': s['previousSchool'],
      'ID Mark': s['identificationMark'],
    }
        .entries
        .where((e) => e.value != null && e.value.toString().isNotEmpty)
        .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // All Guardians
        _SectionTitle('Parents / Guardians', isDark),
        if (guardians.isEmpty)
          _EmptyState('No guardian contacts added')
        else
          ...guardians.asMap().entries.map((entry) {
            final i = entry.key;
            final g = entry.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight),
                boxShadow: isDark ? [] : AppColors.shadowSm,
              ),
              child: Row(children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor:
                      i == 0 ? AppColors.primary : AppColors.textSecondary,
                  child: Text((g['name'] ?? '?')[0].toUpperCase(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15)),
                ),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Row(children: [
                        Text(g['name'] ?? '—',
                            style: AppTypography.s14SemiBold(
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                        if (i == 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                                color: AppColors.badgeInfoBg,
                                borderRadius: BorderRadius.circular(10)),
                            child: Text('Primary',
                                style: AppTypography.s12SemiBold(
                                    color: AppColors.primary)),
                          ),
                        ],
                      ]),
                      const SizedBox(height: 3),
                      Text((g['relation'] ?? '').toString().capitalize(),
                          style: AppTypography.s12Regular(
                              color: AppColors.textMuted)),
                    ])),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  if (g['phone'] != null)
                    Text(g['phone'],
                        style: AppTypography.s13Regular(
                            color: AppColors.textSecondary)),
                  if (g['alternatePhone'] != null)
                    Text('${g['alternatePhone']} (Alt)',
                        style: AppTypography.s12Regular(
                            color: AppColors.textMuted)),
                ]),
              ]),
            );
          }),

        const SizedBox(height: 16),

        // Background info
        if (bgFields.isNotEmpty) ...[
          _SectionTitle('Background', isDark),
          _InfoCard(
              isDark: isDark,
              children:
                  bgFields.map((e) => _Row(e.key, e.value, isDark)).toList()),
          const SizedBox(height: 16),
        ],

        // Medical
        if (medConds.isNotEmpty) ...[
          _SectionTitle('Medical Conditions', isDark),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: medConds
                    .map((c) => Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.badgeWarningBg,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color:
                                    AppColors.warning.withValues(alpha: 0.3)),
                          ),
                          child: Text(c,
                              style: AppTypography.s12SemiBold(
                                  color: AppColors.warning)),
                        ))
                    .toList()),
          ),
          const SizedBox(height: 16),
        ],

        // Remarks
        if (s['remarks'] != null && s['remarks'].toString().isNotEmpty) ...[
          _SectionTitle('Remarks', isDark),
          _InfoCard(isDark: isDark, children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(s['remarks'],
                  style: AppTypography.s14Regular(
                      color: isDark ? Colors.white : AppColors.textSecondary)),
            ),
          ]),
        ],
      ]),
    );
  }
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

class _AttendanceTab extends StatefulWidget {
  final String studentId;
  final bool isDark;
  const _AttendanceTab({required this.studentId, required this.isDark});

  @override
  State<_AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<_AttendanceTab> {
  dynamic _summary;
  List<dynamic> _records = [];
  bool _loading = false;
  late int _month, _year;

  static const _months = [
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
  ];
  static const _statusMeta = {
    'present': {
      'label': 'P',
      'color': Color(0xFF10B981),
      'bg': Color(0xFFDCFCE7)
    },
    'absent': {
      'label': 'A',
      'color': Color(0xFFEF4444),
      'bg': Color(0xFFFEE2E2)
    },
    'late': {'label': 'L', 'color': Color(0xFFF59E0B), 'bg': Color(0xFFFEF3C7)},
    'half_day': {
      'label': 'H',
      'color': Color(0xFF8B5CF6),
      'bg': Color(0xFFF3E8FF)
    },
    'od': {'label': 'OD', 'color': Color(0xFF0891B2), 'bg': Color(0xFFCFFAFE)},
    'cl': {'label': 'CL', 'color': Color(0xFF0284C7), 'bg': Color(0xFFDBEAFE)},
    'sl': {'label': 'SL', 'color': Color(0xFF7C3AED), 'bg': Color(0xFFEDE9FE)},
    'excused': {
      'label': 'E',
      'color': Color(0xFF6366F1),
      'bg': Color(0xFFEDE9FE)
    },
  };

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
    _loadSummary();
    _loadRecords();
  }

  Future<void> _loadSummary() async {
    try {
      final res = await ApiClient.get('/attendance/summary',
          params: {'studentId': widget.studentId});
      if (mounted) setState(() => _summary = res.data['summary']);
    } catch (_) {}
  }

  Future<void> _loadRecords() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/attendance/student-records', params: {
        'studentId': widget.studentId,
        'month': _month.toString(),
        'year': _year.toString(),
      });
      if (mounted)
        setState(() {
          _records = res.data['records'] as List? ?? [];
          _loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _prevMonth() {
    setState(() {
      if (_month == 1) {
        _month = 12;
        _year--;
      } else
        _month--;
    });
    _loadRecords();
  }

  void _nextMonth() {
    final now = DateTime.now();
    if (_year > now.year || (_year == now.year && _month >= now.month)) return;
    setState(() {
      if (_month == 12) {
        _month = 1;
        _year++;
      } else
        _month++;
    });
    _loadRecords();
  }

  Map<String, String?> get _byDate {
    final map = <String, List<String>>{};
    for (final r in _records) {
      final dateStr = r['date'] as String? ?? '';
      if (dateStr.isEmpty) continue;
      final key = dateStr.substring(0, 10);
      map.putIfAbsent(key, () => []).add(r['status'] as String? ?? '');
    }
    // Dominant status per day (absent > late > present etc.)
    const priority = [
      'absent',
      'late',
      'half_day',
      'excused',
      'od',
      'cl',
      'sl',
      'present'
    ];
    final result = <String, String?>{};
    map.forEach((key, statuses) {
      for (final p in priority) {
        if (statuses.contains(p)) {
          result[key] = p;
          break;
        }
      }
      result.putIfAbsent(key, () => statuses.first);
    });
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final byDate = _byDate;
    final now = DateTime.now();
    final daysInMonth = DateTime(_year, _month + 1, 0).day;
    final firstDow = DateTime(_year, _month, 1).weekday %
        7; // Mon=0 in Flutter, Sun=0 in grid
    final canNext =
        _year < now.year || (_year == now.year && _month < now.month);

    // Monthly counts
    int present = 0, absent = 0, late = 0;
    for (final r in _records) {
      final st = r['status'] as String? ?? '';
      if (st == 'present')
        present++;
      else if (st == 'absent')
        absent++;
      else if (st == 'late') late++;
    }
    final mTotal = _records.length;
    final mPct = mTotal > 0 ? ((present / mTotal) * 100).round() : 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Overall summary pills
        if (_summary != null) ...[
          Row(
              children: [
            _StatPill('Present', '${_summary['present']}',
                AppColors.accentGreen, const Color(0xFFF0FDF4)),
            const SizedBox(width: 8),
            _StatPill('Absent', '${_summary['absent']}', AppColors.accentRed,
                const Color(0xFFFEF2F2)),
            const SizedBox(width: 8),
            _StatPill(
                'Overall',
                '${_summary['percentage']}%',
                (_summary['percentage'] as num? ?? 0) >= 75
                    ? AppColors.accentGreen
                    : (_summary['percentage'] as num? ?? 0) >= 50
                        ? AppColors.accent
                        : AppColors.accentRed,
                (_summary['percentage'] as num? ?? 0) >= 75
                    ? const Color(0xFFF0FDF4)
                    : const Color(0xFFFEF2F2)),
          ].expand((w) => [w]).toList()),
          const SizedBox(height: 16),
        ],

        // Month navigator
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            IconButton(
              onPressed: _prevMonth,
              icon: const Icon(Icons.chevron_left),
              iconSize: 22,
              padding: EdgeInsets.zero,
            ),
            Text('${_months[_month - 1]} $_year',
                style: AppTypography.s16Bold(
                    color:
                        widget.isDark ? Colors.white : AppColors.textPrimary)),
            IconButton(
              onPressed: canNext ? _nextMonth : null,
              icon: Icon(Icons.chevron_right,
                  color: canNext ? null : AppColors.textMuted),
              iconSize: 22,
              padding: EdgeInsets.zero,
            ),
          ]),
          if (mTotal > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: mPct >= 75
                    ? const Color(0xFFDCFCE7)
                    : mPct >= 50
                        ? const Color(0xFFFEF3C7)
                        : const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text('$mPct% this month',
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: mPct >= 75
                          ? const Color(0xFF166534)
                          : mPct >= 50
                              ? const Color(0xFF92400E)
                              : const Color(0xFFDC2626))),
            ),
        ]),
        const SizedBox(height: 12),

        // Calendar
        Container(
          decoration: BoxDecoration(
            color: widget.isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: widget.isDark
                    ? AppColors.borderDark
                    : AppColors.borderLight),
          ),
          child: Column(children: [
            // Day headers
            Container(
              decoration: BoxDecoration(
                color: widget.isDark
                    ? AppColors.borderDark.withValues(alpha: 0.3)
                    : const Color(0xFFF8FAFC),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(14)),
              ),
              child: Row(
                  children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      .map((d) => Expanded(
                              child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(d,
                                textAlign: TextAlign.center,
                                style: AppTypography.s12SemiBold(
                                    color: AppColors.textMuted)),
                          )))
                      .toList()),
            ),
            if (_loading)
              const Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(color: AppColors.primary))
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  childAspectRatio: 1.1,
                ),
                itemCount: firstDow + daysInMonth,
                itemBuilder: (_, idx) {
                  if (idx < firstDow) return const SizedBox.shrink();
                  final day = idx - firstDow + 1;
                  final dateKey =
                      '$_year-${_month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
                  final status = byDate[dateKey];
                  final meta = status != null ? _statusMeta[status] : null;
                  final isToday = dateKey ==
                      DateTime.now().toIso8601String().substring(0, 10);
                  return Container(
                    margin: const EdgeInsets.all(1),
                    decoration: BoxDecoration(
                      color: meta != null
                          ? (meta['bg'] as Color).withValues(alpha: 0.6)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                      border: isToday
                          ? Border.all(color: AppColors.primary, width: 1.5)
                          : null,
                    ),
                    child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('$day',
                              style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: isToday
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: isToday
                                      ? AppColors.primary
                                      : (widget.isDark
                                          ? Colors.white70
                                          : AppColors.textSecondary))),
                          if (meta != null)
                            Text(meta['label'] as String,
                                style: GoogleFonts.inter(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: meta['color'] as Color)),
                        ]),
                  );
                },
              ),
          ]),
        ),

        const SizedBox(height: 16),

        // Legend
        Wrap(
            spacing: 10,
            runSpacing: 6,
            children: _statusMeta.entries
                .map((e) => Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                              color: e.value['bg'] as Color,
                              borderRadius: BorderRadius.circular(2),
                              border: Border.all(
                                  color: (e.value['color'] as Color)
                                      .withValues(alpha: 0.5)))),
                      const SizedBox(width: 4),
                      Text(e.key.replaceAll('_', ' ').capitalize(),
                          style: AppTypography.s12Regular(
                              color: AppColors.textMuted)),
                    ]))
                .toList()),
      ]),
    );
  }
}

// ─── Homework Tab ─────────────────────────────────────────────────────────────

class _HomeworkTab extends StatefulWidget {
  final String studentId;
  final bool isDark;
  const _HomeworkTab({required this.studentId, required this.isDark});

  @override
  State<_HomeworkTab> createState() => _HomeworkTabState();
}

class _HomeworkTabState extends State<_HomeworkTab> {
  List<dynamic> _hw = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/homework',
          params: {'studentId': widget.studentId, 'limit': '50'});
      if (mounted)
        setState(() {
          _hw = res.data['homeworks'] as List? ?? [];
          _loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
    if (_hw.isEmpty) return _EmptyState('No homework records found');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _hw.length,
      itemBuilder: (_, i) {
        final h = _hw[i];
        final subject =
            h['subject']?['name'] as String? ?? h['subject'] as String? ?? '—';
        final dueDate = h['dueDate'] as String?;
        final dueFmt = dueDate != null ? _fmtDate(dueDate) : '—';
        final status = h['status'] as String? ?? '';
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: widget.isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: widget.isDark
                    ? AppColors.borderDark
                    : AppColors.borderLight),
            boxShadow: widget.isDark ? [] : AppColors.shadowSm,
          ),
          child: Row(children: [
            Container(
                width: 4,
                height: 40,
                decoration: BoxDecoration(
                  color: status == 'submitted'
                      ? AppColors.accentGreen
                      : status == 'pending'
                          ? AppColors.accent
                          : AppColors.textMuted,
                  borderRadius: BorderRadius.circular(2),
                )),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(h['title'] as String? ?? '—',
                      style: AppTypography.s14SemiBold(
                          color: widget.isDark
                              ? Colors.white
                              : AppColors.textPrimary)),
                  const SizedBox(height: 3),
                  Text('$subject · Due: $dueFmt',
                      style:
                          AppTypography.s12Regular(color: AppColors.textMuted)),
                ])),
            if (status.isNotEmpty)
              _Chip(status.capitalize(),
                  bg: status == 'submitted'
                      ? AppColors.badgeSuccessBg
                      : AppColors.badgeWarningBg,
                  fg: status == 'submitted'
                      ? AppColors.accentGreen
                      : AppColors.accent),
          ]),
        );
      },
    );
  }
}

// ─── Exams Tab ────────────────────────────────────────────────────────────────

class _ExamsTab extends StatefulWidget {
  final String studentId;
  final bool isDark;
  const _ExamsTab({required this.studentId, required this.isDark});

  @override
  State<_ExamsTab> createState() => _ExamsTabState();
}

class _ExamsTabState extends State<_ExamsTab> {
  List<dynamic> _results = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/exams/results',
          params: {'studentId': widget.studentId});
      if (mounted)
        setState(() {
          _results = res.data['results'] as List? ?? [];
          _loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
    if (_results.isEmpty) return _EmptyState('No exam results found');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _results.length,
      itemBuilder: (_, i) {
        final r = _results[i];
        final subject = r['subject']?['name'] as String? ?? '—';
        final marks = r['marks'] ?? r['marksObtained'];
        final total = r['totalMarks'] ?? r['maxMarks'];
        final pct = (marks != null && total != null && total != 0)
            ? ((marks / total) * 100).round()
            : null;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: widget.isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: widget.isDark
                    ? AppColors.borderDark
                    : AppColors.borderLight),
            boxShadow: widget.isDark ? [] : AppColors.shadowSm,
          ),
          child: Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(subject,
                      style: AppTypography.s14SemiBold(
                          color: widget.isDark
                              ? Colors.white
                              : AppColors.textPrimary)),
                  if (r['examName'] != null)
                    Text(r['examName'],
                        style: AppTypography.s12Regular(
                            color: AppColors.textMuted)),
                ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              if (marks != null && total != null)
                Text('$marks / $total',
                    style: AppTypography.s14SemiBold(color: AppColors.primary)),
              if (pct != null)
                Text('$pct%',
                    style: AppTypography.s12SemiBold(
                        color: pct >= 75
                            ? AppColors.accentGreen
                            : pct >= 40
                                ? AppColors.accent
                                : AppColors.accentRed)),
            ]),
          ]),
        );
      },
    );
  }
}

// ─── Fees Tab ─────────────────────────────────────────────────────────────────

class _FeesTab extends StatefulWidget {
  final String studentId;
  final bool isDark;
  const _FeesTab({required this.studentId, required this.isDark});

  @override
  State<_FeesTab> createState() => _FeesTabState();
}

class _FeesTabState extends State<_FeesTab> {
  dynamic _feeSummary;
  List<dynamic> _transactions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/fees/student/${widget.studentId}');
      if (mounted) {
        setState(() {
          _feeSummary = res.data['summary'];
          _transactions = res.data['transactions'] as List? ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (_feeSummary != null) ...[
          Row(children: [
            Expanded(
                child: _FeeStatCard(
                    'Total Fees',
                    '₹${_feeSummary['total'] ?? 0}',
                    AppColors.primary,
                    AppColors.badgeInfoBg)),
            const SizedBox(width: 8),
            Expanded(
                child: _FeeStatCard('Paid', '₹${_feeSummary['paid'] ?? 0}',
                    AppColors.accentGreen, AppColors.badgeSuccessBg)),
            const SizedBox(width: 8),
            Expanded(
                child: _FeeStatCard('Due', '₹${_feeSummary['due'] ?? 0}',
                    AppColors.accentRed, AppColors.badgeDangerBg)),
          ]),
          const SizedBox(height: 20),
        ],
        _SectionTitle('Payment History', widget.isDark),
        if (_transactions.isEmpty)
          _EmptyState('No payment records found')
        else
          ..._transactions.map((t) {
            final date = t['date'] as String?;
            final dateFmt = date != null ? _fmtDate(date) : '—';
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: widget.isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: widget.isDark
                        ? AppColors.borderDark
                        : AppColors.borderLight),
                boxShadow: widget.isDark ? [] : AppColors.shadowSm,
              ),
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.badgeSuccessBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.receipt_outlined,
                      color: AppColors.accentGreen, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(t['description'] ?? t['feeType'] ?? 'Payment',
                          style: AppTypography.s14SemiBold(
                              color: widget.isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      Text(dateFmt,
                          style: AppTypography.s12Regular(
                              color: AppColors.textMuted)),
                    ])),
                Text('₹${t['amount'] ?? 0}',
                    style: AppTypography.s14SemiBold(
                        color: AppColors.accentGreen)),
              ]),
            );
          }),
      ]),
    );
  }
}

// ─── Shared Helper Widgets ────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  final String text;
  final bool isDark;
  const _SectionTitle(this.text, this.isDark);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text.toUpperCase(),
            style: AppTypography.s12SemiBold(
                color: isDark ? AppColors.textMuted : AppColors.textSecondary)),
      );
}

class _InfoCard extends StatelessWidget {
  final bool isDark;
  final List<Widget> children;
  const _InfoCard({required this.isDark, required this.children});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(children: children),
      );
}

class _Row extends StatelessWidget {
  final String label;
  final dynamic value;
  final bool isDark;
  const _Row(this.label, this.value, this.isDark);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          SizedBox(
              width: 120,
              child: Text(label,
                  style: AppTypography.s13Regular(color: AppColors.textMuted))),
          Expanded(
              child: Text(value?.toString() ?? '—',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary))),
        ]),
      );
}

class _Chip extends StatelessWidget {
  final String text;
  final Color bg, fg;
  const _Chip(this.text, {required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: AppTypography.s12SemiBold(color: fg)),
      );
}

class _StatusDot extends StatelessWidget {
  final String status;
  const _StatusDot(this.status);

  @override
  Widget build(BuildContext context) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color:
              status == 'active' ? AppColors.accentGreen : AppColors.textMuted,
        ),
      );
}

class _EmptyState extends StatelessWidget {
  final String message;
  const _EmptyState(this.message);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
            child: Column(children: [
          Icon(Icons.inbox_outlined, size: 48, color: AppColors.textMuted),
          const SizedBox(height: 10),
          Text(message,
              style: AppTypography.s14Regular(color: AppColors.textMuted)),
        ])),
      );
}

class _StatPill extends StatelessWidget {
  final String label, value;
  final Color color, bg;
  const _StatPill(this.label, this.value, this.color, this.bg);

  @override
  Widget build(BuildContext context) => Expanded(
          child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.2))),
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 20, fontWeight: FontWeight.w700, color: color)),
          Text(label,
              style: AppTypography.s11Regular(color: AppColors.textMuted)),
        ]),
      ));
}

class _FeeStatCard extends StatelessWidget {
  final String label, value;
  final Color color, bg;
  const _FeeStatCard(this.label, this.value, this.color, this.bg);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 18, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 3),
          Text(label,
              style: AppTypography.s12Regular(color: AppColors.textMuted),
              textAlign: TextAlign.center),
        ]),
      );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

String _fmtDate(String iso) {
  try {
    final d = DateTime.parse(iso);
    return DateFormat('dd MMM yyyy').format(d);
  } catch (_) {
    return iso;
  }
}

extension _StringExt on String {
  String capitalize() =>
      isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';
}
