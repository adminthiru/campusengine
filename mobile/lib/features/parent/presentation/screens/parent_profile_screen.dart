import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
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
      body: RefreshIndicator(
        onRefresh: () => pp.fetchChildren(),
        child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
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

          // ── School Contact ───────────────────────────────────────────────
          _SectionLabel('School Contact', isDark),
          const SizedBox(height: 10),
          _SchoolContactCard(
              isDark: isDark, fallbackName: user?.school?.name ?? ''),
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
                        child: Text(c.initial,
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

          // ── Account ──────────────────────────────────────────────────────
          _SectionLabel('Account', isDark),
          const SizedBox(height: 10),
          _ActionTile(
            icon: Icons.lock_outline,
            color: AppColors.primary,
            title: 'Change Password',
            subtitle: 'Update your account password',
            isDark: isDark,
            onTap: () => _showChangePasswordSheet(context, isDark),
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
      ),
    );
  }

  void _showChangePasswordSheet(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChangePasswordSheet(isDark: isDark),
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

// Shows the school's contact details (name, phone, email) from the admin
// School Profile. Name is seeded from the auth payload; phone/email are
// fetched from GET /school (accessible to any authenticated user).
class _SchoolContactCard extends StatefulWidget {
  final bool isDark;
  final String fallbackName;
  const _SchoolContactCard(
      {required this.isDark, required this.fallbackName});
  @override
  State<_SchoolContactCard> createState() => _SchoolContactCardState();
}

class _SchoolContactCardState extends State<_SchoolContactCard> {
  String _name = '';
  String _phone = '';
  String _email = '';

  @override
  void initState() {
    super.initState();
    _name = widget.fallbackName;
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.get('/school');
      final s = res.data['school'];
      if (s is Map && mounted) {
        setState(() {
          _name = (s['name'] ?? _name).toString();
          _phone = (s['phone'] ?? '').toString();
          _email = (s['email'] ?? '').toString();
        });
      }
    } catch (_) {/* keep fallback name */}
  }

  String _dash(String v) => v.trim().isEmpty ? '—' : v;

  @override
  Widget build(BuildContext context) {
    return _InfoCard(isDark: widget.isDark, children: [
      _InfoRow('School', _dash(_name), widget.isDark),
      _Divider(widget.isDark),
      _InfoRow('Phone', _dash(_phone), widget.isDark),
      _Divider(widget.isDark),
      _InfoRow('Email', _dash(_email), widget.isDark),
    ]);
  }
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
