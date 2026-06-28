import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
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

  // Break fees down per term if terms[] exists, otherwise per fee type record.
  List<Map<String, dynamic>> _buildRows() {
    final rows = <Map<String, dynamic>>[];
    for (final f in _fees) {
      if (f is! Map) continue;
      final terms = (f['terms'] is List) ? f['terms'] as List : const [];
      if (terms.isNotEmpty) {
        for (final t in terms) {
          if (t is! Map) continue;
          final net = (t['netAmount'] as num? ?? 0).toInt();
          final paid = (t['paidAmount'] as num? ?? 0).toInt();
          rows.add({
            'name': (t['name'] ?? 'Term').toString(),
            'paid': paid,
            'net': net,
            'status': (t['status'] ?? _deriveStatus(paid, net)).toString(),
          });
        }
      } else {
        final net = (f['netAmount'] as num? ?? 0).toInt();
        final paid = (f['paidAmount'] as num? ?? 0).toInt();
        rows.add({
          'name':
              (f['feeType']?['name'] ?? f['description'] ?? 'Fee').toString(),
          'paid': paid,
          'net': net,
          'status': (f['status'] ?? _deriveStatus(paid, net)).toString(),
        });
      }
    }
    return rows;
  }

  String _deriveStatus(int paid, int net) {
    if (paid <= 0) return 'pending';
    if (paid >= net) return 'paid';
    return 'partial';
  }

  String _fmtShort(int v) {
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}k';
    return '$v';
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
    final totalStatus = totalPaid <= 0
        ? 'pending'
        : (totalPaid >= totalDue ? 'paid' : 'partial');

    final rows = _buildRows();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: _loading
          ? const _FeesSkeleton()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Gradient summary card ───────────────────────────────
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
                          Text('₹${_fmtShort(pending)}',
                              style:
                                  AppTypography.s30Bold(color: Colors.white)),
                          const SizedBox(height: 16),
                          Row(children: [
                            _SummaryItem('Total', '₹${_fmtShort(totalDue)}'),
                            const SizedBox(width: 20),
                            _SummaryItem('Paid', '₹${_fmtShort(totalPaid)}'),
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
                              valueColor: const AlwaysStoppedAnimation(
                                  Colors.white),
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
                    // ── Section label ──────────────────────────────────────
                    Text('Fee Breakdown',
                        style: AppTypography.s14SemiBold(
                            color: isDark
                                ? Colors.white
                                : AppColors.textPrimary)),
                    const SizedBox(height: 10),

                    // ── Category rows ──────────────────────────────────────
                    ...rows.map((r) => _FeeRow(
                          name: r['name'] as String,
                          paid: r['paid'] as int,
                          net: r['net'] as int,
                          status: r['status'] as String,
                          isDark: isDark,
                        )),

                    // ── Total row ──────────────────────────────────────────
                    _TotalRow(
                        paid: totalPaid,
                        net: totalDue,
                        status: totalStatus,
                        isDark: isDark),
                  ],
                ],
              ),
            ),
    );
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
class _FeesSkeleton extends StatelessWidget {
  const _FeesSkeleton();

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: const [
          SkeletonBox(height: 160, radius: 20),
          SizedBox(height: 20),
          SkeletonBox(width: 130, height: 14),
          SizedBox(height: 10),
          SkeletonBox(height: 64, radius: 12),
          SizedBox(height: 10),
          SkeletonBox(height: 64, radius: 12),
          SizedBox(height: 10),
          SkeletonBox(height: 64, radius: 12),
          SizedBox(height: 10),
          SkeletonBox(height: 64, radius: 12),
        ],
      ),
    );
  }
}

// ── Summary item inside gradient card ────────────────────────────────────────
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

// ── Category fee row ──────────────────────────────────────────────────────────
class _FeeRow extends StatelessWidget {
  final String name, status;
  final int paid, net;
  final bool isDark;
  const _FeeRow(
      {required this.name,
      required this.paid,
      required this.net,
      required this.status,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    final sColor = _statusColor(status);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Row(children: [
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name,
                style: AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 3),
            Text('₹$paid / ₹$net',
                style: AppTypography.s12Regular(color: AppColors.textMuted)),
          ]),
        ),
        // Status badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: sColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            status.isEmpty ? '' : status[0].toUpperCase() + status.substring(1),
            style: AppTypography.s12SemiBold(color: sColor),
          ),
        ),
      ]),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'paid':
        return AppColors.accentGreen;
      case 'partial':
        return AppColors.warning;
      case 'overdue':
        return AppColors.accentRed;
      default:
        return AppColors.textMuted;
    }
  }
}

// ── Total fees row ────────────────────────────────────────────────────────────
class _TotalRow extends StatelessWidget {
  final int paid, net;
  final String status;
  final bool isDark;
  const _TotalRow(
      {required this.paid,
      required this.net,
      required this.status,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    final sColor = _statusColor(status);
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color:
            AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(children: [
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Total Fees',
                style: AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 3),
            Text('₹$paid / ₹$net',
                style: AppTypography.s12SemiBold(color: AppColors.primary)),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: sColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            status.isEmpty ? '' : status[0].toUpperCase() + status.substring(1),
            style: AppTypography.s12SemiBold(color: sColor),
          ),
        ),
      ]),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'paid':
        return AppColors.accentGreen;
      case 'partial':
        return AppColors.warning;
      case 'overdue':
        return AppColors.accentRed;
      default:
        return AppColors.textMuted;
    }
  }
}
