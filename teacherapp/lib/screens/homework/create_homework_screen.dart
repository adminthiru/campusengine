import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/student.dart';
import '../../providers/teacher_profile_provider.dart';

class CreateHomeworkScreen extends StatefulWidget {
  const CreateHomeworkScreen({super.key});

  @override
  State<CreateHomeworkScreen> createState() => _CreateHomeworkScreenState();
}

class _CreateHomeworkScreenState extends State<CreateHomeworkScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  String? _selectedClassId;
  String? _autoSubjectId;
  String? _autoSubjectName;
  DateTime _assignedDate = DateTime.now();
  DateTime? _dueDate;
  String _assignTo = 'all';
  bool _submitting = false;

  // Class options for dropdown
  List<Map<String, String>> _classOptions = [];

  // For "Select Students"
  List<Student> _students = [];
  Set<String> _selectedStudentIds = {};
  bool _loadingStudents = false;

  @override
  void initState() {
    super.initState();
    _buildOptions();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _buildOptions() {
    final profile = context.read<TeacherProfileProvider>().profile;
    if (profile == null) return;

    final classes = <String, String>{};

    if (profile.isClassTeacher && profile.classTeacher != null) {
      final c = profile.classTeacher!.classInfo;
      classes[c.id] = c.fullName;
    }
    for (final st in profile.subjectTeacher) {
      classes[st.classInfo.id] = st.classInfo.fullName;
    }

    setState(() {
      _classOptions = classes.entries
          .map((e) => {'id': e.key, 'name': e.value})
          .toList();
      // Auto-select if only one class
      if (_classOptions.length == 1) {
        _selectedClassId = _classOptions.first['id'] as String;
        _resolveSubject(_selectedClassId!);
      }
    });
  }

  // When class is picked, find the teacher's subject for that class
  void _resolveSubject(String classId) {
    final profile = context.read<TeacherProfileProvider>().profile;
    if (profile == null) return;

    // Check subjectTeacher assignments first (specific subject per class)
    for (final st in profile.subjectTeacher) {
      if (st.classInfo.id == classId) {
        setState(() {
          _autoSubjectId = st.subject.id;
          _autoSubjectName = st.subject.name;
        });
        return;
      }
    }
    // Class teacher with no subject-teacher assignment — no auto-fill
    setState(() {
      _autoSubjectId = null;
      _autoSubjectName = null;
    });
  }

  Future<void> _loadStudents(String classId) async {
    setState(() { _loadingStudents = true; _students = []; _selectedStudentIds = {}; });
    try {
      final res = await ApiClient.get('/students',
          params: {'classId': classId, 'limit': '200'});
      final list = (res.data['students'] as List? ?? [])
          .map((s) => Student.fromJson(s))
          .toList();
      setState(() => _students = list);
    } catch (_) {}
    setState(() => _loadingStudents = false);
  }

  Future<void> _pickDate({required bool isDue}) async {
    final initial = isDue
        ? (_dueDate ?? DateTime.now().add(const Duration(days: 1)))
        : _assignedDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2024),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: kPrimary),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isDue) { _dueDate = picked; } else { _assignedDate = picked; }
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedClassId == null) {
      _showSnack('Please select a class', isError: true); return;
    }
    if (_dueDate == null) {
      _showSnack('Please select a due date', isError: true); return;
    }
    if (_assignTo == 'selected' && _selectedStudentIds.isEmpty) {
      _showSnack('Please select at least one student', isError: true); return;
    }
    setState(() => _submitting = true);
    try {
      await ApiClient.post('/homework', data: {
        'title': _titleCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        'class': _selectedClassId,
        if (_autoSubjectId != null) 'subject': _autoSubjectId,
        'assignedDate': DateFormat('yyyy-MM-dd').format(_assignedDate),
        'dueDate': DateFormat('yyyy-MM-dd').format(_dueDate!),
        'assignedTo': _assignTo,
        if (_assignTo == 'selected') 'students': _selectedStudentIds.toList(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Homework assigned successfully!'),
          backgroundColor: kSuccess,
        ));
        Navigator.pop(context, true);
      }
    } catch (e) {
      _showSnack(ApiClient.errorMessage(e), isError: true);
    }
    if (mounted) setState(() => _submitting = false);
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? kDanger : kSuccess,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add Homework')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [

            // Class + Subject row
            Row(children: [
              Expanded(child: _label('Class *')),
              const SizedBox(width: 12),
              Expanded(child: _label('Subject')),
            ]),
            const SizedBox(height: 6),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: _classOptions.isEmpty
                    ? _readOnly('No class assigned')
                    : DropdownButtonFormField<String>(
                        value: _selectedClassId,
                        decoration: _inputDec('Select class'),
                        items: _classOptions.map((c) => DropdownMenuItem<String>(
                          value: c['id'] as String,
                          child: Text(c['name'] as String),
                        )).toList(),
                        onChanged: (v) {
                          if (v == null) return;
                          setState(() {
                            _selectedClassId = v;
                            _students = [];
                            _selectedStudentIds = {};
                          });
                          _resolveSubject(v);
                          if (_assignTo == 'selected') _loadStudents(v);
                        },
                        validator: (v) => v == null ? 'Required' : null,
                      ),
              ),
              const SizedBox(width: 12),
              // Subject — always auto-filled read-only
              Expanded(
                child: _autoSubjectName != null
                    ? _readOnly(_autoSubjectName!, icon: Icons.auto_awesome, color: kPrimary)
                    : _readOnly('Auto-filled on class select'),
              ),
            ]),
            const SizedBox(height: 18),

            // Title
            _label('Title *'),
            const SizedBox(height: 6),
            TextFormField(
              controller: _titleCtrl,
              decoration: _inputDec('e.g. Chapter 5 — Exercise 1 to 10'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 18),

            // Description
            _label('Description'),
            const SizedBox(height: 6),
            TextFormField(
              controller: _descCtrl,
              maxLines: 4,
              decoration: _inputDec(
                  'Additional instructions, page numbers, notes...'),
            ),
            const SizedBox(height: 18),

            // Dates row
            Row(children: [
              Expanded(child: _label('Assigned Date')),
              const SizedBox(width: 12),
              Expanded(child: _label('Due Date *')),
            ]),
            const SizedBox(height: 6),
            Row(children: [
              Expanded(child: _DateField(
                value: _assignedDate, onTap: () => _pickDate(isDue: false),
              )),
              const SizedBox(width: 12),
              Expanded(child: _DateField(
                value: _dueDate,
                placeholder: 'Select due date',
                onTap: () => _pickDate(isDue: true),
              )),
            ]),
            const SizedBox(height: 18),

            // Assign To
            _label('Assign To'),
            const SizedBox(height: 10),
            Row(children: [
              _RadioOption(
                label: 'All Students',
                value: 'all',
                groupValue: _assignTo,
                onChanged: (v) => setState(() => _assignTo = v),
              ),
              const SizedBox(width: 24),
              _RadioOption(
                label: 'Select Students',
                value: 'selected',
                groupValue: _assignTo,
                onChanged: (v) {
                  setState(() => _assignTo = v);
                  if (_selectedClassId != null && _students.isEmpty) {
                    _loadStudents(_selectedClassId!);
                  }
                },
              ),
            ]),

            // Student multi-select (shown only when 'selected')
            if (_assignTo == 'selected') ...[
              const SizedBox(height: 14),
              _StudentPicker(
                students: _students,
                loading: _loadingStudents,
                selected: _selectedStudentIds,
                onToggle: (id) => setState(() {
                  if (_selectedStudentIds.contains(id)) {
                    _selectedStudentIds.remove(id);
                  } else {
                    _selectedStudentIds.add(id);
                  }
                }),
                onSelectAll: () => setState(() =>
                  _selectedStudentIds = _students.map((s) => s.id).toSet()),
                onClearAll: () => setState(() => _selectedStudentIds = {}),
              ),
            ],

            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity, height: 50,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: _submitting
                    ? const SizedBox(width: 22, height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Add Homework',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text, style: const TextStyle(
    fontSize: 13, fontWeight: FontWeight.w600, color: kTextSecondary,
  ));

  InputDecoration _inputDec(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: kTextMuted, fontSize: 13),
    filled: true, fillColor: kCardBg,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kBorder)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kBorder)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kPrimary, width: 1.5)),
    errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kDanger)),
  );

  Widget _readOnly(String text, {IconData? icon, Color? color}) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
    decoration: BoxDecoration(
      color: color != null ? color.withValues(alpha: 0.06) : kBackground,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color != null ? color.withValues(alpha: 0.3) : kBorder),
    ),
    child: Row(children: [
      if (icon != null) ...[
        Icon(icon, size: 14, color: color ?? kTextMuted),
        const SizedBox(width: 6),
      ],
      Expanded(child: Text(text, style: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w500,
        color: color ?? kTextMuted,
      ), overflow: TextOverflow.ellipsis)),
    ]),
  );
}

