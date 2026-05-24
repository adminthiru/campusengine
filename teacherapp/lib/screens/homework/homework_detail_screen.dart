import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/homework.dart';
import '../../models/student.dart';

class HomeworkDetailScreen extends StatefulWidget {
  final Homework hw;

  const HomeworkDetailScreen({super.key, required this.hw});

  @override
  State<HomeworkDetailScreen> createState() => _HomeworkDetailScreenState();
}

class _HomeworkDetailScreenState extends State<HomeworkDetailScreen> {
  // Submissions map: studentId → { status, submittedAt }
  Map<String, Map<String, dynamic>> _subs = {};
  // Full student list
  List<Student> _students = [];
  bool _loading = true;
  // Tracks which student status is being saved
  String? _savingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final detailRes = await ApiClient.get('/homework/${widget.hw.id}');
      final hw = detailRes.data['homework'] as Map<String, dynamic>;

      final subRes = await ApiClient.get('/homework/${widget.hw.id}/submissions');
      final submissionList = subRes.data['submissions'] as List? ?? [];
      final subMap = <String, Map<String, dynamic>>{};
      for (final s in submissionList) {
        final sid = (s['student'] is Map ? s['student']['_id'] : s['student'])?.toString() ?? '';
        if (sid.isNotEmpty) subMap[sid] = Map<String, dynamic>.from(s);
      }

      List<Student> students;
      if (hw['assignedTo'] == 'all') {
        final classId = (hw['class'] is Map ? hw['class']['_id'] : hw['class'])?.toString() ?? '';
        if (classId.isNotEmpty) {
          final stuRes = await ApiClient.get('/students', params: {'classId': classId, 'limit': '300'});
          students = ((stuRes.data['students'] as List?) ?? [])
              .map((s) => Student.fromJson(s))
              .toList();
        } else {
          students = [];
        }
      } else {
        final rawStudents = hw['students'] as List? ?? [];
        students = rawStudents
            .whereType<Map<String, dynamic>>()
            .map((s) => Student.fromJson(s))
            .toList();
      }

