import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentHomeworkScreen extends StatefulWidget {
  const StudentHomeworkScreen({super.key});
  @override
  State<StudentHomeworkScreen> createState() => _StudentHomeworkScreenState();
}

class _StudentHomeworkScreenState extends State<StudentHomeworkScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<dynamic> _hw = [];
  bool _loading = true;
  final Set<String> _submitting = {};

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _loadHomework();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _loadHomework() async {
    final sp = context.read<StudentProfileProvider>();
    final classId = sp.profile?.classId;
    if (classId == null) { setState(() => _loading = false); return; }
    try {
      final res = await ApiClient.get('/homework', params: {'classId': classId});
      setState(() {
        _hw = (res.data['homework'] as List<dynamic>? ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _markDone(String hwId) async {
    setState(() => _submitting.add(hwId));
    try {
      await ApiClient.put('/homework/$hwId/complete', data: {'studentId': 'me'});
      await _loadHomework();
    } catch (_) {}
    setState(() => _submitting.remove(hwId));
  }

  @override
  Widget build(BuildContext context) {
    final perms = context.watch<SchoolPermissionsProvider>();
    final pending = _hw.where((h) => !(h['completed'] == true)).toList();
    final done = _hw.where((h) => h['completed'] == true).toList();

    return Column(
      children: [
        TabBar(
          controller: _tab,
          tabs: [
            Tab(text: 'Pending (${pending.length})'),
            Tab(text: 'Done (${done.length})'),
          ],
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tab,
                  children: [
                    _HwList(pending, perms.studentCan('submitHomework'), _markDone, _submitting, false),
                    _HwList(done, false, _markDone, _submitting, true),
                  ],
                ),
        ),
      ],
    );
  }
}

class _HwList extends StatelessWidget {
  final List<dynamic> items;
  final bool canSubmit;
  final Future<void> Function(String) onDone;
  final Set<String> submitting;
  final bool isDone;

  const _HwList(this.items, this.canSubmit, this.onDone, this.submitting, this.isDone);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
        child: Text(
          isDone ? 'No completed homework yet' : 'No pending homework',
          style: GoogleFonts.inter(color: AppColors.textMuted),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final hw = items[i];
        final id = hw['_id'] as String? ?? '';
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(hw['title'] ?? '',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              if (hw['description'] != null) ...[
                const SizedBox(height: 4),
                Text(hw['description'],
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary)),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  _chip(hw['subject']?['name'] ?? 'Subject', AppColors.primary),
                  const SizedBox(width: 8),
                  if (hw['dueDate'] != null)
                    _chip('Due: ${_fmt(hw['dueDate'])}', AppColors.accentOrange),
                  const Spacer(),
                  if (canSubmit)
                    submitting.contains(id)
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : TextButton(
                            onPressed: () => onDone(id),
                            child: Text('Mark Done',
                                style: GoogleFonts.inter(
                                    color: AppColors.accentGreen,
                                    fontWeight: FontWeight.w600)),
                          ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _chip(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
        child: Text(label,
            style: GoogleFonts.inter(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
      );

  String _fmt(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString());
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return d.toString();
    }
  }
}
