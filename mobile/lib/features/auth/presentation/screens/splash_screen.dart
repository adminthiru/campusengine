import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/auth_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 800));
    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _controller.forward();
    _navigate();
  }

  Future<void> _navigate() async {
    try {
      debugPrint('SplashScreen: Navigation started');

      await Future.delayed(const Duration(milliseconds: 1800));

      if (!mounted) {
        debugPrint('SplashScreen: Widget not mounted after delay');
        return;
      }

      final auth = context.read<AuthProvider>();

      debugPrint('SplashScreen: Checking authentication...');
      await auth.checkAuth();

      if (!mounted) {
        debugPrint('SplashScreen: Widget not mounted after auth check');
        return;
      }

      debugPrint('SplashScreen: isAuthenticated = ${auth.isAuthenticated}');

      String route;
      if (!auth.isAuthenticated) {
        route = '/auth/login';
      } else {
        final role = auth.user?.role ?? '';
        route = role == 'student'
            ? '/student/dashboard'
            : role == 'parent'
                ? '/parent/dashboard'
                : '/dashboard';
      }

      debugPrint('SplashScreen: Navigating to $route');

      context.go(route);
    } catch (e, stackTrace) {
      debugPrint('SplashScreen _navigate error: $e');
      debugPrint('StackTrace: $stackTrace');

      if (mounted) {
        debugPrint('SplashScreen: Redirecting to login due to error');
        context.go('/auth/login');
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: FadeTransition(
        opacity: _fadeAnim,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // ── Logo ───────────────────────────────────────────────────
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    'SKL',
                    style: GoogleFonts.inter(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              // ── App Name ───────────────────────────────────────────────
              Text(
                'SKL Teacher',
                style: GoogleFonts.inter(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.8,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'School Management System',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: Colors.white.withValues(alpha: 0.75),
                  letterSpacing: -0.1,
                ),
              ),
              const SizedBox(height: 72),
              // ── Loader ─────────────────────────────────────────────────
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
