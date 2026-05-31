import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/theme/theme_provider.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final themeProvider = context.watch<ThemeProvider>();
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Appearance ───────────────────────────────────────────────────
          _SectionLabel(label: 'Appearance', isDark: isDark),
          const SizedBox(height: 8),
          _SettingCard(
            isDark: isDark,
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.accentPurple.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isDark ? Icons.nightlight_round : Icons.wb_sunny_outlined,
                    color: isDark ? Colors.amber : AppColors.accentOrange,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Dark Mode',
                          style: AppTypography.s14SemiBold(
                              color: isDark
                                  ? Colors.white
                                  : AppColors.textPrimary)),
                      Text('Switch between light and dark theme',
                          style: AppTypography.s12Regular(
                              color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Switch(
                  value: isDark,
                  onChanged: (_) => themeProvider.toggle(),
                  activeThumbColor: AppColors.primary,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Security ─────────────────────────────────────────────────────
          _SectionLabel(label: 'Security', isDark: isDark),
          const SizedBox(height: 8),
          _SettingTile(
            icon: Icons.lock_outline,
            iconColor: AppColors.accentGreen,
            title: 'Change Password',
            subtitle: 'Update your login password',
            isDark: isDark,
            onTap: () => _showChangePasswordSheet(context, isDark),
          ),
          const SizedBox(height: 20),

          // ── Account ──────────────────────────────────────────────────────
          _SectionLabel(label: 'Account', isDark: isDark),
          const SizedBox(height: 8),
          _SettingCard(
            isDark: isDark,
            child: Column(
              children: [
                _InfoRow(
                  label: 'Name',
                  value: auth.user?.name ?? '—',
                  isDark: isDark,
                ),
                _Divider(isDark: isDark),
                _InfoRow(
                  label: 'Email',
                  value: auth.user?.email ?? '—',
                  isDark: isDark,
                ),
                _Divider(isDark: isDark),
                _InfoRow(
                  label: 'Role',
                  value: _capitalize(auth.user?.role ?? '—'),
                  isDark: isDark,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── About ────────────────────────────────────────────────────────
          _SectionLabel(label: 'About', isDark: isDark),
          const SizedBox(height: 8),
          _SettingCard(
            isDark: isDark,
            child: Column(
              children: [
                _InfoRow(
                    label: 'App Name', value: 'SKL School', isDark: isDark),
                _Divider(isDark: isDark),
                _InfoRow(label: 'Version', value: '1.0.0', isDark: isDark),
              ],
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  void _showChangePasswordSheet(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChangePasswordSheet(isDark: isDark),
    );
  }
}

// ─── Section Label ────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String label;
  final bool isDark;
  const _SectionLabel({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) => Text(
        label.toUpperCase(),
        style: AppTypography.s12SemiBold(
            color: isDark ? AppColors.textMuted : AppColors.textSecondary),
      );
}

// ─── Setting Card ─────────────────────────────────────────────────────────────
class _SettingCard extends StatelessWidget {
  final bool isDark;
  final Widget child;
  const _SettingCard({required this.isDark, required this.child});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: child,
      );
}

// ─── Setting Tile ─────────────────────────────────────────────────────────────
class _SettingTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool isDark;
  final VoidCallback onTap;

  const _SettingTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.isDark,
    required this.onTap,
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
                color: isDark ? AppColors.borderDark : AppColors.borderLight),
            boxShadow: isDark ? [] : AppColors.shadowSm,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    Text(subtitle,
                        style: AppTypography.s12Regular(
                            color: AppColors.textMuted)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
            ],
          ),
        ),
      );
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  final bool isDark;
  const _InfoRow(
      {required this.label, required this.value, required this.isDark});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            SizedBox(
              width: 100,
              child: Text(label,
                  style: AppTypography.s13Regular(color: AppColors.textMuted)),
            ),
            Expanded(
              child: Text(value,
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary)),
            ),
          ],
        ),
      );
}

class _Divider extends StatelessWidget {
  final bool isDark;
  const _Divider({required this.isDark});
  @override
  Widget build(BuildContext context) => Divider(
        height: 1,
        color: isDark ? AppColors.borderDark : AppColors.borderLight,
      );
}

// ─── Change Password Bottom Sheet ─────────────────────────────────────────────
class _ChangePasswordSheet extends StatefulWidget {
  final bool isDark;
  const _ChangePasswordSheet({required this.isDark});
  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _loading = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ApiClient.put('/auth/change-password', data: {
        'currentPassword': _currentCtrl.text,
        'newPassword': _newCtrl.text,
      });
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Password changed successfully'),
        backgroundColor: AppColors.accentGreen,
      ));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ApiClient.errorMessage(e)),
        backgroundColor: AppColors.accentRed,
      ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text('Change Password',
                  style: AppTypography.s18Bold(
                      color: isDark ? Colors.white : AppColors.textPrimary)),
              const SizedBox(height: 20),
              _PasswordField(
                controller: _currentCtrl,
                label: 'Current Password',
                obscure: _obscureCurrent,
                onToggle: () =>
                    setState(() => _obscureCurrent = !_obscureCurrent),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              _PasswordField(
                controller: _newCtrl,
                label: 'New Password',
                obscure: _obscureNew,
                onToggle: () => setState(() => _obscureNew = !_obscureNew),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (v.length < 6) return 'Minimum 6 characters';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              _PasswordField(
                controller: _confirmCtrl,
                label: 'Confirm New Password',
                obscure: _obscureConfirm,
                onToggle: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (v != _newCtrl.text) return 'Passwords do not match';
                  return null;
                },
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : Text('Update Password',
                          style:
                              AppTypography.s15SemiBold(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PasswordField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool obscure;
  final VoidCallback onToggle;
  final String? Function(String?) validator;

  const _PasswordField({
    required this.controller,
    required this.label,
    required this.obscure,
    required this.onToggle,
    required this.validator,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.lock_outline),
        suffixIcon: IconButton(
          icon: Icon(obscure
              ? Icons.visibility_outlined
              : Icons.visibility_off_outlined),
          onPressed: onToggle,
        ),
        filled: true,
        fillColor: isDark ? AppColors.bgDark : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
      ),
    );
  }
}
