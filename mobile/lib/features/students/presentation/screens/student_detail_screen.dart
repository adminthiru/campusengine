// ── Student Detail Screen ─────────────────────────────────────────────────────
// Mirrors the web StudentDetail: Overview | More Info | Attendance |
// Exam Results | Home Works | Fees
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

const _tabs = [
  'Overview',
  'More Info',
  'Attendance',
  'Exam Results',
  'Home Works',
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
        body: SkeletonShimmer(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              color: isDark ? AppColors.cardDark : Colors.white,
              padding: const EdgeInsets.all(16),
              child: Row(children: const [
                SkeletonBox(width: 60, height: 60, radius: 30),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(width: 160, height: 16),
                        SizedBox(height: 8),
                        SkeletonBox(width: 120, height: 12),
                      ]),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SkeletonBox(width: 140, height: 12),
                SizedBox(height: 10),
                SkeletonBox(width: double.infinity, height: 120, radius: 14),
                SizedBox(height: 16),
                SkeletonBox(width: 140, height: 12),
                SizedBox(height: 10),
                SkeletonBox(width: double.infinity, height: 120, radius: 14),
              ]),
            ),
          ]),
        ),
      );
    }

    if (_error != null || _student == null) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
        appBar: _buildAppBar(isDark, 'Error'),
        body: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.error_outline, size: 52, color: AppColors.accentRed),
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
    final status = s['status'] as String? ?? 'active';
    final photo = s['photo'] as String?;
    final roll = s['rollNumber'] as String? ?? '';

    final genderColor = gender.toLowerCase() == 'female'
        ? const Color(0xFFEC4899)
        : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      appBar: _buildAppBar(isDark, name),
      body: Column(children: [
        Container(
          color: isDark ? AppColors.cardDark : Colors.white,
          padding: const EdgeInsets.all(16),
          child: Row(children: [
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

        Expanded(
          child: TabBarView(controller: _tc, children: [
            _OverviewTab(student: s, isDark: isDark, onRefresh: _load),
            _MoreInfoTab(student: s, isDark: isDark, onRefresh: _load),
            _AttendanceTab(studentId: widget.studentId, isDark: isDark),
            _ExamsTab(studentId: widget.studentId, isDark: isDark),
            _HomeworkTab(studentId: widget.studentId, isDark: isDark),
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
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final dynamic student;
  final bool isDark;
  final Future<void> Function() onRefresh;
  const _OverviewTab(
      {required this.student, required this.isDark, required this.onRefresh});

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
    final transport = s['transportRoute'];
    final busStop = s['busStop'] as String?;

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Academic Details
          _SectionTitle('Academic Details', isDark),
          _InfoCard(isDark: isDark, children: [
            _Row('Admission Number', s['admissionNumber'] ?? '—', isDark),
            _Row('Admission Date', admDateFmt, isDark),
            _Row('Class', classLabel, isDark),
            _Row('Roll Number', s['rollNumber'] ?? '—', isDark),
            if (s['academicYear'] != null)
              _Row('Academic Year', s['academicYear'], isDark),
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
            if (s['category'] != null)
              _Row('Category', (s['category'] ?? '').toString().toUpperCase(), isDark),
            if (s['aadharNumber'] != null)
              _Row('Aadhar Number', s['aadharNumber'], isDark),
          ]),
          const SizedBox(height: 16),

          // Parent Contact
          if (primaryG != null) ...[
            _SectionTitle('Parent Contact', isDark),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight),
                boxShadow: isDark ? [] : AppColors.shadowSm,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
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
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.s14SemiBold(
                          color: isDark ? Colors.white : AppColors.textPrimary)),
                  const SizedBox(height: 3),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.badgeInfoBg,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                        (primaryG['relation'] ?? '').toString().capitalize(),
                        style: AppTypography.s12SemiBold(
                            color: AppColors.primary)),
                  ),
                  if (s['phone'] != null && (s['phone'] as String).isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(children: [
                      Icon(Icons.phone_outlined,
                          size: 13, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(s['phone'],
                            style: AppTypography.s13Regular(
                                color: AppColors.textSecondary)),
                      ),
                    ]),
                  ],
                  if (s['alternativeMobile'] != null &&
                      (s['alternativeMobile'] as String).isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(children: [
                      Icon(Icons.phone_outlined,
                          size: 13, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text('${s['alternativeMobile']} (Alt)',
                            style: AppTypography.s12Regular(
                                color: AppColors.textSecondary)),
                      ),
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

          // Transport
          if (transport != null) ...[
            _SectionTitle('Transport', isDark),
            _InfoCard(isDark: isDark, children: [
              _Row(
                'Route',
                transport is Map
                    ? [
                        if (transport['routeNumber'] != null)
                          '#${transport['routeNumber']}',
                        transport['vehicleNumber'] ?? transport['routeName'] ?? '',
                      ].where((e) => e.isNotEmpty).join(' · ')
                    : transport.toString(),
                isDark,
              ),
              if (busStop != null && busStop.isNotEmpty)
                _Row('Bus Stop', busStop, isDark),
            ]),
            const SizedBox(height: 16),
          ],
        ]),
      ),
    );
  }
}

// ─── More Info Tab ────────────────────────────────────────────────────────────

class _MoreInfoTab extends StatelessWidget {
  final dynamic student;
  final bool isDark;
  final Future<void> Function() onRefresh;
  const _MoreInfoTab(
      {required this.student, required this.isDark, required this.onRefresh});

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

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _SectionTitle('Parent / Guardian Contacts', isDark),
          if (guardians.isEmpty)
            _EmptyState('No guardian contacts added')
          else
            ...guardians.asMap().entries.map((entry) {
              final i = entry.key;
              final g = entry.value;
              final altPhone = g['alternatePhone'] ?? g['alternativeMobile'];
              final email = g['email'] as String?;
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
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
                      Flexible(
                        child: Text(g['name'] ?? '—',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.s14SemiBold(
                                color: isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                      ),
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
                    if (g['phone'] != null) ...[
                      const SizedBox(height: 4),
                      Row(children: [
                        Icon(Icons.phone_outlined,
                            size: 13, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(g['phone'],
                              style: AppTypography.s13Regular(
                                  color: AppColors.textSecondary)),
                        ),
                      ]),
                    ],
                    if (altPhone != null) ...[
                      const SizedBox(height: 2),
                      Row(children: [
                        Icon(Icons.phone_outlined,
                            size: 13, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text('$altPhone (Alt)',
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                        ),
                      ]),
                    ],
                    if (email != null && email.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(children: [
                        Icon(Icons.email_outlined,
                            size: 13, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(email,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                        ),
                      ]),
                    ],
                  ])),
                ]),
              );
            }),

          const SizedBox(height: 16),

          if (bgFields.isNotEmpty) ...[
            _SectionTitle('Background', isDark),
            _InfoCard(
                isDark: isDark,
                children:
                    bgFields.map((e) => _Row(e.key, e.value, isDark)).toList()),
            const SizedBox(height: 16),
          ],

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
                                  color: AppColors.warning
                                      .withValues(alpha: 0.3)),
                            ),
                            child: Text(c,
                                style: AppTypography.s12SemiBold(
                                    color: AppColors.warning)),
                          ))
                      .toList()),
            ),
            const SizedBox(height: 16),
          ],

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
      ),
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
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];

  static const _statusMeta = {
    'present':  {'label': 'P',  'color': Color(0xFF10B981), 'bg': Color(0xFFDCFCE7)},
    'absent':   {'label': 'A',  'color': Color(0xFFEF4444), 'bg': Color(0xFFFEE2E2)},
    'late':     {'label': 'L',  'color': Color(0xFFF59E0B), 'bg': Color(0xFFFEF3C7)},
    'half_day': {'label': 'H',  'color': Color(0xFF8B5CF6), 'bg': Color(0xFFF3E8FF)},
    'od':       {'label': 'OD', 'color': Color(0xFF0891B2), 'bg': Color(0xFFCFFAFE)},
    'cl':       {'label': 'CL', 'color': Color(0xFF0284C7), 'bg': Color(0xFFDBEAFE)},
    'sl':       {'label': 'SL', 'color': Color(0xFF7C3AED), 'bg': Color(0xFFEDE9FE)},
    'excused':  {'label': 'E',  'color': Color(0xFF6366F1), 'bg': Color(0xFFEDE9FE)},
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
      if (mounted) {
        setState(() {
          _records = res.data['records'] as List? ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _prevMonth() {
    setState(() {
      if (_month == 1) { _month = 12; _year--; } else { _month--; }
    });
    _loadRecords();
  }

  void _nextMonth() {
    final now = DateTime.now();
    if (_year > now.year || (_year == now.year && _month >= now.month)) return;
    setState(() {
      if (_month == 12) { _month = 1; _year++; } else { _month++; }
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
    const priority = ['absent','late','half_day','excused','od','cl','sl','present'];
    final result = <String, String?>{};
    map.forEach((key, statuses) {
      for (final p in priority) {
        if (statuses.contains(p)) { result[key] = p; break; }
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
    final firstDow = DateTime(_year, _month, 1).weekday % 7;
    final canNext = _year < now.year || (_year == now.year && _month < now.month);

    // Monthly counts
    int mPresent = 0, mAbsent = 0, mLate = 0;
    for (final r in _records) {
      final st = r['status'] as String? ?? '';
      if (st == 'present') { mPresent++; }
      else if (st == 'absent') { mAbsent++; }
      else if (st == 'late') { mLate++; }
    }
    final mTotal = _records.length;
    final mPct = mTotal > 0 ? ((mPresent / mTotal) * 100).round() : 0;

    return RefreshIndicator(
      onRefresh: () async {
        await _loadSummary();
        await _loadRecords();
      },
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Overall summary — 5 stats matching web
          if (_summary != null) ...[
            Row(children: [
              _StatPill('Total Days', '${_summary['total'] ?? 0}',
                  AppColors.primary, const Color(0xFFEFF6FF)),
              const SizedBox(width: 6),
              _StatPill('Present', '${_summary['present'] ?? 0}',
                  AppColors.accentGreen, const Color(0xFFF0FDF4)),
              const SizedBox(width: 6),
              _StatPill('Absent', '${_summary['absent'] ?? 0}',
                  AppColors.accentRed, const Color(0xFFFEF2F2)),
              const SizedBox(width: 6),
              _StatPill('Late', '${_summary['late'] ?? 0}',
                  AppColors.accent, const Color(0xFFFFFBEB)),
              const SizedBox(width: 6),
              _StatPill(
                  'Overall',
                  '${_summary['percentage'] ?? 0}%',
                  (_summary['percentage'] as num? ?? 0) >= 75
                      ? AppColors.accentGreen
                      : (_summary['percentage'] as num? ?? 0) >= 50
                          ? AppColors.accent
                          : AppColors.accentRed,
                  (_summary['percentage'] as num? ?? 0) >= 75
                      ? const Color(0xFFF0FDF4)
                      : const Color(0xFFFEF2F2)),
            ]),
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
                      color: widget.isDark ? Colors.white : AppColors.textPrimary)),
              IconButton(
                onPressed: canNext ? _nextMonth : null,
                icon: Icon(Icons.chevron_right,
                    color: canNext ? null : AppColors.textMuted),
                iconSize: 22,
                padding: EdgeInsets.zero,
              ),
            ]),
            // Monthly chips
            Wrap(spacing: 4, children: [
              if (mPresent > 0)
                _MiniChip('P: $mPresent', const Color(0xFF10B981), const Color(0xFFDCFCE7)),
              if (mAbsent > 0)
                _MiniChip('A: $mAbsent', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
              if (mLate > 0)
                _MiniChip('L: $mLate', const Color(0xFFF59E0B), const Color(0xFFFEF3C7)),
              if (mTotal > 0)
                _MiniChip(
                  '$mPct%',
                  mPct >= 75
                      ? const Color(0xFF166534)
                      : mPct >= 50
                          ? const Color(0xFF92400E)
                          : const Color(0xFFDC2626),
                  mPct >= 75
                      ? const Color(0xFFDCFCE7)
                      : mPct >= 50
                          ? const Color(0xFFFEF3C7)
                          : const Color(0xFFFEE2E2),
                ),
            ]),
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
              Container(
                decoration: BoxDecoration(
                  color: widget.isDark
                      ? AppColors.borderDark.withValues(alpha: 0.3)
                      : const Color(0xFFF8FAFC),
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(14)),
                ),
                child: Row(
                    children: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
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
                  padding: EdgeInsets.all(16),
                  child: SkeletonShimmer(
                    child: SkeletonBox(
                        width: double.infinity, height: 200, radius: 8),
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
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
                            ? Border.all(
                                color: AppColors.primary, width: 1.5)
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

          // Daily records list
          if (_records.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('DAILY RECORDS',
                    style: AppTypography.s12SemiBold(
                        color: widget.isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary)),
                Text('${_records.length} entries',
                    style: AppTypography.s12Regular(
                        color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(height: 8),
            ..._records.map((r) {
              final dateStr = r['date'] as String? ?? '';
              final d = dateStr.isNotEmpty ? DateTime.tryParse(dateStr) : null;
              final dateFmt =
                  d != null ? DateFormat('dd MMM yyyy').format(d) : '—';
              final dayFmt =
                  d != null ? DateFormat('EEE').format(d) : '';
              final st = r['status'] as String? ?? '';
              final meta = _statusMeta[st];
              final period = r['period'];
              final subjectName = r['subject'] is Map
                  ? r['subject']['name'] as String? ?? ''
                  : '';
              final markedByName = r['markedBy'] is Map
                  ? r['markedBy']['name'] as String? ?? ''
                  : '';
              final remarks = r['remarks'] as String? ?? '';
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: widget.isDark
                      ? AppColors.cardDark
                      : Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: widget.isDark
                          ? AppColors.borderDark
                          : AppColors.borderLight),
                ),
                child: Row(children: [
                  if (meta != null)
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: (meta['bg'] as Color)
                            .withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Text(meta['label'] as String,
                          style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: meta['color'] as Color)),
                    ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Row(children: [
                        Text(dateFmt,
                            style: AppTypography.s13SemiBold(
                                color: widget.isDark
                                    ? Colors.white
                                    : AppColors.textPrimary)),
                        if (dayFmt.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Text(dayFmt,
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                        ],
                      ]),
                      if (period != null || subjectName.isNotEmpty)
                        Text(
                          [
                            if (period != null) 'Period $period',
                            if (subjectName.isNotEmpty) subjectName,
                          ].join(' · '),
                          style: AppTypography.s12Regular(
                              color: AppColors.textMuted),
                        ),
                      if (markedByName.isNotEmpty)
                        Text('By: $markedByName',
                            style: AppTypography.s12Regular(
                                color: AppColors.textMuted)),
                      if (remarks.isNotEmpty)
                        Text(remarks,
                            style: AppTypography.s12Regular(
                                    color: AppColors.textMuted)
                                .copyWith(
                                    fontStyle: FontStyle.italic)),
                    ]),
                  ),
                ]),
              );
            }),
          ],
        ]),
      ),
    );
  }
}

// ─── Exam Results Tab ─────────────────────────────────────────────────────────

class _ExamsTab extends StatefulWidget {
  final String studentId;
  final bool isDark;
  const _ExamsTab({required this.studentId, required this.isDark});

  @override
  State<_ExamsTab> createState() => _ExamsTabState();
}

class _ExamsTabState extends State<_ExamsTab> {
  List<dynamic> _results = [];
  String? _selectedId;
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
      if (mounted) {
        final list = res.data['results'] as List? ?? [];
        setState(() {
          _results = list;
          _selectedId =
              list.isNotEmpty ? list[0]['_id'] as String? : null;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SkeletonList(showLeading: false);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _results.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                _EmptyState('No exam results found'),
              ],
            )
          : SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                // Exam selector pills
                if (_results.length > 1) ...[
                  Wrap(spacing: 8, runSpacing: 8, children: _results.map((r) {
                    final id = r['_id'] as String?;
                    final examName =
                        r['exam'] is Map ? r['exam']['name'] as String? ?? 'Exam' : 'Exam';
                    final isActive = id == _selectedId;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedId = id),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isActive
                              ? AppColors.primary
                              : (widget.isDark
                                  ? AppColors.cardDark
                                  : Colors.white),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: isActive
                                  ? AppColors.primary
                                  : AppColors.borderLight,
                              width: 1.5),
                        ),
                        child: Text(examName,
                            style: AppTypography.s13SemiBold(
                                color: isActive
                                    ? Colors.white
                                    : AppColors.textSecondary)),
                      ),
                    );
                  }).toList()),
                  const SizedBox(height: 16),
                ],

                // Selected exam detail
                Builder(builder: (_) {
                  final result = _results.firstWhere(
                      (r) => r['_id'] == _selectedId,
                      orElse: () => _results.isNotEmpty ? _results[0] : null);
                  if (result == null) return const SizedBox.shrink();

                  final exam = result['exam'];
                  final examName = exam is Map
                      ? exam['name'] as String? ?? 'Exam'
                      : 'Exam';
                  final examType = exam is Map ? exam['type'] as String? : null;
                  final isPublished = result['isPublished'] as bool? ?? false;
                  final academicYear = result['academicYear'] as String?;
                  final totalObtained = result['totalMarksObtained'];
                  final totalMax = result['totalMaxMarks'];
                  final percentage = result['percentage'];
                  final grade = result['grade'] as String?;
                  final rank = result['rank'];
                  final marks = result['marks'] as List? ?? [];

                  final failCount = marks
                      .where((m) =>
                          !(m['isAbsent'] as bool? ?? false) &&
                          (m['totalMarks'] as num? ?? 0) <
                              (m['passingMarks'] as num? ?? 0))
                      .length;
                  final absentCount =
                      marks.where((m) => m['isAbsent'] as bool? ?? false).length;
                  final overallPass =
                      failCount == 0 && absentCount == 0 && marks.isNotEmpty;

                  return Container(
                    decoration: BoxDecoration(
                      color: widget.isDark ? AppColors.cardDark : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: widget.isDark
                              ? AppColors.borderDark
                              : AppColors.borderLight),
                      boxShadow: widget.isDark ? [] : AppColors.shadowSm,
                    ),
                    child: Column(children: [
                      // Exam header
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: widget.isDark
                              ? AppColors.borderDark.withValues(alpha: 0.3)
                              : const Color(0xFFF8FAFC),
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(14)),
                          border: Border(
                              bottom: BorderSide(
                                  color: widget.isDark
                                      ? AppColors.borderDark
                                      : AppColors.borderLight)),
                        ),
                        child: Row(children: [
                          Expanded(
                              child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                            Wrap(spacing: 6, children: [
                              Text(examName,
                                  style: AppTypography.s14SemiBold(
                                      color: widget.isDark
                                          ? Colors.white
                                          : AppColors.textPrimary)),
                              if (examType != null)
                                _Chip(examType,
                                    bg: AppColors.badgeInfoBg,
                                    fg: AppColors.primary),
                              _Chip(
                                  isPublished ? 'Published' : 'Pending',
                                  bg: isPublished
                                      ? AppColors.badgeSuccessBg
                                      : const Color(0xFFF1F5F9),
                                  fg: isPublished
                                      ? AppColors.accentGreen
                                      : AppColors.textMuted),
                            ]),
                            if (academicYear != null) ...[
                              const SizedBox(height: 3),
                              Text('Academic Year: $academicYear',
                                  style: AppTypography.s12Regular(
                                      color: AppColors.textMuted)),
                            ],
                          ])),
                        ]),
                      ),

                      // Summary strip
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(children: [
                          _ExamStat(
                            'Total Marks',
                            totalObtained != null && totalMax != null
                                ? '$totalObtained / $totalMax'
                                : '—',
                          ),
                          _ExamStat(
                            'Percentage',
                            percentage != null ? '$percentage%' : '—',
                          ),
                          _ExamStat('Grade', grade ?? '—'),
                          _ExamStat(
                              'Rank', rank != null ? '#$rank' : '—'),
                          _ExamStat(
                            'Result',
                            marks.isEmpty
                                ? '—'
                                : overallPass
                                    ? 'PASS'
                                    : 'FAIL',
                            color: marks.isEmpty
                                ? null
                                : overallPass
                                    ? AppColors.accentGreen
                                    : AppColors.accentRed,
                          ),
                        ]),
                      ),

                      // Subject marks
                      if (marks.isEmpty)
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Center(
                            child: Text('Marks not entered yet.',
                                style: AppTypography.s13Regular(
                                    color: AppColors.textMuted)),
                          ),
                        )
                      else
                        ...marks.asMap().entries.map((entry) {
                          final m = entry.value;
                          final subjectName = m['subject'] is Map
                              ? m['subject']['name'] as String? ?? '—'
                              : '—';
                          final isAbsent = m['isAbsent'] as bool? ?? false;
                          final theory = m['theoryMarks'];
                          final practical = m['practicalMarks'];
                          final total = m['totalMarks'];
                          final maxM = m['maxMarks'];
                          final passing = m['passingMarks'] as num? ?? 0;
                          final g = m['grade'] as String?;
                          final pct = (maxM != null && maxM != 0 && total != null)
                              ? ((total / maxM) * 100).round()
                              : null;
                          final passed = !isAbsent && (total as num? ?? 0) >= passing;

                          return Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border(
                                top: BorderSide(
                                    color: widget.isDark
                                        ? AppColors.borderDark
                                        : const Color(0xFFF1F5F9)),
                              ),
                            ),
                            child: Row(children: [
                              Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                Text(subjectName,
                                    style: AppTypography.s13SemiBold(
                                        color: widget.isDark
                                            ? Colors.white
                                            : AppColors.textPrimary)),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    if (theory != null && !isAbsent)
                                      'T: $theory',
                                    if (practical != null && !isAbsent)
                                      'P: $practical',
                                    if (maxM != null)
                                      'Max: $maxM',
                                    if (g != null) 'Grade: $g',
                                  ].join('  '),
                                  style: AppTypography.s12Regular(
                                      color: AppColors.textMuted),
                                ),
                              ])),
                              Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.end,
                                  children: [
                                if (isAbsent)
                                  _Chip('Absent',
                                      bg: const Color(0xFFF1F5F9),
                                      fg: AppColors.textMuted)
                                else ...[
                                  Text(
                                    total != null && maxM != null
                                        ? '$total / $maxM'
                                        : '—',
                                    style: AppTypography.s13SemiBold(
                                        color: AppColors.primary),
                                  ),
                                  if (pct != null)
                                    Text('$pct%',
                                        style:
                                            AppTypography.s12SemiBold(
                                                color: pct >= 75
                                                    ? AppColors.accentGreen
                                                    : pct >= 40
                                                        ? AppColors.accent
                                                        : AppColors
                                                            .accentRed)),
                                ],
                                const SizedBox(height: 4),
                                _Chip(
                                    isAbsent
                                        ? 'Absent'
                                        : passed
                                            ? 'Pass'
                                            : 'Fail',
                                    bg: isAbsent
                                        ? const Color(0xFFF1F5F9)
                                        : passed
                                            ? AppColors.badgeSuccessBg
                                            : AppColors.badgeDangerBg,
                                    fg: isAbsent
                                        ? AppColors.textMuted
                                        : passed
                                            ? AppColors.accentGreen
                                            : AppColors.accentRed),
                              ]),
                            ]),
                          );
                        }),
                    ]),
                  );
                }),
              ]),
            ),
    );
  }
}