// ── Student multi-select picker ───────────────────────────────────────────────
class _StudentPicker extends StatelessWidget {
  final List<Student> students;
  final bool loading;
  final Set<String> selected;
  final void Function(String) onToggle;
  final VoidCallback onSelectAll;
  final VoidCallback onClearAll;

  const _StudentPicker({
    required this.students, required this.loading,
    required this.selected, required this.onToggle,
    required this.onSelectAll, required this.onClearAll,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kCardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        children: [
          // Header: count + Select All / Clear
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: kBackground,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(10), topRight: Radius.circular(10),
              ),
            ),
            child: Row(children: [
              Text(
                loading
                    ? 'Loading students...'
                    : '${selected.length} / ${students.length} selected',
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: kTextSecondary),
              ),
              const Spacer(),
              if (!loading && students.isNotEmpty) ...[
                GestureDetector(
                  onTap: onSelectAll,
                  child: const Text('All', style: TextStyle(
                      fontSize: 12, color: kPrimary, fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 14),
                GestureDetector(
                  onTap: onClearAll,
                  child: const Text('Clear', style: TextStyle(
                      fontSize: 12, color: kDanger, fontWeight: FontWeight.w600)),
                ),
              ],
            ]),
          ),
          const Divider(height: 1, color: kBorder),

          if (loading)
            const Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2),
            )
          else if (students.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No students found', style: TextStyle(
                  fontSize: 13, color: kTextMuted)),
            )
          else
            // Limit height and make scrollable
            SizedBox(
              height: 260,
              child: ListView.separated(
                physics: const ClampingScrollPhysics(),
                itemCount: students.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: kBorder),
                itemBuilder: (_, i) {
                  final s = students[i];
                  final checked = selected.contains(s.id);
                  return InkWell(
                    onTap: () => onToggle(s.id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      child: Row(children: [
                        // Custom checkbox
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 20, height: 20,
                          decoration: BoxDecoration(
                            color: checked ? kPrimary : kCardBg,
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(
                              color: checked ? kPrimary : kBorder, width: 2,
                            ),
                          ),
                          child: checked
                              ? const Icon(Icons.check, size: 13,
                                  color: Colors.white)
                              : null,
                        ),
                        const SizedBox(width: 12),
                        CircleAvatar(
                          radius: 16,
                          backgroundColor:
                              checked ? kPrimaryLight : kBackground,
                          child: Text(s.name[0], style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700,
                            color: checked ? kPrimary : kTextSecondary,
                          )),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(s.name, style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600,
                              color: checked ? kPrimary : kTextPrimary,
                            )),
                            if (s.admissionNumber != null)
                              Text(s.admissionNumber!, style: const TextStyle(
                                  fontSize: 11, color: kTextMuted)),
                          ],
                        )),
                      ]),
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

