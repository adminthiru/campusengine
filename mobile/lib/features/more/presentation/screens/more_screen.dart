import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/theme/app_dimensions.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';
import 'package:skl_teacher/core/models/teacher_profile.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final profileProv = context.watch<ProfileProvider>();
    final profile = profileProv.profile;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final isClassTeacher = profile?.isClassTeacher ?? false;
    final isSubjectTeacher = profile?.isSubjectTeacher ?? false;
    final ct = profile?.permissions.classTeacher;
    final st = profile?.permissions.subjectTeacher;

    // Subject teacher: unique classes (skip classes already covered by class teacher role)
    final classTeacherClassId = profile?.classTeacher?.classInfo.id;
    final seenClassIds = <String>{};
    final uniqueSubjectClasses = <SubjectTeacherInfo>[];
    for (final a in (profile?.subjectTeacher ?? <SubjectTeacherInfo>[])) {
      if (a.classInfo.id == classTeacherClassId) continue;
      if (seenClassIds.add(a.classInfo.id)) uniqueSubjectClasses.add(a);
    }

    // Returns comma-separated subjects taught in a given class
    String subjectsFor(String classId) => (profile?.subjectTeacher ?? [])
        .where((a) => a.classInfo.id == classId)
        .map((a) => a.subject.name)
        .join(', ');

    final String roleLabel;
    if (isClassTeacher && isSubjectTeacher) {
      roleLabel = 'Class & Subject Teacher';
    } else if (isClassTeacher) {
      roleLabel = 'Class Teacher';
    } else if (isSubjectTeacher) {
      roleLabel = 'Subject Teacher';
    } else {
      roleLabel = auth.user?.role ?? 'Teacher';
    }

    final name = profile?.employee.name ?? auth.user?.name ?? '';
    final empId = profile?.employee.employeeId ?? '';
    final designation = profile?.employee.designation ?? '';
    final classLabel = profile?.classTeacher != null
        ? '${profile!.classTeacher!.classInfo.name} ${profile.classTeacher!.classInfo.section ?? ""}'
            .trim()
        : null;

    return RefreshIndicator(
      onRefresh: () => profileProv.fetchProfile(),
      color: AppColors.primary,
      child: SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Profile Card ────────────────────────────────────────────────────
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: _ProfileCard(
              name: name,
              roleLabel: roleLabel,
              designation: designation,
              empId: empId,
              classLabel: classLabel,
              isDark: isDark,
            ),
          ),
          const SizedBox(height: 20),

          // ── Class Section (class teacher only) ───────────────────────────────
          if (isClassTeacher && (ct?.viewStudents ?? true)) ...[
            _sectionLabel('My Class', isDark),
            const SizedBox(height: 8),
            _MenuTile(
              icon: Icons.people_outlined,
              iconColor: AppColors.accentPurple,
              title: 'Class Students',
              subtitle: 'View students in your assigned class',
              onTap: () => context.go('/students'),
              isDark: isDark,
            ),
            const SizedBox(height: 16),
          ],

          // ── Subject Students (one tile per assigned class) ────────────────────
          if (isSubjectTeacher &&
              (st?.viewSubjectStudents ?? true) &&
              uniqueSubjectClasses.isNotEmpty) ...[
            _sectionLabel('My Subject Students', isDark),
            const SizedBox(height: 8),
            ...uniqueSubjectClasses.map((a) {
              final subjects = subjectsFor(a.classInfo.id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _MenuTile(
                  icon: Icons.class_outlined,
                  iconColor: AppColors.accentGreen,
                  title: a.classInfo.fullName,
                  subtitle: subjects.isNotEmpty
                      ? subjects
                      : 'View students in this class',
                  onTap: () => context.go('/students', extra: {
                    'classId': a.classInfo.id,
                    'className': a.classInfo.fullName,
                  }),
                  isDark: isDark,
                ),
              );
            }),
            const SizedBox(height: 16),
          ],



          // ── School Calendar ───────────────────────────────────────────────────
          _sectionLabel('School Calendar', isDark),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.calendar_month_outlined,
            iconColor: AppColors.accentPurple,
            title: 'School Calendar',
            subtitle: 'Holidays, events, exam days and school dates',
            onTap: () => context.go('/calendar'),
            isDark: isDark,
          ),
          const SizedBox(height: 16),

          // ── Timetable ────────────────────────────────────────────────────────
          _sectionLabel('Timetable', isDark),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.schedule_outlined,
            iconColor: AppColors.info,
            title: 'My Timetable',
            subtitle: 'View your weekly class schedule',
            onTap: () => context.go('/timetable'),
            isDark: isDark,
          ),
          const SizedBox(height: 16),

          // ── Leave ────────────────────────────────────────────────────────────
          _sectionLabel('Leave', isDark),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.event_note_outlined,
            iconColor: AppColors.accentOrange,
            title: 'Apply for Leave',
            subtitle: 'Submit and track your leave requests',
            onTap: () => context.go('/leave'),
            isDark: isDark,
          ),
          const SizedBox(height: 16),

          // ── Library ──────────────────────────────────────────────────────────
          _sectionLabel('Library', isDark),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.menu_book_outlined,
            iconColor: AppColors.accentPurple,
            title: 'Library',
            subtitle: 'View your issued books and request renewals',
            onTap: () => context.go('/library'),
            isDark: isDark,
          ),
          const SizedBox(height: 16),

          // ── Account ──────────────────────────────────────────────────────────
          _sectionLabel('Account', isDark),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.lock_outline,
            iconColor: AppColors.info,
            title: 'Change Password',
            subtitle: 'Update your account password',
            onTap: () => _showChangePasswordSheet(context),
            isDark: isDark,
          ),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.logout,
            iconColor: AppColors.accentRed,
            title: 'Logout',
            subtitle: 'Sign out of your account',
            onTap: () => _showLogoutBottomSheet(context, auth),
            isDark: isDark,
            isDestructive: true,
          ),
          const SizedBox(height: 32),

          // ── Version ──────────────────────────────────────────────────────────
          Center(
            child: Text(
              'SKL School Management • v1.0.0',
              style: AppTypography.s12Regular(color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    ),
    );
  }

  Widget _sectionLabel(String label, bool isDark) => Text(
        label.toUpperCase(),
        style: AppTypography.s12SemiBold(
          color: isDark ? AppColors.textMuted : AppColors.textSecondary,
        ),
      );

  void _showChangePasswordSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ChangePasswordSheet(),
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
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                inherit: false)),
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

