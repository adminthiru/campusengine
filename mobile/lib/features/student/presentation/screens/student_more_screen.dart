import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_dimensions.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/school_permissions_provider.dart';
import 'package:skl_teacher/features/student/presentation/providers/student_profile_provider.dart';

class StudentMoreScreen extends StatelessWidget {
  const StudentMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final perms = context.watch<SchoolPermissionsProvider>();
    final sp = context.watch<StudentProfileProvider>();
    final student = sp.profile;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RefreshIndicator(
      onRefresh: () => sp.fetchProfile(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Profile card (tappable) ──────────────────────────────────────
            GestureDetector(
              onTap: () => _showProfileSheet(context, auth),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.cardDark : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  boxShadow: isDark ? [] : AppColors.shadowSm,
                ),
                child: Row(children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    child: Text(
                      (auth.user?.name ?? 'S').substring(0, 1).toUpperCase(),
                      style: GoogleFonts.inter(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(auth.user?.name ?? '',
                            style: GoogleFonts.inter(
                                fontSize: 15, fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white : AppColors.textPrimary)),
                        const SizedBox(height: 2),
                        Text(student?.classLabel ?? '',
                            style: GoogleFonts.inter(
                                fontSize: 13, color: AppColors.textSecondary)),
                        Text(student?.admissionNumber ?? '',
                            style: GoogleFonts.inter(
                                fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.07),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.chevron_right_rounded,
                        size: 20, color: AppColors.primary),
                  ),
                ]),
              ),
            ),

            const SizedBox(height: 20),
            Text('More Options',
                style: GoogleFonts.inter(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 12),

            // ── Options ──────────────────────────────────────────────────────
            if (perms.studentCan('viewFees'))
              _tile(context, Icons.receipt_outlined, 'My Fees',
                  'View fee records & payment status',
                  () => context.go('/student/fees'), isDark),

            if (perms.studentCan('submitLeaveRequest'))
              _tile(context, Icons.event_note_outlined, 'Leave Requests',
                  'Apply for leave & view history',
                  () => context.go('/student/leave'), isDark),

            if (perms.studentCan('viewTimetable'))
              _tile(context, Icons.schedule_outlined, 'Timetable',
                  'View class timetable',
                  () => context.go('/student/timetable'), isDark),

            _tile(context, Icons.calendar_month_outlined, 'School Calendar',
                'Holidays, events, exam days and school dates',
                () => context.go('/calendar'), isDark,
                color: AppColors.accentPurple),
          ],
        ),
      ),
    );
  }

  Widget _tile(BuildContext ctx, IconData icon, String title, String subtitle,
      VoidCallback onTap, bool isDark, {Color? color}) {
    final c = color ?? AppColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: c, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: c == AppColors.accentRed ? c : null)),
              Text(subtitle,
                  style: GoogleFonts.inter(
                      fontSize: 12, color: AppColors.textMuted)),
            ]),
          ),
          Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
        ]),
      ),
    );
  }

  void _showProfileSheet(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ProfileSheet(auth: auth),
    );
  }
}

// ── Profile bottom sheet ───────────────────────────────────────────────────────
class _ProfileSheet extends StatefulWidget {
  final AuthProvider auth;
  const _ProfileSheet({required this.auth});

  @override
  State<_ProfileSheet> createState() => _ProfileSheetState();
}

