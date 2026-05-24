import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/student.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/empty_state.dart';

class EnterMarksScreen extends StatefulWidget {
  final Map<String, dynamic> exam;
  const EnterMarksScreen({super.key, required this.exam});

  @override
  State<EnterMarksScreen> createState() => _EnterMarksScreenState();
}

class _MarksEntry {
  bool isAbsent;
  final TextEditingController theory;
  final TextEditingController practical;
  final TextEditingController remarks;
  _MarksEntry({
    this.isAbsent = false,
    String theory = '',
    String practical = '',
    String remarks = '',
  })  : theory = TextEditingController(text: theory),
        practical = TextEditingController(text: practical),
        remarks = TextEditingController(text: remarks);

  void dispose() {
    theory.dispose();
    practical.dispose();
    remarks.dispose();
  }
}

class _EnterMarksScreenState extends State<EnterMarksScreen> {
  List<Student> _students = [];
  final Map<String, _MarksEntry> _entries = {};
  bool _loading = true;
  bool _submitting = false;

  String? _selectedClassId;
  String? _selectedSubjectId;
  String? _selectedSubjectName;
  List<Map<String, String>> _classOptions = [];
  List<Map<String, String>> _subjectOptions = [];

  int _maxMarksTheory = 100;
  int _maxMarksPractical = 0;

  @override
  void initState() {
    super.initState();
    _buildOptions();
  }

  @override
  void dispose() {
    for (final e in _entries.values) { e.dispose(); }
    super.dispose();
  }

  void _buildOptions() {
    final profile = context.read<TeacherProfileProvider>().profile;
    if (profile == null) return;

    final classMap = <String, String>{};

    if (profile.isClassTeacher && profile.classTeacher != null) {
      final c = profile.classTeacher!.classInfo;
      classMap[c.id] = c.fullName;
    }
    for (final st in profile.subjectTeacher) {
      classMap[st.classInfo.id] = st.classInfo.fullName;
    }

    final classOptions = classMap.entries
        .map((e) => {'id': e.key, 'name': e.value})
        .toList();

    setState(() {
      _classOptions = classOptions;
      if (_classOptions.isNotEmpty) {
        _selectedClassId = _classOptions.first['id'];
      }
    });

    if (_selectedClassId != null) _updateSubjectsAndLoad();
  }

  void _updateSubjectsAndLoad() {
    final profile = context.read<TeacherProfileProvider>().profile;
    if (profile == null || _selectedClassId == null) return;

    // Get subjects for the selected class from teacher's assignments
    final subjectMap = <String, String>{};

    // From subject-teacher assignment for this class
    for (final st in profile.subjectTeacher) {
      if (st.classInfo.id == _selectedClassId) {
        subjectMap[st.subject.id] = st.subject.name;
      }
    }

    // If class teacher with no subject assignment, use exam schedule subjects for this class
    if (subjectMap.isEmpty && profile.isClassTeacher) {
      final schedule = widget.exam['schedule'] as List? ?? [];
      for (final s in schedule) {
        final sClass = s['class'];
        final classId = sClass is Map ? sClass['_id'] : sClass;
        if (classId?.toString() == _selectedClassId) {
          final subj = s['subject'];
          if (subj is Map) {
            subjectMap[subj['_id'] ?? ''] = subj['name'] ?? '';
          }
        }
      }
    }

    final subjectOptions = subjectMap.entries
        .map((e) => {'id': e.key, 'name': e.value})
        .toList();

    setState(() {
      _subjectOptions = subjectOptions;
      _selectedSubjectId = subjectOptions.isNotEmpty ? subjectOptions.first['id'] : null;
      _selectedSubjectName = subjectOptions.isNotEmpty ? subjectOptions.first['name'] : null;
    });

    _resolveMaxMarks();
    _loadStudentsAndResults();
  }

