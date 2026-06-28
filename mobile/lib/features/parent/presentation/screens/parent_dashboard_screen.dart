import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';

class ParentDashboardScreen extends StatefulWidget {
  const ParentDashboardScreen({super.key});
  @override
  State<ParentDashboardScreen> createState() => _ParentDashboardScreenState();
}

class _ParentDashboardScreenState extends State<ParentDashboardScreen> {
  // childId → {present, absent, total}
  final Map<String, Map<String, int>> _attStats = {};
  // childId → pending fee amount
  final Map<String, int> _pendingFees = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pp = context.read<ParentDataProvider>();
      if (pp.children.isEmpty && !pp.loading) {
        pp.fetchChildren().then((_) => _loadStats(pp.children));
      } else {
        _loadStats(pp.children);
      }
    });
  }

  Future<void> _loadStats(List<ChildInfo> children) async {
    if (children.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);

    final now = DateTime.now();
    for (final child in children) {
      try {
        final r = await ApiClient.get('/attendance/summary', params: {
          'studentId': child.id,
          'month': now.month.toString(),
          'year': now.year.toString(),
        });
        final s = r.data['summary'] as Map<String, dynamic>? ?? {};
        _attStats[child.id] = {
          'present': (s['present'] as num? ?? 0).toInt(),
          'absent': (s['absent'] as num? ?? 0).toInt(),
          'total': (s['total'] as num? ?? 0).toInt(),
        };
      } catch (_) {}
      try {
        final r = await ApiClient.get('/fees', params: {'studentId': child.id});
        final fees = r.data['fees'] as List<dynamic>? ?? [];
        int pending = 0;
        for (final f in fees) {
          final net = (f['netAmount'] as num? ?? 0).toInt();
          final paid = (f['paidAmount'] as num? ?? 0).toInt();
          pending += (net - paid).clamp(0, net);
        }
        _pendingFees[child.id] = pending;
      } catch (_) {}
    }

    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final pp = context.watch<ParentDataProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final children = pp.children;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: pp.loading || _loading
          ? const SkeletonShimmer(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(height: 110, radius: 20),
                    SkeletonBox(height: 14, width: 120, margin: EdgeInsets.only(top: 24, bottom: 12)),
                    SkeletonCard(),
                    SizedBox(height: 12),
                    SkeletonCard(),
                    SizedBox(height: 12),
                    SkeletonCard(),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: () async {
                await pp.fetchChildren();
                await _loadStats(pp.children);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Welcome ──────────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        )
                      ],
                    ),
                    child: Row(children: [
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text('Good ${_greeting()},',
                                style: AppTypography.s14Regular(
                                    color:
                                        Colors.white.withValues(alpha: 0.85))),
                            const SizedBox(height: 4),
                            Text(auth.user?.name ?? 'Parent',
                                style:
                                    AppTypography.s20Bold(color: Colors.white),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 4),
                            Text(
                                '${children.length} child${children.length != 1 ? "ren" : ""} linked',
                                style: AppTypography.s13Regular(
                                    color:
                                        Colors.white.withValues(alpha: 0.75))),
                          ])),
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: Colors.white.withValues(alpha: 0.2),
                        child: Text(
                          (auth.user?.name ?? 'P')[0].toUpperCase(),
                          style: AppTypography.s24Bold(color: Colors.white),
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 20),

                  // ── Children Cards ───────────────────────────────────────
                  if (children.isEmpty)
                    Center(
                        child: Column(children: [
                      const SizedBox(height: 20),
                      Icon(Icons.child_care,
                          size: 56, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      Text('No children linked',
                          style: AppTypography.s16SemiBold(
                              color: AppColors.textMuted)),
                    ]))
                  else ...[
                    Text('Children Overview',
                        style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    const SizedBox(height: 10),
                    ...children.map((child) => _ChildCard(
                          child: child,
                          att: _attStats[child.id],
                          pendingFee: _pendingFees[child.id] ?? 0,
                          isDark: isDark,
                          onTap: () => context.go('/parent/children'),
                        )),
                  ],
                  const SizedBox(height: 80),
                ],
              ),
            ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }
}

class _ChildCard extends StatelessWidget {
  final ChildInfo child;
  final Map<String, int>? att;
  final int pendingFee;
  final bool isDark;
  final VoidCallback onTap;
  const _ChildCard(
      {required this.child,
      required this.att,
      required this.pendingFee,
      required this.isDark,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    final present = att?['present'] ?? 0;
    final total = att?['total'] ?? 0;
    final pct = total > 0 ? (present / total * 100).round() : 0;
    final attColor = pct >= 75 ? AppColors.accentGreen : AppColors.accentRed;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              child: Text(child.initial,
                  style: AppTypography.s16Bold(color: AppColors.primary)),
            ),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(child.name,
                      style: AppTypography.s15SemiBold(
                          color:
                              isDark ? Colors.white : AppColors.textPrimary)),
                  Text(child.classLabel,
                      style:
                          AppTypography.s12Regular(color: AppColors.textMuted)),
                ])),
            Icon(Icons.chevron_right, color: AppColors.textMuted),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            _MiniStat('Attendance', '$pct%', attColor, isDark),
            const SizedBox(width: 10),
            _MiniStat(
                'This Month',
                '${att?['present'] ?? 0}/${att?['total'] ?? 0} days',
                AppColors.primary,
                isDark),
            const SizedBox(width: 10),
            _MiniStat(
                'Fee Due',
                pendingFee > 0 ? '₹$pendingFee' : 'Cleared',
                pendingFee > 0 ? AppColors.accentRed : AppColors.accentGreen,
                isDark),
          ]),
        ]),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  final Color color;
  final bool isDark;
  const _MiniStat(this.label, this.value, this.color, this.isDark);

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(children: [
            Text(value,
                style: AppTypography.s13SemiBold(color: color),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text(label,
                style: AppTypography.s11Regular(color: AppColors.textMuted),
                textAlign: TextAlign.center),
          ]),
        ),
      );
}
