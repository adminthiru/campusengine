import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentTimetableScreen extends StatefulWidget {
  const StudentTimetableScreen({super.key});
  @override
  State<StudentTimetableScreen> createState() => _StudentTimetableScreenState();
}

class _StudentTimetableScreenState extends State<StudentTimetableScreen> {
  List<dynamic> _slots = [];
  bool _loading = true;
  int _selectedDay = DateTime.now().weekday; // 1=Mon … 6=Sat

  static const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sp = context.read<StudentProfileProvider>();
    final classId = sp.profile?.classId;
    if (classId == null) { setState(() => _loading = false); return; }
    try {
      final res = await ApiClient.get('/timetable', params: {'classId': classId});
      setState(() {
        _slots = res.data['timetable'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<dynamic> get _daySlots =>
      _slots.where((s) => s['day'] == _selectedDay).toList()
        ..sort((a, b) => (a['period'] as int? ?? 0).compareTo(b['period'] as int? ?? 0));

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Day selector
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: List.generate(_days.length, (i) {
              final day = i + 1;
              final sel = day == _selectedDay;
              return GestureDetector(
                onTap: () => setState(() => _selectedDay = day),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: sel ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: sel ? AppColors.primary : AppColors.borderLight,
                    ),
                  ),
                  child: Text(
                    _days[i],
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: sel ? Colors.white : AppColors.textSecondary,
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _daySlots.isEmpty
                  ? Center(
                      child: Text(
                        'No classes on ${_days[_selectedDay - 1]}',
                        style: GoogleFonts.inter(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _daySlots.length,
                      itemBuilder: (_, i) {
                        final s = _daySlots[i];
                        final isDark = Theme.of(context).brightness == Brightness.dark;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.cardDark : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark ? AppColors.borderDark : AppColors.borderLight,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Center(
                                  child: Text(
                                    '${s['period'] ?? i + 1}',
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      s['subject']?['name'] ?? 'Subject',
                                      style: GoogleFonts.inter(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (s['teacher']?['name'] != null)
                                      Text(
                                        s['teacher']['name'],
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              if (s['startTime'] != null)
                                Text(
                                  '${s['startTime']} – ${s['endTime'] ?? ''}',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}
