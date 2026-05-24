import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/homework.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/empty_state.dart';
import 'create_homework_screen.dart';
import 'homework_detail_screen.dart';

class HomeworkScreen extends StatefulWidget {
  const HomeworkScreen({super.key});

  @override
  State<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends State<HomeworkScreen> {
  List<Homework> _list = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/homework');
      final raw = res.data['homework'] ?? res.data['homeworks'] ?? [];
      setState(() {
        _list = (raw as List).map((h) => Homework.fromJson(h)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Color _subjectColor(String? hex) {
    if (hex == null || hex.isEmpty) return kPurple;
    try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
    catch (_) { return kPurple; }
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<TeacherProfileProvider>();
    final canAssign =
        (profile.profile?.permissions.classTeacher.assignHomework ?? false) ||
        (profile.profile?.permissions.subjectTeacher.assignHomework ?? false);

    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      floatingActionButton: canAssign
          ? FloatingActionButton(
              backgroundColor: kPrimary,
              onPressed: () async {
                final added = await Navigator.push<bool>(context,
                    MaterialPageRoute(builder: (_) => const CreateHomeworkScreen()));
                if (added == true) _fetch();
              },
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : RefreshIndicator(
              color: kPrimary,
              onRefresh: _fetch,
              child: _list.isEmpty
                  ? const EmptyState(
                      icon: Icons.book_outlined,
                      title: 'No homework yet',
                      subtitle: 'Homework you assign will appear here',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: _list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, i) => GestureDetector(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => HomeworkDetailScreen(hw: _list[i]),
                          ),
                        ),
                        child: _HomeworkCard(
                          hw: _list[i],
                          accentColor: _subjectColor(_list[i].subject?.color),
                        ),
                      ),
                    ),
            ),
    );
  }
}

// ── Card ───────────────────────────────────────────────────────────────────────
class _HomeworkCard extends StatelessWidget {
  final Homework hw;
  final Color accentColor;

  const _HomeworkCard({required this.hw, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    final dueDateParsed = hw.dueDate != null
        ? DateTime.tryParse(hw.dueDate!)
        : null;
    final assignedDateParsed = hw.assignedDate != null
        ? DateTime.tryParse(hw.assignedDate!)
        : null;
    final isOverdue = dueDateParsed != null &&
        dueDateParsed.isBefore(DateTime.now()) &&
        hw.status == 'active';

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        children: [
          Container(
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
            padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Row 1: Title + Status badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(hw.title, style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700,
                        color: kTextPrimary,
                      )),
                    ),
                    const SizedBox(width: 8),
                    _StatusBadge(status: hw.status, isOverdue: isOverdue),
                  ],
                ),

                const SizedBox(height: 8),

                // Row 2: Subject chip + Class chip
                if (hw.subject != null || hw.classRef != null)
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (hw.subject != null)
                        _Chip(
                          icon: Icons.book_outlined,
                          label: hw.subject!.name,
                          color: accentColor,
                        ),
                      if (hw.classRef != null)
                        _Chip(
                          icon: Icons.class_outlined,
                          label: hw.classRef!.fullName,
                          color: kTextSecondary,
                        ),
                      if (hw.assignedTo == 'selected')
                        _Chip(
                          icon: Icons.people_outline,
                          label: 'Selected Students',
                          color: kWarning,
                        ),
                    ],
                  ),

                if (hw.description != null && hw.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(hw.description!, style: const TextStyle(
                    fontSize: 12, color: kTextSecondary,
                  ), maxLines: 2, overflow: TextOverflow.ellipsis),
                ],

                const SizedBox(height: 10),
                const Divider(height: 1, color: kBorder),
                const SizedBox(height: 10),

                // Row 3: Assigned date + Due date
                Row(
                  children: [
                    if (assignedDateParsed != null) ...[
                      const Icon(Icons.calendar_today_outlined,
                          size: 12, color: kTextMuted),
                      const SizedBox(width: 4),
                      Text(
                        'Assigned: ${DateFormat('dd MMM yyyy').format(assignedDateParsed)}',
                        style: const TextStyle(fontSize: 11, color: kTextMuted),
                      ),
                      const SizedBox(width: 14),
                    ],
                    if (dueDateParsed != null) ...[
                      Icon(Icons.event_outlined,
                          size: 12,
                          color: isOverdue ? kDanger : kTextMuted),
                      const SizedBox(width: 4),
                      Text(
                        'Due: ${DateFormat('dd MMM yyyy').format(dueDateParsed)}',
                        style: TextStyle(
                          fontSize: 11,
                          color: isOverdue ? kDanger : kTextMuted,
                          fontWeight: isOverdue ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          // Left accent strip
          Positioned(
            left: 0, top: 0, bottom: 0,
            child: Container(width: 4, color: accentColor),
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
        case 'completed':
          label = 'Completed';
          color = kSuccess;
          break;
        case 'cancelled':
          label = 'Cancelled';
          color = kDanger;
          break;
        default: // active
          label = 'Active';
          color = kPrimary;
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
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

// ── Chip ───────────────────────────────────────────────────────────────────────
class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _Chip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600, color: color,
          )),
        ],
      ),
    );
  }
}
