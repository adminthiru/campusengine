import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/empty_state.dart';
import 'enter_marks_screen.dart';

class ExamsScreen extends StatefulWidget {
  const ExamsScreen({super.key});

  @override
  State<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends State<ExamsScreen> {
  List<dynamic> _exams = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/exams');
      setState(() {
        _exams = res.data['exams'] as List? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  // Filter exams relevant to this teacher's classes
  List<dynamic> _filteredExams(Set<String> teacherClassIds) {
    if (teacherClassIds.isEmpty) return _exams;
    return _exams.where((e) {
      final classes = e['classes'] as List? ?? [];
      return classes.any((c) {
        final id = c is Map ? c['_id'] : c;
        return teacherClassIds.contains(id?.toString());
      });
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<TeacherProfileProvider>().profile;
    final teacherClassIds = <String>{};
    if (profile?.classTeacher != null) {
      teacherClassIds.add(profile!.classTeacher!.classInfo.id);
    }
    for (final st in profile?.subjectTeacher ?? []) {
      teacherClassIds.add(st.classInfo.id);
    }
    final exams = _filteredExams(teacherClassIds);

    return Scaffold(
      appBar: AppBar(title: const Text('Exams')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : RefreshIndicator(
              color: kPrimary,
              onRefresh: _fetch,
              child: exams.isEmpty
                  ? const EmptyState(
                      icon: Icons.assignment_outlined,
                      title: 'No exams found',
                      subtitle: 'Exams will appear here once created by admin',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: exams.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, i) => _ExamCard(
                        exam: exams[i],
                        onTap: () => Navigator.push(context, MaterialPageRoute(
                          builder: (_) => EnterMarksScreen(exam: exams[i]),
                        )).then((_) => _fetch()),
                      ),
                    ),
            ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  final Map<String, dynamic> exam;
  final VoidCallback onTap;

  const _ExamCard({required this.exam, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = exam['status'] as String? ?? 'scheduled';
    final isPublished = exam['isResultPublished'] == true;
    final classes = exam['classes'] as List? ?? [];

    Color statusColor;
    switch (status) {
      case 'ongoing': statusColor = kWarning; break;
      case 'completed': statusColor = kSuccess; break;
      case 'cancelled': statusColor = kDanger; break;
      default: statusColor = kPrimary;
    }

    String? dateStr;
    if (exam['examDate'] != null) {
      final d = DateTime.tryParse(exam['examDate']);
      if (d != null) dateStr = DateFormat('dd MMM yyyy').format(d);
    }

    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            Container(
              decoration: BoxDecoration(
                color: kCardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kBorder),
                boxShadow: [BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6, offset: const Offset(0, 2),
                )],
              ),
              padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(exam['name'] ?? 'Exam', style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700, color: kTextPrimary,
                          )),
                          if (exam['type'] != null) ...[
                            const SizedBox(height: 3),
                            Text(exam['type'], style: const TextStyle(
                              fontSize: 12, color: kTextMuted,
                            )),
                          ],
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _pill(status.toUpperCase(), statusColor),
                        if (isPublished) ...[
                          const SizedBox(height: 4),
                          _pill('PUBLISHED', kSuccess),
                        ],
                      ],
                    ),
                  ]),

                  if (classes.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: classes.map((c) {
                        final name = c is Map
                            ? '${c['name'] ?? ''} ${c['section'] ?? ''}'.trim()
                            : c.toString();
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: kPrimaryLight,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(name, style: const TextStyle(
                            fontSize: 11, color: kPrimary, fontWeight: FontWeight.w600,
                          )),
                        );
                      }).toList(),
                    ),
                  ],

                  const SizedBox(height: 10),
                  const Divider(height: 1, color: kBorder),
                  const SizedBox(height: 10),

                  Row(children: [
                    if (dateStr != null) ...[
                      const Icon(Icons.calendar_today_outlined, size: 12, color: kTextMuted),
                      const SizedBox(width: 4),
                      Text(dateStr, style: const TextStyle(fontSize: 11, color: kTextMuted)),
                      const SizedBox(width: 16),
                    ],
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: kDangerLight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.edit_outlined, size: 13, color: kDanger),
                        SizedBox(width: 5),
                        Text('Enter Marks', style: TextStyle(
                          fontSize: 12, color: kDanger, fontWeight: FontWeight.w600,
                        )),
                      ]),
                    ),
                  ]),
                ],
              ),
            ),
            Positioned(left: 0, top: 0, bottom: 0,
                child: Container(width: 4, color: kDanger)),
          ],
        ),
      ),
    );
  }

  Widget _pill(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: 0.35)),
    ),
    child: Text(label, style: TextStyle(
      fontSize: 10, fontWeight: FontWeight.w700, color: color,
    )),
  );
}
