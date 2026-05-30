import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentAttendanceScreen extends StatefulWidget {
  const StudentAttendanceScreen({super.key});
  @override
  State<StudentAttendanceScreen> createState() => _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends State<StudentAttendanceScreen> {
  List<dynamic> _records = [];
  bool _loading = true;
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sp = context.read<StudentProfileProvider>();
    final studentId = sp.profile?.id;
    if (studentId == null) { setState(() => _loading = false); return; }
    setState(() => _loading = true);
    try {
      final from = DateTime(_month.year, _month.month, 1);
      final to   = DateTime(_month.year, _month.month + 1, 0);
      final res  = await ApiClient.get('/attendance', params: {
        'studentId': studentId,
        'from': from.toIso8601String(),
        'to': to.toIso8601String(),
      });
      setState(() {
        _records = res.data['attendance'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() => _month = DateTime(_month.year, _month.month + delta));
    _load();
  }

  Map<int, String> get _dayMap {
    final m = <int, String>{};
    for (final r in _records) {
      try {
        final d = DateTime.parse(r['date'].toString());
        m[d.day] = r['status'] as String? ?? '';
      } catch (_) {}
    }
    return m;
  }

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final firstWeekday = DateTime(_month.year, _month.month, 1).weekday % 7;
    final dayMap = _dayMap;
    final present = _records.where((r) => r['status'] == 'present').length;
    final total   = _records.length;
    final pct     = total > 0 ? (present * 100 / total).round() : 0;
    final months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Month selector
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(onPressed: () => _changeMonth(-1), icon: const Icon(Icons.chevron_left)),
                Text(
                  '${months[_month.month - 1]} ${_month.year}',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                IconButton(onPressed: () => _changeMonth(1), icon: const Icon(Icons.chevron_right)),
              ],
            ),
            // Stats
            if (!_loading) ...[
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                _stat('Present', present.toString(), AppColors.accentGreen),
                const SizedBox(width: 24),
                _stat('Total',   total.toString(),   AppColors.primary),
                const SizedBox(width: 24),
                _stat('%',       '$pct%',            _pctColor(pct)),
              ]),
              const SizedBox(height: 16),
            ],
            // Calendar grid
            if (_loading)
              const Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())
            else
              _buildCalendar(daysInMonth, firstWeekday, dayMap),
            const SizedBox(height: 16),
            // Legend
            Wrap(spacing: 16, children: [
              _legend('Present', AppColors.accentGreen),
              _legend('Absent',  AppColors.accentRed),
              _legend('Late',    AppColors.warning),
              _legend('Leave',   AppColors.textMuted),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _buildCalendar(int days, int firstDay, Map<int, String> map) {
    final cells = <Widget>[];
    for (final d in ['S','M','T','W','T','F','S']) {
      cells.add(Center(child: Text(d, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted))));
    }
    for (int i = 0; i < firstDay; i++) {
      cells.add(const SizedBox());
    }
    for (int d = 1; d <= days; d++) {
      final status = map[d];
      final color  = _statusColor(status);
      cells.add(Container(
        margin: const EdgeInsets.all(3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
        child: Center(
          child: Text(
            '$d',
            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500,
                color: status != null ? color : AppColors.textPrimary),
          ),
        ),
      ));
    }
    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: cells,
    );
  }

  Widget _stat(String label, String value, Color color) => Column(children: [
    Text(value, style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: color)),
    Text(label,  style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
  ]);

  Widget _legend(String label, Color color) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
  ]);

  Color _statusColor(String? s) {
    switch (s) {
      case 'present': return AppColors.accentGreen;
      case 'absent':  return AppColors.accentRed;
      case 'late':    return AppColors.warning;
      case 'cl': case 'sl': case 'od': case 'excused': return AppColors.textMuted;
      default: return Colors.transparent;
    }
  }

  Color _pctColor(int p) {
    if (p >= 75) return AppColors.accentGreen;
    if (p >= 50) return AppColors.warning;
    return AppColors.accentRed;
  }
}
