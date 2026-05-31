import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/core/theme/app_dimensions.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';

class ParentProfileScreen extends StatelessWidget {
  const ParentProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final pp = context.watch<ParentDataProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = auth.user;
    final children = pp.children;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // ── Profile Card ────────────────────────────────────────────────
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
              CircleAvatar(
                radius: 32,
                backgroundColor: Colors.white.withValues(alpha: 0.2),
                child: Text(
                  (user?.name ?? 'P')[0].toUpperCase(),
                  style: AppTypography.s24Bold(color: Colors.white),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(user?.name ?? 'Parent',
                        style: AppTypography.s18Bold(color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text('Parent / Guardian',
                        style: AppTypography.s13Regular(
                            color: Colors.white.withValues(alpha: 0.8))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${children.length} child${children.length != 1 ? "ren" : ""} linked',
                        style: AppTypography.s12SemiBold(color: Colors.white),
                      ),
                    ),
                  ])),
            ]),
          ),
          const SizedBox(height: 20),

          // ── Contact Info ─────────────────────────────────────────────────
          _SectionLabel('Contact Information', isDark),
          const SizedBox(height: 10),
          _InfoCard(isDark: isDark, children: [
            _InfoRow('Name', user?.name ?? '—', isDark),
            _Divider(isDark),
            _InfoRow('Email', user?.email ?? '—', isDark),
            _Divider(isDark),
            _InfoRow('Phone', user?.phone ?? '—', isDark),
          ]),
          const SizedBox(height: 20),

          // ── Children ─────────────────────────────────────────────────────
          if (children.isNotEmpty) ...[
            _SectionLabel('My Children', isDark),
            const SizedBox(height: 10),
            _InfoCard(isDark: isDark, children: [
              ...List.generate(children.length, (i) {
                final c = children[i];
                return Column(children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor:
                            AppColors.primary.withValues(alpha: 0.1),
                        child: Text(c.name[0].toUpperCase(),
                            style: AppTypography.s14Bold(
                                color: AppColors.primary)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(c.name,
                                style: AppTypography.s14SemiBold(
                                    color: isDark
                                        ? Colors.white
                                        : AppColors.textPrimary)),
                            Text(c.classLabel,
                                style: AppTypography.s12Regular(
                                    color: AppColors.textMuted)),
                            Text('Adm: ${c.admissionNumber}',
                                style: AppTypography.s12Regular(
                                    color: AppColors.textMuted)),
                          ])),
                    ]),
                  ),
                  if (i < children.length - 1) _Divider(isDark),
                ]);
              }),
            ]),
            const SizedBox(height: 20),
          ],

          // ── Actions ──────────────────────────────────────────────────────
          _SectionLabel('Actions', isDark),
          const SizedBox(height: 10),
          _ActionTile(
            icon: Icons.people_outlined,
            color: AppColors.primary,
            title: 'View Children Details',
            subtitle: 'Attendance, homework, fees & exams',
            isDark: isDark,
            onTap: () => context.go('/parent/children'),
          ),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.event_note_outlined,
            color: AppColors.warning,
            title: 'Leave Requests',
            subtitle: 'Apply and track leave requests',
            isDark: isDark,
            onTap: () => context.go('/parent/leave'),
          ),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.calendar_month_outlined,
            color: AppColors.accentPurple,
            title: 'School Calendar',
            subtitle: 'Holidays, events, exam days and school dates',
            isDark: isDark,
            onTap: () => context.go('/calendar'),
          ),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.logout,
            color: AppColors.accentRed,
            title: 'Logout',
            subtitle: 'Sign out of your account',
            isDark: isDark,
            isDestructive: true,
            onTap: () => _showLogoutBottomSheet(context, auth),
          ),
          const SizedBox(height: 32),
        ]),
      ),
    );
  }

  void _showLogoutBottomSheet(BuildContext context, AuthProvider authProvider) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          final isDark = themeProvider.isDark;
          return Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(AppDimensions.radiusLg),
                topRight: Radius.circular(AppDimensions.radiusLg),
              ),
            ),
            padding: const EdgeInsets.all(AppDimensions.base),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: AppDimensions.lg),
                Text(
                  'Log Out',
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                      color: AppColors.accentRed),
                ),
                const SizedBox(height: AppDimensions.sm),
                Text(
                  'Are you sure you want to log out of your account?',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                      fontSize: 14, color: AppColors.textSecondary),
                ),
                const SizedBox(height: AppDimensions.xl),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              vertical: AppDimensions.md),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppDimensions.radiusMd),
                          ),
                        ),
                        onPressed: () => Navigator.pop(context),
                        child: Text('Cancel',
                            style: TextStyle(
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w600,
                                inherit: false)),
                      ),
                    ),
                    const SizedBox(width: AppDimensions.base),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accentRed,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              vertical: AppDimensions.md),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppDimensions.radiusMd),
                          ),
                        ),
                        onPressed: () {
                          Navigator.pop(context);
                          authProvider.logout();
                        },
                        child: const Text('Log Out',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, inherit: false)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppDimensions.sm),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  final bool isDark;
  const _SectionLabel(this.label, this.isDark);

  @override
  Widget build(BuildContext context) => Text(
        label.toUpperCase(),
        style: AppTypography.s12SemiBold(
            color: isDark ? AppColors.textMuted : AppColors.textSecondary),
      );
}

class _InfoCard extends StatelessWidget {
  final bool isDark;
  final List<Widget> children;
  const _InfoCard({required this.isDark, required this.children});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(children: children),
      );
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  final bool isDark;
  const _InfoRow(this.label, this.value, this.isDark);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          SizedBox(
              width: 80,
              child: Text(label,
                  style: AppTypography.s13Regular(color: AppColors.textMuted))),
          Expanded(
              child: Text(value,
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary))),
        ]),
      );
}

class _Divider extends StatelessWidget {
  final bool isDark;
  const _Divider(this.isDark);
  @override
  Widget build(BuildContext context) => Divider(
      height: 1, color: isDark ? AppColors.borderDark : AppColors.borderLight);
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, subtitle;
  final bool isDark;
  final bool isDestructive;
  final VoidCallback onTap;
  const _ActionTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.isDark,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDestructive
                  ? AppColors.accentRed.withValues(alpha: 0.3)
                  : (isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            boxShadow: isDark ? [] : AppColors.shadowSm,
          ),
          child: Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(title,
                      style: AppTypography.s14SemiBold(
                          color: isDestructive
                              ? AppColors.accentRed
                              : (isDark
                                  ? Colors.white
                                  : AppColors.textPrimary))),
                  Text(subtitle,
                      style:
                          AppTypography.s12Regular(color: AppColors.textMuted)),
                ])),
            Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
          ]),
        ),
      );
}