      setState(() {
        _subs = subMap;
        _students = students;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(String studentId, String newStatus) async {
    setState(() => _savingId = studentId);
    try {
      await ApiClient.put('/homework/${widget.hw.id}/submissions/$studentId',
          data: {'status': newStatus});
      setState(() {
        _subs[studentId] = {
          ...(_subs[studentId] ?? {}),
          'status': newStatus,
          if (newStatus == 'completed') 'submittedAt': DateTime.now().toIso8601String(),
        };
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e)),
          backgroundColor: kDanger,
        ));
      }
    }
    setState(() => _savingId = null);
  }

  void _showStatusPicker(Student student) {
    const opts = [
      ('pending', 'Pending', kDanger),
      ('in_progress', 'In Progress', kWarning),
      ('completed', 'Completed', kSuccess),
    ];
    final current = _subs[student.id]?['status'] as String? ?? 'pending';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(student.name,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700, color: kTextPrimary)),
            const SizedBox(height: 4),
            const Text('Update submission status',
                style: TextStyle(fontSize: 13, color: kTextSecondary)),
            const SizedBox(height: 16),
            ...opts.map((opt) {
              final (val, label, color) = opt;
              final isSelected = current == val;
              return GestureDetector(
                onTap: () {
                  Navigator.pop(context);
                  if (val != current) _updateStatus(student.id, val);
                },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? color.withValues(alpha: 0.08)
                        : kBackground,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected ? color : kBorder,
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(children: [
                    Container(
                      width: 10, height: 10,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(label, style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: isSelected ? color : kTextPrimary,
                    ))),
                    if (isSelected)
                      Icon(Icons.check_circle, color: color, size: 18),
                  ]),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Color _subjectColor(String? hex) {
    if (hex == null || hex.isEmpty) return kPurple;
    try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
    catch (_) { return kPurple; }
  }

  @override
  Widget build(BuildContext context) {
    final hw = widget.hw;
    final subjectColor = _subjectColor(hw.subject?.color);

    return Scaffold(
      appBar: AppBar(title: Text(hw.title, overflow: TextOverflow.ellipsis)),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : RefreshIndicator(
              color: kPrimary,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  _InfoCard(hw: hw, subjectColor: subjectColor),
                  const SizedBox(height: 14),
                  _buildStudentSection(),
                ],
              ),
            ),
    );
  }

  Widget _buildStudentSection() {
    final completedCount =
        _students.where((s) => (_subs[s.id]?['status'] ?? 'pending') == 'completed').length;
    final inProgressCount =
        _students.where((s) => (_subs[s.id]?['status'] ?? 'pending') == 'in_progress').length;
    final pendingCount = _students.length - completedCount - inProgressCount;

    return Container(
      decoration: BoxDecoration(
        color: kCardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6, offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text('Students', style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700, color: kTextPrimary,
                  )),
                  const SizedBox(width: 6),
                  Text('(${_students.length})', style: const TextStyle(
                    fontSize: 13, color: kTextMuted,
                  )),
                ]),
                const SizedBox(height: 8),
                // Stats row
                Row(children: [
                  _StatDot(label: 'Completed', count: completedCount, color: kSuccess),
                  const SizedBox(width: 16),
                  _StatDot(label: 'In Progress', count: inProgressCount, color: kWarning),
                  const SizedBox(width: 16),
                  _StatDot(label: 'Pending', count: pendingCount, color: kDanger),
                ]),
              ],
            ),
          ),
          const Divider(height: 1, color: kBorder),

          if (_students.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('No students assigned',
                  style: TextStyle(color: kTextMuted, fontSize: 13))),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _students.length,
              separatorBuilder: (_, _) => const Divider(height: 1, color: kBorder),
              itemBuilder: (_, i) {
                final s = _students[i];
                final sub = _subs[s.id];
                final status = sub?['status'] as String? ?? 'pending';
                final submittedAt = sub?['submittedAt'] as String?;
                final isSaving = _savingId == s.id;

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(children: [
                    // Index circle
                    Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(
                        color: kBackground,
                        shape: BoxShape.circle,
                        border: Border.all(color: kBorder),
                      ),
                      child: Center(child: Text('${i + 1}', style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700, color: kTextSecondary,
                      ))),
                    ),
                    const SizedBox(width: 12),
                    // Name + admission
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.name, style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600, color: kTextPrimary,
                          )),
                          if (s.admissionNumber != null) ...[
                            const SizedBox(height: 2),
                            Text(s.admissionNumber!, style: const TextStyle(
                              fontSize: 11, color: kTextMuted,
                            )),
                          ],
                          if (submittedAt != null &&
                              DateTime.tryParse(submittedAt) != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              DateFormat('dd MMM, hh:mm a')
                                  .format(DateTime.parse(submittedAt).toLocal()),
                              style: const TextStyle(fontSize: 10, color: kTextMuted),
                            ),
                          ],
                        ],
                      ),
                    ),
                    // Status pill (tappable)
                    isSaving
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: kPrimary))
                        : GestureDetector(
                            onTap: () => _showStatusPicker(s),
                            child: _SubStatusPill(status: status),
                          ),
                  ]),
                );
              },
            ),

          // Footer
          if (_students.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: kBorder)),
              ),
              child: Text(
                '$completedCount/${_students.length} students completed',
                style: const TextStyle(fontSize: 12, color: kTextMuted),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Info card ──────────────────────────────────────────────────────────────────
class _InfoCard extends StatelessWidget {
  final Homework hw;
  final Color subjectColor;

  const _InfoCard({required this.hw, required this.subjectColor});

  @override
  Widget build(BuildContext context) {
    final dueDateParsed = hw.dueDate != null ? DateTime.tryParse(hw.dueDate!) : null;
    final assignedDateParsed = hw.assignedDate != null ? DateTime.tryParse(hw.assignedDate!) : null;
    final isOverdue = dueDateParsed != null &&
        dueDateParsed.isBefore(DateTime.now()) &&
        hw.status == 'active';

    return Container(
      decoration: BoxDecoration(
        color: kCardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6, offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row + status
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text(hw.title, style: const TextStyle(
              fontSize: 17, fontWeight: FontWeight.w800, color: kTextPrimary,
            ))),
            const SizedBox(width: 10),
            _StatusBadge(status: hw.status, isOverdue: isOverdue),
          ]),
          const SizedBox(height: 10),

          // Subject + Class chips
          if (hw.subject != null || hw.classRef != null)
            Wrap(spacing: 8, runSpacing: 6, children: [
              if (hw.subject != null)
                _InfoChip(
                  icon: Icons.book_outlined,
                  label: hw.subject!.name,
                  color: subjectColor,
                ),
              if (hw.classRef != null)
                _InfoChip(
                  icon: Icons.class_outlined,
                  label: hw.classRef!.fullName,
                  color: kTextSecondary,
                ),
              _InfoChip(
                icon: Icons.people_outline,
                label: hw.assignedTo == 'all' ? 'All Students' : 'Selected Students',
                color: hw.assignedTo == 'all' ? kPrimary : kWarning,
              ),
            ]),
          const SizedBox(height: 14),

          // Date grid
          Row(children: [
            Expanded(child: _DateBox(
              label: 'Assigned Date',
              date: assignedDateParsed,
              isOverdue: false,
            )),
            const SizedBox(width: 10),
            Expanded(child: _DateBox(
              label: isOverdue ? 'Due Date · OVERDUE' : 'Due Date',
              date: dueDateParsed,
              isOverdue: isOverdue,
            )),
          ]),

          // Description
          if (hw.description != null && hw.description!.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Divider(height: 1, color: kBorder),
            const SizedBox(height: 14),
            const Text('Description', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: kTextMuted, letterSpacing: 0.5,
            )),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: kBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: kBorder),
              ),
              child: Text(hw.description!, style: const TextStyle(
                fontSize: 13, color: kTextSecondary, height: 1.6,
              )),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Date box ───────────────────────────────────────────────────────────────────
