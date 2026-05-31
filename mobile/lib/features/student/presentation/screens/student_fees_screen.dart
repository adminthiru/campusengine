import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final studentId = context.read<StudentProfileProvider>().profile?.id;
    if (studentId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final res =
          await ApiClient.get('/fees', params: {'studentId': studentId});
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    int totalDue = 0, totalPaid = 0;
    for (final f in _fees) {
      totalDue += (f['netAmount'] as num? ?? 0).toInt();
      totalPaid += (f['paidAmount'] as num? ?? 0).toInt();
    }
    final pending = totalDue - totalPaid;
    final pct = totalDue > 0 ? (totalPaid / totalDue * 100).round() : 100;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Summary Card ────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: pending > 0
                            ? [AppColors.accentRed, const Color(0xFFDC2626)]
                            : [AppColors.accentGreen, const Color(0xFF059669)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pending > 0 ? 'Amount Due' : 'All Cleared',
                              style: AppTypography.s14Regular(
                                  color: Colors.white.withValues(alpha: 0.85))),
                          const SizedBox(height: 6),
                          Text('₹${_fmt(pending)}',
                              style:
                                  AppTypography.s30Bold(color: Colors.white)),
                          const SizedBox(height: 16),
                          Row(children: [
                            _SummaryItem('Total', '₹${_fmt(totalDue)}'),
                            const SizedBox(width: 20),
                            _SummaryItem('Paid', '₹${_fmt(totalPaid)}'),
                            const SizedBox(width: 20),
                            _SummaryItem('Done', '$pct%'),
                          ]),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: pct / 100,
                              backgroundColor:
                                  Colors.white.withValues(alpha: 0.3),
                              valueColor:
                                  const AlwaysStoppedAnimation(Colors.white),
                              minHeight: 6,
                            ),
                          ),
                        ]),
                  ),
                  const SizedBox(height: 20),

                  if (_fees.isEmpty)
                    Center(
                        child: Column(children: [
                      const SizedBox(height: 40),
                      Icon(Icons.receipt_outlined,
                          size: 56, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      Text('No fee records',
                          style: AppTypography.s16SemiBold(
                              color: AppColors.textMuted)),
                    ]))
                  else ...[
                    Text('Fee Breakdown',
                        style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    const SizedBox(height: 10),
                    ..._fees.map((f) => _FeeCard(fee: f, isDark: isDark)),
                  ],
                ],
              ),
            ),
    );
  }

  String _fmt(int v) {
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}k';
    return '$v';
  }
}

class _SummaryItem extends StatelessWidget {
  final String label, value;
  const _SummaryItem(this.label, this.value);

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: AppTypography.s14Bold(color: Colors.white)),
          Text(label,
              style: AppTypography.s11Regular(
                  color: Colors.white.withValues(alpha: 0.8))),
        ],
      );
}

class _FeeCard extends StatelessWidget {
  final dynamic fee;
  final bool isDark;
  const _FeeCard({required this.fee, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final feeType = fee['feeType']?['name'] as String? ??
        fee['description'] as String? ??
        'Fee';
    final net = (fee['netAmount'] as num? ?? 0).toInt();
    final paid = (fee['paidAmount'] as num? ?? 0).toInt();
    final status = fee['status'] as String? ?? 'pending';
    final dueDate = fee['dueDate'];
    String due = '';
    try {
      final dt = DateTime.parse(dueDate.toString());
      due = '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {}

    final Color statusColor;
    switch (status) {
      case 'paid':
        statusColor = AppColors.accentGreen;
        break;
      case 'partial':
        statusColor = AppColors.warning;
        break;
      case 'overdue':
        statusColor = AppColors.accentRed;
        break;
      default:
        statusColor = AppColors.textMuted;
    }
    final pct = net > 0 ? (paid / net).clamp(0.0, 1.0) : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
              child: Text(feeType,
                  style: AppTypography.s14SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(status[0].toUpperCase() + status.substring(1),
                style: AppTypography.s12SemiBold(color: statusColor)),
          ),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Text('₹$paid',
              style: AppTypography.s16Bold(color: AppColors.accentGreen)),
          Text(' / ₹$net',
              style: AppTypography.s14Regular(color: AppColors.textMuted)),
          if (due.isNotEmpty) ...[
            const Spacer(),
            Icon(Icons.calendar_today_outlined,
                size: 12, color: AppColors.textMuted),
            const SizedBox(width: 4),
            Text('Due $due',
                style: AppTypography.s12Regular(color: AppColors.textMuted)),
          ],
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct.toDouble(),
            backgroundColor:
                isDark ? AppColors.borderDark : AppColors.borderLight,
            valueColor: AlwaysStoppedAnimation(statusColor),
            minHeight: 5,
          ),
        ),
      ]),
    );
  }
}