  void _resolveMaxMarks() {
    if (_selectedClassId == null || _selectedSubjectId == null) return;
    final schedule = widget.exam['schedule'] as List? ?? [];
    for (final s in schedule) {
      final sClass = s['class'];
      final sSubj = s['subject'];
      final classId = sClass is Map ? sClass['_id'] : sClass;
      final subjId = sSubj is Map ? sSubj['_id'] : sSubj;
      if (classId?.toString() == _selectedClassId &&
          subjId?.toString() == _selectedSubjectId) {
        setState(() {
          _maxMarksTheory = (s['maxMarks'] as num?)?.toInt() ?? 100;
          _maxMarksPractical = 0;
        });
        return;
      }
    }
    setState(() { _maxMarksTheory = 100; _maxMarksPractical = 0; });
  }

  Future<void> _loadStudentsAndResults() async {
    if (_selectedClassId == null) return;
    setState(() => _loading = true);

    try {
      // Fetch students
      final stuRes = await ApiClient.get('/students',
          params: {'classId': _selectedClassId, 'limit': '300'});
      final students = (stuRes.data['students'] as List? ?? [])
          .map((s) => Student.fromJson(s))
          .toList();

      // Fetch existing results
      final resRes = await ApiClient.get('/exams/results', params: {
        'examId': widget.exam['_id'],
        'classId': _selectedClassId,
      });
      final results = resRes.data['results'] as List? ?? [];

      // Build lookup: studentId → mark entry for selected subject
      final existingMap = <String, Map<String, dynamic>>{};
      for (final r in results) {
        final student = r['student'];
        final sid = student is Map ? student['_id'] : student;
        if (sid == null) continue;
        final marks = r['marks'] as List? ?? [];
        for (final m in marks) {
          final subjId = m['subject'] is Map
              ? m['subject']['_id']
              : m['subject'];
          if (subjId?.toString() == _selectedSubjectId) {
            existingMap[sid.toString()] = Map<String, dynamic>.from(m);
          }
        }
      }

      // Dispose old controllers
      for (final e in _entries.values) { e.dispose(); }
      _entries.clear();

      for (final s in students) {
        final existing = existingMap[s.id];
        _entries[s.id] = _MarksEntry(
          isAbsent: existing?['isAbsent'] == true,
          theory: existing?['theoryMarks']?.toString() ?? '',
          practical: existing?['practicalMarks']?.toString() ?? '',
          remarks: existing?['remarks'] ?? '',
        );
      }

      setState(() {
        _students = students;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedClassId == null || _selectedSubjectId == null) {
      _snack('Select a class and subject', isError: true);
      return;
    }

    setState(() => _submitting = true);
    try {
      final marksData = _students.map((s) {
        final e = _entries[s.id]!;
        final theory = num.tryParse(e.theory.text) ?? 0;
        final practical = num.tryParse(e.practical.text) ?? 0;
        return {
          'studentId': s.id,
          'theoryMarks': e.isAbsent ? 0 : theory,
          'practicalMarks': e.isAbsent ? 0 : practical,
          'isAbsent': e.isAbsent,
          'remarks': e.remarks.text.trim(),
        };
      }).toList();

      await ApiClient.post('/exams/marks', data: {
        'examId': widget.exam['_id'],
        'classId': _selectedClassId,
        'subjectId': _selectedSubjectId,
        'marksData': marksData,
      });

      if (mounted) {
        _snack('Marks saved successfully!');
        Navigator.pop(context, true);
      }
    } catch (e) {
      _snack(ApiClient.errorMessage(e), isError: true);
    }
    if (mounted) setState(() => _submitting = false);
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? kDanger : kSuccess,
    ));
  }