// ── Date field ────────────────────────────────────────────────────────────────
class _DateField extends StatelessWidget {
  final DateTime? value;
  final String? placeholder;
  final VoidCallback onTap;

  const _DateField({this.value, this.placeholder, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final hasValue = value != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: kCardBg, borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kBorder),
        ),
        child: Row(children: [
          const Icon(Icons.calendar_today_outlined, size: 15, color: kTextMuted),
          const SizedBox(width: 8),
          Expanded(child: Text(
            hasValue
                ? DateFormat('dd-MM-yyyy').format(value!)
                : (placeholder ?? DateFormat('dd-MM-yyyy').format(DateTime.now())),
            style: TextStyle(
              fontSize: 13, color: hasValue ? kTextPrimary : kTextMuted,
            ),
            overflow: TextOverflow.ellipsis,
          )),
        ]),
      ),
    );
  }
}

// ── Radio option ──────────────────────────────────────────────────────────────
class _RadioOption extends StatelessWidget {
  final String label;
  final String value;
  final String groupValue;
  final void Function(String) onChanged;

  const _RadioOption({
    required this.label, required this.value,
    required this.groupValue, required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final selected = value == groupValue;
    return GestureDetector(
      onTap: () => onChanged(value),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 20, height: 20,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
                color: selected ? kPrimary : kBorder, width: 2),
          ),
          child: selected
              ? Center(child: Container(
                  width: 10, height: 10,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle, color: kPrimary,
                  ),
                ))
              : null,
        ),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(
          fontSize: 13, color: kTextPrimary, fontWeight: FontWeight.w500,
        )),
      ]),
    );
  }
}
