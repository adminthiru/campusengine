import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/student.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/empty_state.dart';

const _studentStatuses = [
  _StatusOption('P', 'present',  'Present',  kSuccess,          Color(0xFFF0FDF4)),
  _StatusOption('A', 'absent',   'Absent',   kDanger,           Color(0xFFFEF2F2)),
  _StatusOption('H', 'half_day', 'Half Day', Color(0xFFF97316), Color(0xFFFFF7ED)),
  _StatusOption('L', 'late',     'Late',     kWarning,          Color(0xFFFFFBEB)),
  _StatusOption('E', 'excused',  'Excused',  Color(0xFF6366F1), Color(0xFFEEF2FF)),
];

class _StatusOption {
  final String label;
  final String key;
  final String fullLabel;
  final Color color;
  final Color bg;
  const _StatusOption(this.label, this.key, this.fullLabel, this.color, this.bg);
}

_StatusOption _optFor(String key) => _studentStatuses.firstWhere(
  (o) => o.key == key, orElse: () => _studentStatuses.first);

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  DateTime _selectedDate = DateTime.now();
  List<Student> _students = [];

  // studentId → { status, remarks }
  Map<String, Map<String, String>> _attMap = {};

  bool _loadingStudents = false;
  bool _submitting = false;
  bool _saved = false;       // attendance saved for current date
  bool _ownMarked = false;
  String _ownStatus = 'present';

  @override
  void initState() {
    super.initState();
    final profile = context.read<TeacherProfileProvider>();
    final showStudentTab = profile.isClassTeacher &&
        (profile.profile?.permissions.classTeacher.markStudentAttendance ?? false);
    _tab = TabController(length: showStudentTab ? 2 : 1, vsync: this);
    if (showStudentTab) _fetchStudents();
    _checkOwnAttendance();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _fetchStudents() async {
    final profile = context.read<TeacherProfileProvider>();
    final classId = profile.profile?.classTeacher?.classInfo.id;
    if (classId == null) return;
    setState(() => _loadingStudents = true);
    try {
      final res = await ApiClient.get('/students', params: {'classId': classId, 'limit': '200'});
      final list = (res.data['students'] as List? ?? [])
          .map((s) => Student.fromJson(s)).toList();

      // Load existing attendance for selected date
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      Map<String, Map<String, String>> existing = {};
      bool alreadySaved = false;
      try {
        final attRes = await ApiClient.get('/attendance', params: {
          'type': 'student', 'classId': classId, 'date': dateStr,
        });
        // Backend returns { attendance: [ { records: [...] } ] }
        final attendanceList = attRes.data['attendance'] as List? ?? [];
        final records = attendanceList.isNotEmpty
            ? (attendanceList.first['records'] as List? ?? [])
            : <dynamic>[];
        if (records.isNotEmpty) alreadySaved = true;
        for (final r in records) {
          final id = r['student']?['_id'] ?? r['student'];
          if (id != null) {
            existing[id.toString()] = {
              'status': r['status'] ?? 'present',
              'remarks': r['remarks'] ?? '',
            };
          }
        }
      } catch (_) {}

      setState(() {
        _students = list;
        _attMap = {
          for (final s in list)
            s.id: existing[s.id] ?? {'status': 'present', 'remarks': ''}
        };
        _saved = alreadySaved;
      });
    } catch (e) {
      _showSnack(ApiClient.errorMessage(e), isError: true);
    }
    setState(() => _loadingStudents = false);
  }

  Future<void> _checkOwnAttendance() async {
    final employeeMongoId = context.read<TeacherProfileProvider>().profile?.employee.id;
    if (employeeMongoId == null || employeeMongoId.isEmpty) return;
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final res = await ApiClient.get('/attendance', params: {
        'type': 'employee', 'date': dateStr,
      });
      // Find this employee's record in the returned attendance
      final attendanceList = res.data['attendance'] as List? ?? [];
      String? foundStatus;
      for (final att in attendanceList) {
        final recs = att['records'] as List? ?? [];
        for (final r in recs) {
          final empId = r['employee']?['_id'] ?? r['employee'];
          if (empId?.toString() == employeeMongoId) {
            foundStatus = r['status'];
            break;
          }
        }
        if (foundStatus != null) break;
      }
      setState(() {
        _ownMarked = foundStatus != null;
        if (foundStatus != null) _ownStatus = foundStatus;
      });
    } catch (_) {}
  }

  Future<void> _submitStudentAttendance() async {
    setState(() => _submitting = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final profile = context.read<TeacherProfileProvider>();
      final classId = profile.profile?.classTeacher?.classInfo.id;
      final records = _attMap.entries.map((e) => {
        'student': e.key,
        'status': e.value['status'] ?? 'present',
        if ((e.value['remarks'] ?? '').isNotEmpty) 'remarks': e.value['remarks'],
      }).toList();
      await ApiClient.post('/attendance/student', data: {
        'date': dateStr, 'classId': classId, 'records': records,
      });
      setState(() => _saved = true);
      _showSnack('Attendance saved successfully!');
    } catch (e) {
      _showSnack(ApiClient.errorMessage(e), isError: true);
    }
    setState(() => _submitting = false);
  }

  Future<void> _submitOwnAttendance() async {
    setState(() => _submitting = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      // Use Employee MongoDB _id (not employeeId string) — matches admin format
      final employeeMongoId = context.read<TeacherProfileProvider>().profile?.employee.id;
      await ApiClient.post('/attendance/employee', data: {
        'date': dateStr,
        'records': [
          {'employee': employeeMongoId, 'status': _ownStatus}
        ],
      });
      setState(() => _ownMarked = true);
      _showSnack('Your attendance marked!');
    } catch (e) {
      _showSnack(ApiClient.errorMessage(e), isError: true);
    }
    setState(() => _submitting = false);
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? kDanger : kSuccess,
    ));
  }

  Widget _dateBar() {
    return Container(
      color: kCardBg,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          const Icon(Icons.calendar_today_outlined, size: 16, color: kTextMuted),
          const SizedBox(width: 8),
          Text(DateFormat('EEE, dd MMM yyyy').format(_selectedDate),
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary)),
          const Spacer(),
          TextButton(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime.now().subtract(const Duration(days: 90)),
                lastDate: DateTime.now(),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme: const ColorScheme.light(primary: kPrimary),
                  ),
                  child: child!,
                ),
              );
              if (picked != null) {
                setState(() {
                  _selectedDate = picked;
                  _ownMarked = false;
                  _saved = false;
                  _attMap = {for (final s in _students) s.id: {'status': 'present', 'remarks': ''}};
                });
                _checkOwnAttendance();
                if (_students.isNotEmpty) _fetchStudents();
              }
            },
            child: const Text('Change', style: TextStyle(color: kPrimary, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  // Legend row: P · Present  A · Absent  ...
  Widget _legend() {
    return Container(
      color: kCardBg,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _studentStatuses.map((o) => Padding(
            padding: const EdgeInsets.only(right: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 22, height: 22,
                  decoration: BoxDecoration(
                    color: o.color, borderRadius: BorderRadius.circular(5),
                  ),
                  child: Center(
                    child: Text(o.label, style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white,
                    )),
                  ),
                ),
                const SizedBox(width: 5),
                Text(o.fullLabel, style: const TextStyle(
                  fontSize: 12, color: kTextSecondary,
                )),
              ],
            ),
          )).toList(),
        ),
      ),
    );
  }

  Widget _ownTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _dateBar(),
          const SizedBox(height: 16),
          if (_ownMarked)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kSuccessLight, borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: kSuccess),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('Attendance marked: ${_optFor(_ownStatus).fullLabel}',
                        style: const TextStyle(
                            color: kSuccess, fontWeight: FontWeight.w600)),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _ownMarked = false),
                    child: const Text('Edit', style: TextStyle(color: kPrimary)),
                  ),
                ],
              ),
            )
          else ...[
            _OwnStatusGrid(
              selected: _ownStatus,
              onChanged: (v) => setState(() => _ownStatus = v),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity, height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submitOwnAttendance,
                child: _submitting
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Mark My Attendance'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _studentTab() {
    if (_loadingStudents) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }
    if (_students.isEmpty) {
      return const EmptyState(icon: Icons.groups, title: 'No students found');
    }

    // Summary counts when saved
    Map<String, int> counts = {};
    if (_saved) {
      for (final v in _attMap.values) {
        final s = v['status'] ?? 'present';
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }

    return Column(
      children: [
        _dateBar(),
        _legend(),

        // Saved banner
        if (_saved)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: kSuccessLight,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: kSuccess, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Wrap(
                    spacing: 8, runSpacing: 4,
                    children: counts.entries.map((e) {
                      final opt = _optFor(e.key);
                      return Text('${opt.fullLabel}: ${e.value}',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600,
                              color: opt.color));
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 80),
            itemCount: _students.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final s = _students[i];
              final entry = _attMap[s.id] ?? {'status': 'present', 'remarks': ''};
              final currentStatus = entry['status'] ?? 'present';
              final opt = _optFor(currentStatus);

              return Container(
                decoration: BoxDecoration(
                  color: kCardBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _saved ? opt.color.withValues(alpha: 0.3) : kBorder),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: opt.bg,
                          child: Text(s.name[0], style: TextStyle(
                            color: opt.color, fontWeight: FontWeight.w700,
                          )),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s.name, style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600,
                                color: kTextPrimary,
                              )),
                              if (s.admissionNumber != null)
                                Text(s.admissionNumber!, style: const TextStyle(
                                  fontSize: 11, color: kTextMuted,
                                )),
                            ],
                          ),
                        ),

                        // Saved: show full status badge. Editing: show P A H L E chips
                        if (_saved)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: opt.bg,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: opt.color.withValues(alpha: 0.4)),
                            ),
                            child: Text(opt.fullLabel, style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700,
                              color: opt.color,
                            )),
                          )
                        else
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: _studentStatuses.map((o) {
                              final sel = currentStatus == o.key;
                              return GestureDetector(
                                onTap: () => setState(() =>
                                    _attMap[s.id] = {...entry, 'status': o.key}),
                                child: Container(
                                  width: 34, height: 34,
                                  margin: const EdgeInsets.only(left: 5),
                                  decoration: BoxDecoration(
                                    color: sel ? o.color : kBackground,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                        color: sel ? o.color : kBorder),
                                  ),
                                  child: Center(
                                    child: Text(o.label, style: TextStyle(
                                      fontSize: 12, fontWeight: FontWeight.w700,
                                      color: sel ? Colors.white : kTextMuted,
                                    )),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                      ],
                    ),

                    // Remarks field (edit mode) or remarks text (saved mode)
                    if (!_saved || (entry['remarks'] ?? '').isNotEmpty) ...[
                      const SizedBox(height: 8),
                      if (_saved)
                        Text('Remarks: ${entry['remarks']}',
                            style: const TextStyle(
                                fontSize: 12, color: kTextMuted,
                                fontStyle: FontStyle.italic))
                      else
                        TextFormField(
                          initialValue: entry['remarks'] ?? '',
                          onChanged: (v) =>
                              _attMap[s.id] = {...entry, 'remarks': v},
                          style: const TextStyle(
                              fontSize: 12, color: kTextPrimary),
                          decoration: InputDecoration(
                            hintText: 'Remarks (optional)',
                            hintStyle: const TextStyle(
                                fontSize: 12, color: kTextMuted),
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 8),
                            filled: true,
                            fillColor: kBackground,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: kBorder),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: kBorder),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide:
                                  const BorderSide(color: kPrimary),
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),

        // Bottom action bar
        Container(
          padding: const EdgeInsets.all(12),
          color: kCardBg,
          child: _saved
              ? SizedBox(
                  width: double.infinity, height: 46,
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _saved = false),
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Edit Attendance'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kPrimary,
                      side: const BorderSide(color: kPrimary),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                )
              : SizedBox(
                  width: double.infinity, height: 46,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submitStudentAttendance,
                    child: _submitting
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : Text(
                            'Save Attendance (${_students.length} students)'),
                  ),
                ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<TeacherProfileProvider>();
    final showStudentTab = profile.isClassTeacher &&
        (profile.profile?.permissions.classTeacher.markStudentAttendance ?? false);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        bottom: showStudentTab
            ? TabBar(
                controller: _tab,
                indicatorColor: kPrimary,
                labelColor: kPrimary,
                unselectedLabelColor: kTextMuted,
                tabs: const [
                  Tab(text: 'Class Students'),
                  Tab(text: 'My Attendance'),
                ],
              )
            : null,
      ),
      body: showStudentTab
          ? TabBarView(controller: _tab,
              children: [_studentTab(), _ownTab()])
          : _ownTab(),
    );
  }
}