// ─── Profile Card ────────────────────────────────────────────────────────────

class _ProfileCard extends StatelessWidget {
  final String name;
  final String roleLabel;
  final String designation;
  final String empId;
  final String? classLabel;
  final bool isDark;

  const _ProfileCard({
    required this.name,
    required this.roleLabel,
    required this.designation,
    required this.empId,
    this.classLabel,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white.withValues(alpha: 0.2),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : 'T',
              style: AppTypography.s24Bold(color: Colors.white),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: AppTypography.s16Bold(color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(
                  designation.isNotEmpty ? designation : roleLabel,
                  style: AppTypography.s13Regular(
                      color: Colors.white.withValues(alpha: 0.85)),
                ),
                if (empId.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    empId,
                    style: AppTypography.s12Regular(
                        color: Colors.white.withValues(alpha: 0.7)),
                  ),
                ],
                if (classLabel != null) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Class: $classLabel',
                      style: AppTypography.s12SemiBold(color: Colors.white),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.white, size: 24),
        ],
      ),
    );
  }
}

// ─── Change Password Sheet ────────────────────────────────────────────────────

class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient.put('/auth/change-password', data: {
        'currentPassword': _currentCtrl.text.trim(),
        'newPassword': _newCtrl.text.trim(),
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Password changed successfully'),
            backgroundColor: AppColors.accentGreen,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = ApiClient.errorMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 24 + bottom),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 44, height: 4,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Change Password',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text('Enter your current password then choose a new one.',
                style: AppTypography.s13Regular(color: AppColors.textMuted)),
            const SizedBox(height: 20),

            // Current password
            _PasswordField(
              controller: _currentCtrl,
              label: 'Current Password',
              show: _showCurrent,
              onToggle: () => setState(() => _showCurrent = !_showCurrent),
              isDark: isDark,
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 14),

            // New password
            _PasswordField(
              controller: _newCtrl,
              label: 'New Password',
              show: _showNew,
              onToggle: () => setState(() => _showNew = !_showNew),
              isDark: isDark,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (v.length < 6) return 'At least 6 characters';
                return null;
              },
            ),
            const SizedBox(height: 14),

            // Confirm new password
            _PasswordField(
              controller: _confirmCtrl,
              label: 'Confirm New Password',
              show: _showConfirm,
              onToggle: () => setState(() => _showConfirm = !_showConfirm),
              isDark: isDark,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (v != _newCtrl.text) return 'Passwords do not match';
                return null;
              },
            ),

            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.accentRed.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.accentRed.withValues(alpha: 0.25)),
                ),
                child: Text(_error!,
                    style: AppTypography.s13Regular(color: AppColors.accentRed)),
              ),
            ],

            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.5, color: Colors.white))
                    : Text('Update Password',
                        style: GoogleFonts.inter(
                            fontWeight: FontWeight.w600, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PasswordField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool show;
  final VoidCallback onToggle;
  final bool isDark;
  final String? Function(String?) validator;

  const _PasswordField({
    required this.controller,
    required this.label,
    required this.show,
    required this.onToggle,
    required this.isDark,
    required this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: !show,
      validator: validator,
      style: AppTypography.s14Regular(
          color: isDark ? Colors.white : AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: AppTypography.s13Regular(color: AppColors.textMuted),
        suffixIcon: IconButton(
          icon: Icon(
            show ? Icons.visibility_off_outlined : Icons.visibility_outlined,
            size: 20,
            color: AppColors.textMuted,
          ),
          onPressed: onToggle,
        ),
        filled: true,
        fillColor: isDark
            ? AppColors.borderDark.withValues(alpha: 0.3)
            : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accentRed),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accentRed, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}

// ─── Menu Tile ───────────────────────────────────────────────────────────────

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool isDark;
  final bool isDestructive;

  const _MenuTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.isDark,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
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
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.s14SemiBold(
                      color: isDestructive
                          ? AppColors.accentRed
                          : (isDark ? Colors.white : AppColors.textPrimary),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTypography.s12Regular(color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
