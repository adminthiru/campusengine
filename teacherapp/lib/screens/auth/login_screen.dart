import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/constants.dart';
import '../../providers/auth_provider.dart';
import '../../providers/teacher_profile_provider.dart';
import '../main_shell.dart';

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
  bool _loading = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    final auth = context.read<AuthProvider>();
    final profileProv = context.read<TeacherProfileProvider>();
    final ok = await auth.login(_emailCtrl.text.trim(), _passCtrl.text);

    if (!mounted) return;

    if (ok) {
      await profileProv.fetchProfile();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainShell()),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.error ?? 'Login failed'),
          backgroundColor: kDanger,
        ),
      );
    }

    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo / Header
                Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    color: kPrimary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.school_rounded, color: Colors.white, size: 36),
                ),
                const SizedBox(height: 20),
                Text('School ERP', style: GoogleFonts.inter(
                  fontSize: 26, fontWeight: FontWeight.w800, color: kTextPrimary,
                )),
                const SizedBox(height: 6),
                Text('Teacher Portal', style: GoogleFonts.inter(
                  fontSize: 14, color: kTextMuted,
                )),
                const SizedBox(height: 36),

                // Card
                Container(
                  decoration: BoxDecoration(
                    color: kCardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: kBorder),
                    boxShadow: [BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 16, offset: const Offset(0, 4),
                    )],
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Sign In', style: GoogleFonts.inter(
                          fontSize: 18, fontWeight: FontWeight.w700, color: kTextPrimary,
                        )),
                        const SizedBox(height: 4),
                        Text('Enter your credentials to continue', style: GoogleFonts.inter(
                          fontSize: 13, color: kTextMuted,
                        )),
                        const SizedBox(height: 24),

                        // Email
                        Text('Email', style: GoogleFonts.inter(
                          fontSize: 13, fontWeight: FontWeight.w500, color: kTextSecondary,
                        )),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          style: GoogleFonts.inter(fontSize: 14, color: kTextPrimary),
                          decoration: const InputDecoration(
                            hintText: 'teacher@school.com',
                            prefixIcon: Icon(Icons.email_outlined, size: 18, color: kTextMuted),
                          ),
                          validator: (v) => v == null || v.isEmpty ? 'Email required' : null,
                        ),
                        const SizedBox(height: 16),

                        // Password
                        Text('Password', style: GoogleFonts.inter(
                          fontSize: 13, fontWeight: FontWeight.w500, color: kTextSecondary,
                        )),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _passCtrl,
                          obscureText: _obscure,
                          style: GoogleFonts.inter(fontSize: 14, color: kTextPrimary),
                          decoration: InputDecoration(
                            hintText: '••••••••',
                            prefixIcon: const Icon(Icons.lock_outline, size: 18, color: kTextMuted),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                size: 18, color: kTextMuted,
                              ),
                              onPressed: () => setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: (v) => v == null || v.isEmpty ? 'Password required' : null,
                        ),
                        const SizedBox(height: 8),

                        // Forgot password hint
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text('Contact your administrator to reset password',
                            style: GoogleFonts.inter(fontSize: 11, color: kTextMuted),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Login button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _login,
                            child: _loading
                                ? const SizedBox(width: 20, height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : Text('Sign In', style: GoogleFonts.inter(
                                    fontSize: 14, fontWeight: FontWeight.w600,
                                  )),
                          ),
                        ),
                      ],
                    ),
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