// ─── Home Works Tab ───────────────────────────────────────────────────────────

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
  String _filter = 'all';

  static const _statusMeta = {
    'completed':   {'label': 'Completed',   'color': Color(0xFF10B981), 'bg': Color(0xFFD1FAE5)},
    'in_progress': {'label': 'In Progress', 'color': Color(0xFFF59E0B), 'bg': Color(0xFFFEF3C7)},
    'overdue':     {'label': 'Overdue',     'color': Color(0xFFEF4444), 'bg': Color(0xFFFEE2E2)},
    'pending':     {'label': 'Pending',     'color': Color(0xFF64748B), 'bg': Color(0xFFF1F5F9)},
  };

  String _deriveStatus(dynamic hw) {
    final sub = hw['submission'];
    if (sub is Map) {
      if (sub['status'] == 'completed') return 'completed';
      if (sub['status'] == 'in_progress') return 'in_progress';
    }
    final dueStr = hw['dueDate'] as String?;
    if (dueStr != null) {
      final due = DateTime.tryParse(dueStr);
      if (due != null && due.isBefore(DateTime.now())) return 'overdue';
    }
    return 'pending';
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/homework/student-summary',
          params: {'studentId': widget.studentId});
      if (mounted) {
        setState(() {
          _hw = res.data['homework'] as List? ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SkeletonList(showLeading: false);

    final counts = <String, int>{'all': _hw.length};
    for (final hw in _hw) {
      final s = _deriveStatus(hw);
      counts[s] = (counts[s] ?? 0) + 1;
    }

    final filtered = _filter == 'all'
        ? _hw
        : _hw.where((hw) => _deriveStatus(hw) == _filter).toList();

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Filter chips
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final f in [
              {'key': 'all',         'label': 'All'},
              {'key': 'pending',     'label': 'Pending'},
              {'key': 'in_progress', 'label': 'In Progress'},
              {'key': 'completed',   'label': 'Completed'},
              {'key': 'overdue',     'label': 'Overdue'},
            ])
              GestureDetector(
                onTap: () => setState(() => _filter = f['key']!),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: _filter == f['key']
                        ? AppColors.primary.withValues(alpha: 0.1)
                        : (widget.isDark
                            ? AppColors.cardDark
                            : Colors.white),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: _filter == f['key']
                            ? AppColors.primary
                            : AppColors.borderLight),
                  ),
                  child: Text(
                    '${f['label']} (${counts[f['key']] ?? 0})',
                    style: AppTypography.s12SemiBold(
                        color: _filter == f['key']
                            ? AppColors.primary
                            : AppColors.textSecondary),
                  ),
                ),
              ),
          ]),
          const SizedBox(height: 16),

          if (filtered.isEmpty)
            _EmptyState('No homeworks found')
          else
            ...filtered.map((hw) {
              final status = _deriveStatus(hw);
              final meta = _statusMeta[status]!;
              final subject = hw['subject'] is Map
                  ? hw['subject']['name'] as String? ?? ''
                  : '';
              final description = hw['description'] as String? ?? '';
              final dueStr = hw['dueDate'] as String?;
              final assignedStr = hw['assignedDate'] as String?;
              final dueFmt = dueStr != null ? _fmtDate(dueStr) : '—';
              final assignedFmt =
                  assignedStr != null ? _fmtDate(assignedStr) : null;
              final isOverdue = status == 'overdue';
              final createdBy = hw['createdBy'] is Map
                  ? hw['createdBy']['name'] as String? ?? ''
                  : '';
              final sub = hw['submission'];

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color:
                      widget.isDark ? AppColors.cardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: widget.isDark
                          ? AppColors.borderDark
                          : AppColors.borderLight),
                  boxShadow: widget.isDark ? [] : AppColors.shadowSm,
                ),
                child: Column(children: [
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Expanded(
                          child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                        Wrap(spacing: 6, children: [
                          Text(hw['title'] as String? ?? '—',
                              style: AppTypography.s14SemiBold(
                                  color: widget.isDark
                                      ? Colors.white
                                      : AppColors.textPrimary)),
                          if (subject.isNotEmpty)
                            _Chip(subject,
                                bg: AppColors.primary
                                    .withValues(alpha: 0.08),
                                fg: AppColors.primary),
                        ]),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(description,
                              style: AppTypography.s13Regular(
                                  color: AppColors.textSecondary),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                        ],
                        const SizedBox(height: 6),
                        Wrap(spacing: 12, children: [
                          if (assignedFmt != null)
                            Text('Assigned: $assignedFmt',
                                style: AppTypography.s12Regular(
                                    color: AppColors.textMuted)),
                          Text('Due: $dueFmt',
                              style: AppTypography.s12Regular(
                                  color: isOverdue
                                      ? AppColors.accentRed
                                      : AppColors.textMuted)
                                  .copyWith(
                                      fontWeight: isOverdue
                                          ? FontWeight.w600
                                          : null)),
                          if (createdBy.isNotEmpty)
                            Text('By: $createdBy',
                                style: AppTypography.s12Regular(
                                    color: AppColors.textMuted)),
                        ]),
                      ])),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: meta['bg'] as Color,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(meta['label'] as String,
                            style: AppTypography.s12SemiBold(
                                color: meta['color'] as Color)),
                      ),
                    ]),
                  ),
                  // Submission info
                  if (sub is Map) ...[
                    Container(
                      decoration: BoxDecoration(
                        color: widget.isDark
                            ? AppColors.borderDark
                                .withValues(alpha: 0.2)
                            : const Color(0xFFFAFAFA),
                        borderRadius: const BorderRadius.vertical(
                            bottom: Radius.circular(12)),
                        border: Border(
                          top: BorderSide(
                              color: widget.isDark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight),
                        ),
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                        if (sub['note'] != null &&
                            (sub['note'] as String).isNotEmpty)
                          Text('"${sub['note']}"',
                              style: AppTypography.s13Regular(
                                      color: AppColors.textSecondary)
                                  .copyWith(
                                      fontStyle: FontStyle.italic)),
                        if (sub['submittedAt'] != null)
                          Text(
                              'Submitted: ${_fmtDate(sub['submittedAt'])}',
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                      ]),
                    ),
                  ],
                ]),
              );
            }),
        ]),
      ),
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
  List<dynamic> _feeRecords = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/fees',
          params: {'studentId': widget.studentId, 'limit': '50'});
      if (mounted) {
        setState(() {
          _feeRecords = res.data['fees'] as List? ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SkeletonList(showLeading: false);

    final totalAmount = _feeRecords.fold<num>(
        0, (s, f) => s + ((f['netAmount'] ?? f['totalAmount'] ?? 0) as num));
    final totalPaid = _feeRecords.fold<num>(
        0, (s, f) => s + ((f['paidAmount'] ?? 0) as num));
    final totalPending = _feeRecords.fold<num>(
        0, (s, f) => s + ((f['pendingAmount'] ?? 0) as num));

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Summary strip
          if (_feeRecords.isNotEmpty) ...[
            Row(children: [
              Expanded(
                  child: _FeeStatCard('Total Amount',
                      '₹${totalAmount.toStringAsFixed(0)}',
                      AppColors.primary, AppColors.badgeInfoBg)),
              const SizedBox(width: 8),
              Expanded(
                  child: _FeeStatCard('Total Paid',
                      '₹${totalPaid.toStringAsFixed(0)}',
                      AppColors.accentGreen, AppColors.badgeSuccessBg)),
              const SizedBox(width: 8),
              Expanded(
                  child: _FeeStatCard(
                      'Pending',
                      '₹${totalPending.toStringAsFixed(0)}',
                      totalPending > 0
                          ? AppColors.accentRed
                          : AppColors.accentGreen,
                      totalPending > 0
                          ? AppColors.badgeDangerBg
                          : AppColors.badgeSuccessBg)),
            ]),
            const SizedBox(height: 20),
          ],

          if (_feeRecords.isEmpty)
            _EmptyState('No fee records found')
          else
            ..._feeRecords.map((fee) {
              final academicYear = fee['academicYear'] as String?;
              final feeStatus = fee['status'] as String? ?? '';
              final terms = fee['terms'] as List? ?? [];
              final payments = fee['payments'] as List? ?? [];

              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: widget.isDark ? AppColors.cardDark : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: widget.isDark
                          ? AppColors.borderDark
                          : AppColors.borderLight),
                  boxShadow: widget.isDark ? [] : AppColors.shadowSm,
                ),
                child: Column(children: [
                  // Record header
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: widget.isDark
                          ? AppColors.borderDark.withValues(alpha: 0.3)
                          : const Color(0xFFF8FAFC),
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(14)),
                      border: Border(
                          bottom: BorderSide(
                              color: widget.isDark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight)),
                    ),
                    child: Row(children: [
                      Expanded(
                          child: Text(
                              'Academic Year: ${academicYear ?? '—'}',
                              style: AppTypography.s14SemiBold(
                                  color: widget.isDark
                                      ? Colors.white
                                      : AppColors.textPrimary))),
                      if (feeStatus.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: feeStatus == 'paid'
                                ? AppColors.badgeSuccessBg
                                : feeStatus == 'partial'
                                    ? const Color(0xFFFEF9C3)
                                    : AppColors.badgeDangerBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                              feeStatus[0].toUpperCase() +
                                  feeStatus.substring(1),
                              style: AppTypography.s12SemiBold(
                                  color: feeStatus == 'paid'
                                      ? AppColors.accentGreen
                                      : feeStatus == 'partial'
                                          ? const Color(0xFF92400E)
                                          : AppColors.accentRed)),
                        ),
                    ]),
                  ),

                  // Terms breakdown
                  if (terms.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
                      child: Row(children: [
                        Expanded(
                            flex: 3,
                            child: Text('Category',
                                style: AppTypography.s11Regular(
                                    color: AppColors.textMuted)
                                    .copyWith(fontWeight: FontWeight.w600))),
                        Expanded(
                            flex: 2,
                            child: Text('Net',
                                textAlign: TextAlign.right,
                                style: AppTypography.s11Regular(
                                    color: AppColors.textMuted)
                                    .copyWith(fontWeight: FontWeight.w600))),
                        Expanded(
                            flex: 2,
                            child: Text('Paid',
                                textAlign: TextAlign.right,
                                style: AppTypography.s11Regular(
                                    color: AppColors.textMuted)
                                    .copyWith(fontWeight: FontWeight.w600))),
                        Expanded(
                            flex: 2,
                            child: Text('Pending',
                                textAlign: TextAlign.right,
                                style: AppTypography.s11Regular(
                                    color: AppColors.textMuted)
                                    .copyWith(fontWeight: FontWeight.w600))),
                      ]),
                    ),
                    ...terms.map((t) {
                      final net = (t['netAmount'] as num? ?? 0);
                      final paid = (t['paidAmount'] as num? ?? 0);
                      final pending = (t['pendingAmount'] as num? ?? 0);
                      final tStatus = t['status'] as String? ?? '';
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          border: Border(
                              top: BorderSide(
                                  color: widget.isDark
                                      ? AppColors.borderDark
                                      : const Color(0xFFF1F5F9))),
                        ),
                        child: Row(children: [
                          Expanded(
                              flex: 3,
                              child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                Text(t['name'] as String? ?? '—',
                                    style: AppTypography.s13SemiBold(
                                        color: widget.isDark
                                            ? Colors.white
                                            : AppColors.textPrimary)),
                                if (tStatus.isNotEmpty)
                                  Text(
                                      tStatus[0].toUpperCase() +
                                          tStatus.substring(1),
                                      style: AppTypography.s11Regular(
                                          color: tStatus == 'paid'
                                              ? AppColors.accentGreen
                                              : tStatus == 'partial'
                                                  ? AppColors.accent
                                                  : AppColors.accentRed)),
                              ])),
                          Expanded(
                              flex: 2,
                              child: Text('₹$net',
                                  textAlign: TextAlign.right,
                                  style: AppTypography.s13Regular(
                                      color: widget.isDark
                                          ? Colors.white70
                                          : AppColors.textSecondary))),
                          Expanded(
                              flex: 2,
                              child: Text('₹$paid',
                                  textAlign: TextAlign.right,
                                  style: AppTypography.s13Regular(
                                      color: AppColors.accentGreen))),
                          Expanded(
                              flex: 2,
                              child: Text('₹$pending',
                                  textAlign: TextAlign.right,
                                  style: AppTypography.s13Regular(
                                      color: pending > 0
                                          ? AppColors.accentRed
                                          : AppColors.accentGreen))),
                        ]),
                      );
                    }),

                    // Totals row
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: widget.isDark
                            ? AppColors.borderDark.withValues(alpha: 0.2)
                            : const Color(0xFFF8FAFC),
                        border: Border(
                            top: BorderSide(
                                color: widget.isDark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight,
                                width: 1.5)),
                      ),
                      child: Row(children: [
                        const Expanded(
                            flex: 3,
                            child: Text('Total',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13))),
                        Expanded(
                            flex: 2,
                            child: Text(
                                '₹${fee['netAmount'] ?? fee['totalAmount'] ?? 0}',
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13))),
                        Expanded(
                            flex: 2,
                            child: Text(
                                '₹${fee['paidAmount'] ?? 0}',
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: Color(0xFF10B981)))),
                        Expanded(
                            flex: 2,
                            child: Text(
                                '₹${fee['pendingAmount'] ?? 0}',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: (fee['pendingAmount'] as num? ?? 0) > 0
                                        ? AppColors.accentRed
                                        : AppColors.accentGreen))),
                      ]),
                    ),
                  ],

                  // Payment history
                  if (payments.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
                      decoration: BoxDecoration(
                        border: Border(
                            top: BorderSide(
                                color: widget.isDark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight)),
                      ),
                      child: Text(
                          'PAYMENT HISTORY (${payments.length})',
                          style: AppTypography.s11Regular(
                                  color: AppColors.textMuted)
                              .copyWith(fontWeight: FontWeight.w600,
                                  letterSpacing: 0.5)),
                    ),
                    ...payments.map((p) {
                      final paidAt = p['paidAt'] as String?;
                      final dateFmt =
                          paidAt != null ? _fmtDate(paidAt) : '—';
                      final method =
                          (p['method'] as String? ?? '').replaceAll('_', ' ');
                      final termName = p['termName'] as String?;
                      final amount = p['amount'] as num? ?? 0;
                      return Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        child: Row(children: [
                          Expanded(
                              child: Text(
                                  [
                                    if (termName != null &&
                                        termName.isNotEmpty)
                                      termName,
                                    if (method.isNotEmpty) method,
                                  ].join(' · '),
                                  style: AppTypography.s13Regular(
                                      color: widget.isDark
                                          ? Colors.white70
                                          : AppColors.textSecondary))),
                          Text(dateFmt,
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                          const SizedBox(width: 12),
                          Text('+₹$amount',
                              style: AppTypography.s13SemiBold(
                                  color: AppColors.accentGreen)),
                        ]),
                      );
                    }),
                    const SizedBox(height: 6),
                  ],
                ]),
              );
            }),
        ]),
      ),
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
                  style:
                      AppTypography.s13Regular(color: AppColors.textMuted))),
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
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.2))),
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 16, fontWeight: FontWeight.w700, color: color)),
          Text(label,
              style: AppTypography.s11Regular(color: AppColors.textMuted),
              textAlign: TextAlign.center),
        ]),
      ));
}

class _MiniChip extends StatelessWidget {
  final String text;
  final Color color, bg;
  const _MiniChip(this.text, this.color, this.bg);

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
            color: bg, borderRadius: BorderRadius.circular(20)),
        child: Text(text,
            style: GoogleFonts.inter(
                fontSize: 11, fontWeight: FontWeight.w600, color: color)),
      );
}

class _ExamStat extends StatelessWidget {
  final String label, value;
  final Color? color;
  const _ExamStat(this.label, this.value, {this.color});

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: color ?? AppColors.textPrimary),
              textAlign: TextAlign.center),
          Text(label,
              style:
                  AppTypography.s11Regular(color: AppColors.textMuted),
              textAlign: TextAlign.center),
        ]),
      );
}

class _FeeStatCard extends StatelessWidget {
  final String label, value;
  final Color color, bg;
  const _FeeStatCard(this.label, this.value, this.color, this.bg);

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 16, fontWeight: FontWeight.w700, color: color)),
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
