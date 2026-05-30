import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentExamsScreen extends StatefulWidget {
  const StudentExamsScreen({super.key});
  @override
  State<StudentExamsScreen> createState() => _StudentExamsScreenState();
}

class _StudentExamsScreenState extends State<StudentExamsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<dynamic> _upcoming = [];
  List<dynamic> _results = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final sp = context.read<StudentProfileProvider>();
    final classId = sp.profile?.classId;
    final studentId = sp.profile?.id;
    try {
      final futures = await Future.wait([
        if (classId != null)
          ApiClient.get('/exams', params: {'classId': classId})
        else
          Future.value(null),
        if (studentId != null)
          ApiClient.get('/exams/results', params: {'studentId': studentId})
        else
          Future.value(null),
      ]);
      setState(() {
        _upcoming = (futures[0]?.data['exams'] as List<dynamic>? ?? [])
            .where((e) => e['status'] != 'completed' || e['published'] != true)
            .toList();
        _results = (futures[1]?.data['results'] as List<dynamic>? ?? [])
            .where((r) => r['exam']?['published'] == true)
            .toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tab,
          tabs: [
            Tab(text: 'Upcoming (${_upcoming.length})'),
            Tab(text: 'Results (${_results.length})'),
          ],
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tab,
                  children: [_UpcomingList(_upcoming), _ResultsList(_results)],
                ),
        ),
      ],
    );
  }
}

class _UpcomingList extends StatelessWidget {
  final List<dynamic> items;
  const _UpcomingList(this.items);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
          child: Text('No upcoming exams', style: GoogleFonts.inter(color: AppColors.textMuted)));
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final e = items[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(e['name'] ?? '', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Row(children: [
                _chip(_statusLabel(e['status']), _statusColor(e['status'])),
                const SizedBox(width: 8),
                if (e['examDate'] != null)
                  Text(_fmt(e['examDate']),
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
              ]),
              if ((e['subjects'] as List?)?.isNotEmpty == true) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: (e['subjects'] as List)
                      .map((s) => _chip(s['subject']?['name'] ?? s.toString(), AppColors.primary))
                      .toList(),
                ),
              ],
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
        child: Text(label, style: GoogleFonts.inter(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
      );

  Color _statusColor(dynamic s) {
    switch (s) { case 'scheduled': return AppColors.info; case 'ongoing': return AppColors.warning; default: return AppColors.textMuted; }
  }

  String _statusLabel(dynamic s) {
    switch (s) { case 'scheduled': return 'Scheduled'; case 'ongoing': return 'Ongoing'; default: return s?.toString() ?? ''; }
  }

  String _fmt(dynamic d) {
    try { final dt = DateTime.parse(d.toString()); return '${dt.day}/${dt.month}/${dt.year}'; } catch (_) { return d.toString(); }
  }
}

class _ResultsList extends StatelessWidget {
  final List<dynamic> items;
  const _ResultsList(this.items);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
          child: Text('No published results yet', style: GoogleFonts.inter(color: AppColors.textMuted)));
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final r = items[i];
        final exam = r['exam'] as Map<String, dynamic>? ?? {};
        final marks = r['marks'] as List<dynamic>? ?? [];
        int totalMarks = 0, maxMarks = 0;
        for (final m in marks) {
          totalMarks += (m['marksObtained'] as num? ?? 0).toInt();
          maxMarks += (m['maxMarks'] as num? ?? 0).toInt();
        }
        final pct = maxMarks > 0 ? (totalMarks * 100 / maxMarks).round() : 0;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(exam['name'] ?? '', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _pctColor(pct).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('$pct%', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: _pctColor(pct))),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text('$totalMarks / $maxMarks marks', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
              if (marks.isNotEmpty) ...[
                const SizedBox(height: 8),
                ...marks.map((m) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(m['subject']?['name'] ?? '', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary)),
                      Text('${m['marksObtained']}/${m['maxMarks']}', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500)),
                    ],
                  ),
                )),
              ],
            ],
          ),
        );
      },
    );
  }

  Color _pctColor(int pct) {
    if (pct >= 75) return AppColors.accentGreen;
    if (pct >= 50) return AppColors.warning;
    return AppColors.accentRed;
  }
}