class _DateBox extends StatelessWidget {
  final String label;
  final DateTime? date;
  final bool isOverdue;

  const _DateBox({required this.label, required this.date, required this.isOverdue});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isOverdue
            ? kDanger.withValues(alpha: 0.05)
            : kBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isOverdue ? kDanger.withValues(alpha: 0.4) : kBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(
            fontSize: 10, fontWeight: FontWeight.w700,
            color: isOverdue ? kDanger : kTextMuted,
            letterSpacing: 0.3,
          )),
          const SizedBox(height: 4),
          Text(
            date != null ? DateFormat('dd MMM yyyy').format(date!) : '—',
            style: TextStyle(
              fontSize: 15, fontWeight: FontWeight.w700,
              color: isOverdue ? kDanger : kTextPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Status badge ───────────────────────────────────────────────────────────────
class _StatusBadge extends StatelessWidget {
  final String status;
  final bool isOverdue;

  const _StatusBadge({required this.status, required this.isOverdue});

  @override
  Widget build(BuildContext context) {
    late String label;
    late Color color;
    if (isOverdue) {
      label = 'Overdue';
      color = kDanger;
    } else {
      switch (status) {
        case 'completed': label = 'Completed'; color = kSuccess; break;
        case 'cancelled': label = 'Cancelled'; color = kDanger; break;
        default: label = 'Active'; color = kPrimary;
      }
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(label, style: TextStyle(
        fontSize: 11, fontWeight: FontWeight.w700, color: color,
      )),
    );
  }
}

// ── Info chip ──────────────────────────────────────────────────────────────────
class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(
          fontSize: 12, fontWeight: FontWeight.w600, color: color,
        )),
      ]),
    );
  }
}

// ── Stat dot ───────────────────────────────────────────────────────────────────
class _StatDot extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _StatDot({required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 8, height: 8,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
      const SizedBox(width: 5),
      Text('$count $label', style: TextStyle(
        fontSize: 12, fontWeight: FontWeight.w600, color: color,
      )),
    ]);
  }
}

// ── Submission status pill ─────────────────────────────────────────────────────
class _SubStatusPill extends StatelessWidget {
  final String status;

  const _SubStatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    late String label;
    late Color color;
    switch (status) {
      case 'completed': label = 'Completed'; color = kSuccess; break;
      case 'in_progress': label = 'In Progress'; color = kWarning; break;
      default: label = 'Pending'; color = kDanger;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 6, height: 6,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w600, color: color,
        )),
      ]),
    );
  }
}
