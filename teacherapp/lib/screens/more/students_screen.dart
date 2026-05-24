import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/student.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/empty_state.dart';
import 'student_detail_screen.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  List<Student> _students = [];
  List<Student> _filtered = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();
  String? _selectedClassId;
  List<Map<String, String>> _classOptions = [];

  @override
  void initState() {
    super.initState();
    _buildClassOptions();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _buildClassOptions() {
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
      _classOptions = classes.entries.map((e) => {'id': e.key, 'name': e.value}).toList();
      if (_classOptions.isNotEmpty) _selectedClassId = _classOptions.first['id'];
    });

    if (_selectedClassId != null) _fetch();
  }

  Future<void> _fetch() async {
    if (_selectedClassId == null) return;
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/students', params: {
        'classId': _selectedClassId,
        'limit': '200',
      });
      final list = (res.data['students'] as List? ?? [])
          .map((s) => Student.fromJson(s))
          .toList();
      setState(() {
        _students = list;
        _filtered = list;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _filter() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _students
          : _students.where((s) =>
              s.name.toLowerCase().contains(q) ||
              (s.admissionNumber?.toLowerCase().contains(q) ?? false)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Students')),
      body: Column(
        children: [
          // Class selector (if subject teacher with multiple classes)
          if (_classOptions.length > 1)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: DropdownButtonFormField<String>(
                initialValue: _selectedClassId,
                decoration: const InputDecoration(hintText: 'Select class'),
                items: _classOptions.map((c) => DropdownMenuItem(
                  value: c['id'], child: Text(c['name']!),
                )).toList(),
                onChanged: (v) {
                  setState(() => _selectedClassId = v);
                  _fetch();
                },
              ),
            ),

          // Search
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search students...',
                prefixIcon: const Icon(Icons.search, size: 18, color: kTextMuted),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 16, color: kTextMuted),
                        onPressed: () { _searchCtrl.clear(); _filter(); },
                      )
                    : null,
              ),
            ),
          ),

          // List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: kPrimary))
                : _filtered.isEmpty
                    ? const EmptyState(icon: Icons.person_search, title: 'No students found')
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                        itemCount: _filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 6),
                        itemBuilder: (_, i) {
                          final s = _filtered[i];
                          return GestureDetector(
                            onTap: () => Navigator.push(context,
                                MaterialPageRoute(builder: (_) => StudentDetailScreen(student: s))),
                            child: Container(
                              decoration: BoxDecoration(
                                color: kCardBg, borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: kBorder),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor: kPrimaryLight,
                                    backgroundImage: s.photo != null ? NetworkImage(s.photo!) : null,
                                    child: s.photo == null
                                        ? Text(s.name[0], style: const TextStyle(
                                            color: kPrimary, fontWeight: FontWeight.w700, fontSize: 15,
                                          ))
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(s.name, style: const TextStyle(
                                          fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary,
                                        )),
                                        if (s.admissionNumber != null)
                                          Text(s.admissionNumber!, style: const TextStyle(
                                            fontSize: 12, color: kTextMuted,
                                          )),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right, color: kTextMuted, size: 18),
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