  InputDecoration _marksDec(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: kTextMuted, fontSize: 12),
    filled: true,
    fillColor: kBackground,
    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kBorder)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kBorder)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kPrimary, width: 1.5)),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.exam['name'] ?? 'Enter Marks')),
      body: Column(
        children: [
          // Selectors bar
          Container(
            color: kCardBg,
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              children: [
                if (_classOptions.length > 1) ...[
                  DropdownButtonFormField<String>(
                    initialValue: _selectedClassId,
                    decoration: InputDecoration(
                      labelText: 'Class',
                      labelStyle: const TextStyle(fontSize: 13, color: kTextMuted),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: kBorder)),
                    ),
                    items: _classOptions.map((c) => DropdownMenuItem<String>(
                      value: c['id'] as String,
                      child: Text(c['name'] as String),
                    )).toList(),
                    onChanged: (v) {
                      setState(() => _selectedClassId = v);
                      _updateSubjectsAndLoad();
                    },
                  ),
                  const SizedBox(height: 10),
                ],
                if (_subjectOptions.length > 1)
                  DropdownButtonFormField<String>(
                    initialValue: _selectedSubjectId,
                    decoration: InputDecoration(
                      labelText: 'Subject',
                      labelStyle: const TextStyle(fontSize: 13, color: kTextMuted),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: kBorder)),
                    ),
                    items: _subjectOptions.map((s) => DropdownMenuItem<String>(
                      value: s['id'] as String,
                      child: Text(s['name'] as String),
                    )).toList(),
                    onChanged: (v) {
                      setState(() {
                        _selectedSubjectId = v;
                        _selectedSubjectName = _subjectOptions
                            .firstWhere((s) => s['id'] == v)['name'];
                      });
                      _resolveMaxMarks();
                      _loadStudentsAndResults();
                    },
                  ),
                if (_subjectOptions.length == 1 && _selectedSubjectName != null) ...[
                  Row(children: [
                    const Icon(Icons.book_outlined, size: 14, color: kTextMuted),
                    const SizedBox(width: 6),
                    Text(_selectedSubjectName!, style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: kTextSecondary,
                    )),
                    const SizedBox(width: 10),
                    Text('Max: $_maxMarksTheory marks', style: const TextStyle(
                      fontSize: 12, color: kTextMuted,
                    )),
                  ]),
                ],
              ],
            ),
          ),
          const Divider(height: 1, color: kBorder),

          // Legend row
          Container(
            color: kBackground,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(children: [
              const SizedBox(width: 28),
              const Expanded(child: Text('Student', style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: kTextMuted,
              ))),
              SizedBox(width: 36, child: Text('Absent', textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: kTextMuted))),
              const SizedBox(width: 8),
              SizedBox(width: 64, child: Text('Theory\n/$_maxMarksTheory',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: kTextMuted, height: 1.3))),
              if (_maxMarksPractical > 0) ...[
                const SizedBox(width: 6),
                SizedBox(width: 64, child: Text('Pract.\n/$_maxMarksPractical',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: kTextMuted, height: 1.3))),
              ],
            ]),
          ),
          const Divider(height: 1, color: kBorder),

          // Student list
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: kPrimary))
                : _students.isEmpty
                    ? const EmptyState(icon: Icons.groups, title: 'No students found')
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(14, 10, 14, 100),
                        itemCount: _students.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final s = _students[i];
                          final entry = _entries[s.id]!;
                          return _StudentMarksCard(
                            index: i + 1,
                            student: s,
                            entry: entry,
                            maxMarksTheory: _maxMarksTheory,
                            maxMarksPractical: _maxMarksPractical,
                            marksDec: _marksDec,
                            onAbsentChanged: (v) => setState(() => entry.isAbsent = v),
                            onChanged: () => setState(() {}),
                          );
                        },
                      ),
          ),
        ],
      ),

      // Save button pinned at bottom
      bottomNavigationBar: Container(
        color: kCardBg,
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, MediaQuery.of(context).viewInsets.bottom + 16),
        child: SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: _submitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _submitting
                ? const SizedBox(width: 22, height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Save Marks',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}

// ── Student marks card ─────────────────────────────────────────────────────────
class _StudentMarksCard extends StatelessWidget {
  final int index;
  final Student student;
  final _MarksEntry entry;
  final int maxMarksTheory;
  final int maxMarksPractical;
  final InputDecoration Function(String) marksDec;
  final ValueChanged<bool> onAbsentChanged;
  final VoidCallback onChanged;

  const _StudentMarksCard({
    required this.index,
    required this.student,
    required this.entry,
    required this.maxMarksTheory,
    required this.maxMarksPractical,
    required this.marksDec,
    required this.onAbsentChanged,
    required this.onChanged,
  });

  int get _total {
    final t = num.tryParse(entry.theory.text) ?? 0;
    final p = num.tryParse(entry.practical.text) ?? 0;
    return (t + p).toInt();
  }

  int get _maxTotal => maxMarksTheory + maxMarksPractical;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: entry.isAbsent
            ? kDanger.withValues(alpha: 0.04)
            : kCardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: entry.isAbsent ? kDanger.withValues(alpha: 0.3) : kBorder,
        ),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: index + name + absent toggle
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Container(
              width: 24, height: 24,
              decoration: BoxDecoration(
                color: kBackground,
                shape: BoxShape.circle,
                border: Border.all(color: kBorder),
              ),
              child: Center(child: Text('$index', style: const TextStyle(
                fontSize: 10, fontWeight: FontWeight.w700, color: kTextSecondary,
              ))),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(student.name, style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: entry.isAbsent ? kDanger : kTextPrimary,
                )),
                if (student.admissionNumber != null)
                  Text(student.admissionNumber!, style: const TextStyle(
                    fontSize: 11, color: kTextMuted,
                  )),
              ]),
            ),
            // Absent toggle
            GestureDetector(
              onTap: () => onAbsentChanged(!entry.isAbsent),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: entry.isAbsent
                      ? kDanger.withValues(alpha: 0.10)
                      : kBackground,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: entry.isAbsent
                        ? kDanger.withValues(alpha: 0.4)
                        : kBorder,
                  ),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(
                    entry.isAbsent ? Icons.cancel_outlined : Icons.check_circle_outline,
                    size: 13,
                    color: entry.isAbsent ? kDanger : kTextMuted,
                  ),
                  const SizedBox(width: 4),
                  Text('Absent', style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: entry.isAbsent ? kDanger : kTextMuted,
                  )),
                ]),
              ),
            ),
          ]),

          if (!entry.isAbsent) ...[
            const SizedBox(height: 10),
            Row(children: [
              // Theory marks
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Theory / $maxMarksTheory', style: const TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w600, color: kTextMuted,
                  )),
                  const SizedBox(height: 4),
                  TextField(
                    controller: entry.theory,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w700, color: kTextPrimary,
                    ),
                    decoration: marksDec('0'),
                    onChanged: (_) => onChanged(),
                  ),
                ]),
              ),
              if (maxMarksPractical > 0) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Practical / $maxMarksPractical', style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w600, color: kTextMuted,
                    )),
                    const SizedBox(height: 4),
                    TextField(
                      controller: entry.practical,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700, color: kTextPrimary,
                      ),
                      decoration: marksDec('0'),
                      onChanged: (_) => onChanged(),
                    ),
                  ]),
                ),
              ],
              const SizedBox(width: 10),
              // Total pill
              Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
                const Text('Total', style: TextStyle(
                  fontSize: 10, fontWeight: FontWeight.w600, color: kTextMuted,
                )),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: kBackground,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: kBorder),
                  ),
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: '$_total', style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800, color: kTextPrimary,
                      )),
                      TextSpan(text: '/$_maxTotal', style: const TextStyle(
                        fontSize: 11, color: kTextMuted,
                      )),
                    ]),
                  ),
                ),
              ]),
            ]),
            const SizedBox(height: 10),
            // Remarks
            TextField(
              controller: entry.remarks,
              style: const TextStyle(fontSize: 13, color: kTextPrimary),
              decoration: InputDecoration(
                hintText: 'Remarks (optional)',
                hintStyle: const TextStyle(color: kTextMuted, fontSize: 12),
                filled: true,
                fillColor: kBackground,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: kBorder)),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: kBorder)),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: kPrimary, width: 1.5)),
              ),
            ),
          ] else ...[
            const SizedBox(height: 6),
            const Text('Marked as absent — no marks entered',
                style: TextStyle(fontSize: 11, color: kDanger)),
          ],
        ],
      ),
    );
  }
}