class _OwnStatusGrid extends StatelessWidget {
  final String selected;
  final void Function(String) onChanged;
  const _OwnStatusGrid({required this.selected, required this.onChanged});

  static const _options = [
    _StatusOption('P', 'present',  'Present',  kSuccess,          Color(0xFFF0FDF4)),
    _StatusOption('A', 'absent',   'Absent',   kDanger,           Color(0xFFFEF2F2)),
    _StatusOption('H', 'half_day', 'Half Day', Color(0xFFF97316), Color(0xFFFFF7ED)),
    _StatusOption('L', 'late',     'Late',     kWarning,          Color(0xFFFFFBEB)),
    _StatusOption('E', 'excused',  'Excused',  Color(0xFF6366F1), Color(0xFFEEF2FF)),
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: _options.map((o) {
        final sel = selected == o.key;
        return GestureDetector(
          onTap: () => onChanged(o.key),
          child: Container(
            width: (MediaQuery.of(context).size.width - 48) / 3,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: sel ? o.color : o.bg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: sel ? o.color : kBorder, width: sel ? 2 : 1),
            ),
            child: Column(
              children: [
                Text(o.label, style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800,
                  color: sel ? Colors.white : o.color,
                )),
                const SizedBox(height: 4),
                Text(o.fullLabel, style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600,
                  color: sel ? Colors.white : o.color,
                )),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
