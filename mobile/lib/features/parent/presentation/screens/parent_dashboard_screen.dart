import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';

class ParentDashboardScreen extends StatefulWidget {
  const ParentDashboardScreen({super.key});
  @override
  State<ParentDashboardScreen> createState() => _ParentDashboardScreenState();
}

class _ParentDashboardScreenState extends State<ParentDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pp = context.read<ParentDataProvider>();
      if (pp.children.isEmpty && !pp.loading) pp.fetchChildren();
    });
  }

  @override
  Widget build(BuildContext context) {
    final pp    = context.watch<ParentDataProvider>();
    final perms = context.watch<SchoolPermissionsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RefreshIndicator(
      onRefresh: () => pp.fetchChildren(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'My Children',
              style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            if (pp.loading)
              const Center(child: CircularProgressIndicator())
            else if (pp.children.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.cardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Center(
                  child: Text(
                    'No children linked to this account',
                    style: GoogleFonts.inter(color: AppColors.textMuted),
                  ),
                ),
              )
            else
              ...pp.children.map((child) => _ChildCard(child: child, isDark: isDark)),

            if (pp.children.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text('Quick Actions', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.4,
                children: [
                  _Tile('Children Info', Icons.people_outlined, AppColors.primary,
                      () => context.go('/parent/children')),
                  if (perms.parentCan('submitLeaveRequest'))
                    _Tile('Leave Request', Icons.event_note_outlined, AppColors.accentRed,
                        () => context.go('/parent/leave')),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  final dynamic child;
  final bool isDark;
  const _ChildCard({required this.child, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final cls = child.classLabel as String;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            child: Text(
              (child.name as String).substring(0, 1).toUpperCase(),
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primary),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(child.name as String, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                Text(cls, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted)),
                Text(child.admissionNumber as String, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _Tile(this.label, this.icon, this.color, this.onTap);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
