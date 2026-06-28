import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/theme/app_dimensions.dart';
import 'package:skl_teacher/core/storage/secure_storage.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _rememberMe = false;
  bool _loadingPrefs = true;

  @override
  void initState() {
    super.initState();
    _loadRememberMe();
  }

  // ── Load persisted Remember Me state ──────────────────────────────────────
  Future<void> _loadRememberMe() async {
    final storage = SecureStorageService.instance;
    final remember = await storage.getRememberMe();
    final email = remember ? (await storage.getSavedEmail() ?? '') : '';
    if (mounted) {
      setState(() {
        _rememberMe = remember;
        _loadingPrefs = false;
      });
      if (email.isNotEmpty) {
        _emailCtrl.text = email;
      }
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final storage = SecureStorageService.instance;

    await auth.login(_emailCtrl.text.trim(), _passCtrl.text);
    if (!mounted) return;

    if (auth.isAuthenticated) {
      // ── Persist or clear Remember Me ────────────────────────────────────
      if (_rememberMe) {
        await storage.saveRememberMe(true);
        await storage.saveSavedEmail(_emailCtrl.text.trim());
      } else {
        await storage.clearRememberMe();
      }
      if (!mounted) return;

      final role = auth.role;
      if (role != 'student' && role != 'parent') {
        final profileProv = context.read<ProfileProvider>();
        profileProv.reset();
        await profileProv.fetchProfile();
        if (!mounted) return;
      }
      final dest = role == 'student'
          ? '/student/dashboard'
          : role == 'parent'
              ? '/parent/dashboard'
              : '/dashboard';
      context.go(dest);
    } else if (auth.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage!),
          backgroundColor: AppColors.accentRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: _loadingPrefs
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary))
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppDimensions.xl,
                  vertical: AppDimensions.base,
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 48),

                      // ── Logo ────────────────────────────────────────────
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Center(
                          child: Text(
                            'SKL',
                            style: AppTypography.s20Bold(color: Colors.white),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppDimensions.xl),

                      // ── Heading ─────────────────────────────────────────
                      Text(
                        'Welcome back',
                        style: theme.textTheme.headlineLarge,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Sign in with your school credentials',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppDimensions.xl2),

                      // ── Email Field ─────────────────────────────────────
                      TextFormField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.text,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Email / Admission No. / Mobile',
                          hintText: 'Enter your email or admission number',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return 'This field is required';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: AppDimensions.base),

                      // ── Password Field ──────────────────────────────────
                      TextFormField(
                        controller: _passCtrl,
                        obscureText: _obscure,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          hintText: 'Enter your password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) {
                            return 'Password is required';
                          }
                          if (v.length < 6) return 'Minimum 6 characters';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),

                      // ── Remember Me + Forgot Password row ───────────────
                      Row(
                        children: [
                          // Custom animated checkbox
                          GestureDetector(
                            onTap: () =>
                                setState(() => _rememberMe = !_rememberMe),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: _rememberMe
                                    ? AppColors.primary
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: _rememberMe
                                      ? AppColors.primary
                                      : (isDark
                                          ? Colors.white38
                                          : Colors.grey.shade400),
                                  width: 1.8,
                                ),
                              ),
                              child: _rememberMe
                                  ? const Icon(Icons.check,
                                      size: 14, color: Colors.white)
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 10),
                          GestureDetector(
                            onTap: () =>
                                setState(() => _rememberMe = !_rememberMe),
                            child: Text(
                              'Remember me',
                              style: AppTypography.s14Medium(
                                color: isDark
                                    ? Colors.white70
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () {},
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              'Forgot password?',
                              style: AppTypography.s14Medium(
                                  color: AppColors.primary),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppDimensions.xl),

                      // ── Sign In Button ───────────────────────────────────
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: auth.isLoading ? null : _submit,
                          child: auth.isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Text(
                                  'Sign In',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                    inherit: false,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: AppDimensions.xl2),

                      // ── Footer ──────────────────────────────────────────
                      Center(
                        child: Text(
                          'SKL School Management System',
                          style: theme.textTheme.labelSmall,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

}
