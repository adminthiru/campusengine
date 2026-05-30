import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentFeesScreen extends StatefulWidget {
  const StudentFeesScreen({super.key});
  @override
  State<StudentFeesScreen> createState() => _StudentFeesScreenState();
}

class _StudentFeesScreenState extends State<StudentFeesScreen> {
  List<dynamic> _fees = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sp = context.read<StudentProfileProvider>();
    final studentId = sp.profile?.id;
    if (studentId == null) { setState(() => _loading = false); return; }
    try {
      final res = await ApiClient.get('/fees', params: {'studentId': studentId});
      setState(() {
        _fees = res.data['fees'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    int totalDue = 0, totalPaid = 0;
    for (final f in _fees) {
      totalDue  += (f['netAmount']  as num? ?? 0).toInt();
      totalPaid += (f['paidAmount'] as num? ?? 0).toInt();
    }
    final pending = totalDue - totalPaid;

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (!_loading) ...[
              Row(
                children: [
                  _summaryCard('Total',   '₹$totalDue',  AppColors.textPrimary),
                  const SizedBox(width: 12),
                  _summaryCard('Paid',    '₹$totalPaid', AppColors.accentGreen),
                  const SizedBox(width: 12),
                  _summaryCard('Pending', '₹$pending',   pending > 0 ? AppColors.accentRed : AppColors.accentGreen),
                ],
              ),
              const SizedBox(height: 20),
            ],
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_fees.isEmpty)
              Center(child: Text('No fee records', style: GoogleFonts.inter(color: AppColors.textMuted)))
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _fees.length,
                itemBuilder: (_, i) {
                  final f = _fees[i];
                  final status  = f['status'] as String? ?? '';
                  final sColor  = _statusColor(status);
                  final isDark  = Theme.of(context).brightness == Brightness.dark;
                  final net     = (f['netAmount']  as num? ?? 0).toInt();
                  final paid    = (f['paidAmount'] as num? ?? 0).toInt();
                  final terms   = f['terms'] as List<dynamic>? ?? [];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.cardDark : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                    ),
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(f['feeType']?['name'] ?? f['description'] ?? 'Fee',
                                        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                                    Text('₹$paid / ₹$net',
                                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted)),
                                  ],
                                ),
                              ),
                              _chip(status, sColor),
                            ],
                          ),
                        ),
                        if (terms.isNotEmpty) ...[
                          Divider(height: 1, color: isDark ? AppColors.borderDark : AppColors.borderLight),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: Column(
                              children: terms.map((t) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(t['name'] ?? '', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary)),
                                    Text('₹${t['amount'] ?? 0}', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500)),
                                  ],
                                ),
                              )).toList(),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _summaryCard(String label, String val, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(children: [
        Text(val,   style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted)),
      ]),
    ),
  );

  Widget _chip(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
    child: Text(label[0].toUpperCase() + label.substring(1),
        style: GoogleFonts.inter(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
  );

  Color _statusColor(String s) {
    switch (s) {
      case 'paid':    return AppColors.accentGreen;
      case 'partial': return AppColors.warning;
      case 'overdue': return AppColors.accentRed;
      default:        return AppColors.textMuted;
    }
  }
}