class _ProfileSheetState extends State<_ProfileSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _saving = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiClient.put('/auth/change-password', data: {
        'currentPassword': _currentCtrl.text,
        'newPassword': _newCtrl.text,
      });
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password updated successfully'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } catch (e) {
      final msg = e.toString().contains('401') || e.toString().contains('incorrect')
          ? 'Current password is incorrect'
          : 'Failed to update password. Try again.';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.accentRed),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDark;
    final student = context.watch<StudentProfileProvider>().profile;
    final name = widget.auth.user?.name ?? '';

    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Drag handle ────────────────────────────────────────────────
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.borderDark : const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // ── Profile info ───────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: isDark ? 0.12 : 0.05),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.15)),
                ),
                child: Row(children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : 'S',
                      style: AppTypography.s24Bold(color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            style: AppTypography.s16Bold(
                                color: isDark ? Colors.white : AppColors.textPrimary)),
                        const SizedBox(height: 3),
                        if (student?.classLabel.isNotEmpty == true)
                          Text(student!.classLabel,
                              style: AppTypography.s13Regular(
                                  color: AppColors.textSecondary)),
                        if (student?.admissionNumber.isNotEmpty == true)
                          Text(student!.admissionNumber,
                              style: AppTypography.s12Regular(
                                  color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                ]),
              ),

              const SizedBox(height: 24),

              // ── Change password section ────────────────────────────────────
              Align(
                alignment: Alignment.centerLeft,
                child: Text('Change Password',
                    style: AppTypography.s15SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary)),
              ),
              const SizedBox(height: 12),
              Form(
                key: _formKey,
                child: Column(children: [
                  _PasswordField(
                    controller: _currentCtrl,
                    label: 'Current Password',
                    obscure: _obscureCurrent,
                    isDark: isDark,
                    onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                    validator: (v) => (v?.isEmpty ?? true) ? 'Required' : null,
                  ),
                  const SizedBox(height: 10),
                  _PasswordField(
                    controller: _newCtrl,
                    label: 'New Password',
                    obscure: _obscureNew,
                    isDark: isDark,
                    onToggle: () => setState(() => _obscureNew = !_obscureNew),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if (v.length < 6) return 'Minimum 6 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 10),
                  _PasswordField(
                    controller: _confirmCtrl,
                    label: 'Confirm New Password',
                    obscure: _obscureConfirm,
                    isDark: isDark,
                    onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if (v != _newCtrl.text) return 'Passwords do not match';
                      return null;
                    },
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2.5))
                          : const Text('Update Password',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                  inherit: false)),
                    ),
                  ),
                ]),
              ),

              const SizedBox(height: 20),
              Divider(
                  color: isDark ? AppColors.borderDark : const Color(0xFFE2E8F0)),
              const SizedBox(height: 12),

              // ── Logout ─────────────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _confirmLogout(context, widget.auth),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    side: BorderSide(color: AppColors.accentRed.withValues(alpha: 0.4)),
                    foregroundColor: AppColors.accentRed,
                  ),
                  icon: const Icon(Icons.logout_rounded, size: 18,
                      color: AppColors.accentRed),
                  label: const Text('Log Out',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.accentRed,
                          inherit: false)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    // Show confirmation stacked on top; auth.logout() triggers navigation
    // which dismisses all sheets — no need to pop the profile sheet manually.
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => Consumer<ThemeProvider>(
        builder: (_, tp, __) {
          final isDark = tp.isDark;
          return Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppDimensions.radiusLg)),
            ),
            padding: const EdgeInsets.all(AppDimensions.base),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 44, height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: AppDimensions.lg),
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.accentRed.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.logout_rounded,
                      color: AppColors.accentRed, size: 28),
                ),
                const SizedBox(height: 12),
                Text('Log Out',
                    style: AppTypography.s18Bold(color: AppColors.accentRed)),
                const SizedBox(height: 6),
                Text('Are you sure you want to log out of your account?',
                    textAlign: TextAlign.center,
                    style: AppTypography.s14Regular(color: AppColors.textSecondary)),
                const SizedBox(height: AppDimensions.xl),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            vertical: AppDimensions.md),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                                AppDimensions.radiusMd)),
                      ),
                      onPressed: () => Navigator.pop(sheetCtx),
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
                            borderRadius: BorderRadius.circular(
                                AppDimensions.radiusMd)),
                      ),
                      onPressed: () {
                        Navigator.pop(sheetCtx);
                        auth.logout();
                      },
                      child: const Text('Log Out',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              inherit: false)),
                    ),
                  ),
                ]),
                const SizedBox(height: AppDimensions.sm),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Reusable password field ────────────────────────────────────────────────────
class _PasswordField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool obscure, isDark;
  final VoidCallback onToggle;
  final String? Function(String?)? validator;

  const _PasswordField({
    required this.controller, required this.label,
    required this.obscure, required this.isDark,
    required this.onToggle, this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      style: AppTypography.s14Regular(
          color: isDark ? Colors.white : AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: AppTypography.s13Regular(color: AppColors.textMuted),
        prefixIcon: Icon(Icons.lock_outline_rounded,
            size: 18, color: AppColors.textMuted),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
            size: 18, color: AppColors.textMuted,
          ),
          onPressed: onToggle,
        ),
        contentPadding: const EdgeInsets.symmetric(
            horizontal: 14, vertical: 14),
        filled: true,
        fillColor: isDark
            ? AppColors.borderDark.withValues(alpha: 0.3)
            : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : const Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : const Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.accentRed, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.accentRed, width: 1.5),
        ),
      ),
      validator: validator,
    );
  }
}
