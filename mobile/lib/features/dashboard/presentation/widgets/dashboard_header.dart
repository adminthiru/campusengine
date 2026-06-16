import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:intl/intl.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/check_in_provider.dart';

class DashboardHeader extends StatefulWidget {
  const DashboardHeader({super.key});

  @override
  State<DashboardHeader> createState() => _DashboardHeaderState();
}

class _DashboardHeaderState extends State<DashboardHeader> {
  late Timer _clockTimer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    // Restore today's check-in state from the server.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final checkIn = context.read<CheckInProvider>();
      if (!checkIn.loadedToday) checkIn.loadToday();
    });
  }

  Future<void> _onCheckInOut() async {
    final checkIn = context.read<CheckInProvider>();
    final wasCheckedIn = checkIn.isCheckedIn;
    final ok = await checkIn.handleCheckInOut();
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    if (ok) {
      messenger.showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text(wasCheckedIn
            ? 'Checked out — location recorded'
            : 'Checked in — location recorded'),
      ));
    } else {
      messenger.showSnackBar(SnackBar(
        backgroundColor: AppColors.error,
        content: Text(checkIn.lastError ?? 'Something went wrong'),
      ));
    }
  }

  Widget _timePill(
    bool isDark, {
    required IconData icon,
    required String label,
    required DateTime? time,
    required Color color,
  }) {
    final hasTime = time != null;
    final display = hasTime ? DateFormat('hh:mm a').format(time) : '--:--';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: (isDark ? AppColors.cardDark : AppColors.bgLight)
            .withValues(alpha: isDark ? 1 : 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(
        children: [
          Icon(icon,
              size: 16, color: hasTime ? color : AppColors.textMuted),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textMuted,
                ),
              ),
              Text(
                display,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: hasTime
                      ? (isDark ? Colors.white : AppColors.textPrimary)
                      : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  String get _greeting {
    final h = _now.hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final profile = context.watch<ProfileProvider>().profile;
    final name = profile?.employee.name ?? 'Teacher';
    final firstName = name.split(' ').first;
    final photo = profile?.employee.photo;

    // Role / class subtitle
    String? subtitle;
    if (profile != null) {
      if (profile.classTeacher != null) {
        subtitle = 'Class Teacher · ${profile.classTeacher!.classInfo.fullName}';
      } else if (profile.isSubjectTeacher) {
        subtitle = 'Subject Teacher';
      } else if (profile.employee.designation != null) {
        subtitle = profile.employee.designation;
      }
    }

    final checkIn = context.watch<CheckInProvider>();
    final isIn = checkIn.isCheckedIn;
    final checkInEnabled = checkIn.checkInEnabled;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Greeting row ────────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _greeting,
                      style: GoogleFonts.inter(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      firstName,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                    // Shown above only while check-in is enabled; when disabled
                    // it moves into the card below.
                    if (subtitle != null && checkInEnabled) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: GoogleFonts.inter(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: Colors.white.withValues(alpha: 0.4), width: 2),
                ),
                child: CircleAvatar(
                  radius: 24,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  backgroundImage:
                      (photo != null && photo.isNotEmpty) ? NetworkImage(photo) : null,
                  child: (photo == null || photo.isEmpty)
                      ? Text(
                          firstName.isNotEmpty ? firstName[0].toUpperCase() : '?',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        )
                      : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Check-in card ───────────────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.bgDark : Colors.white,
              borderRadius: BorderRadius.circular(18),
              boxShadow: isDark
                  ? []
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      )
                    ],
            ),
            child: Column(
              children: [
                // Check-in UI — only when the feature is enabled by the school.
                if (checkInEnabled) ...[
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: (isIn ? AppColors.success : AppColors.textMuted)
                            .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        isIn ? Icons.login_rounded : Icons.logout_rounded,
                        color: isIn ? AppColors.success : AppColors.textMuted,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isIn ? 'Checked in' : 'Not checked in',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color:
                                  isDark ? Colors.white : AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isIn
                                ? 'Working time · ${checkIn.durationString}'
                                : 'Tap to start your day',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: isIn
                                  ? AppColors.success
                                  : (isDark
                                      ? AppColors.textMuted
                                      : AppColors.textSecondary),
                              fontFeatures: const [],
                            ),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: checkIn.isLoading ? null : _onCheckInOut,
                      style: ElevatedButton.styleFrom(
                        minimumSize: Size.zero,
                        backgroundColor:
                            isIn ? AppColors.error : AppColors.success,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 11),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      child: checkIn.isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              isIn ? 'Check Out' : 'Check In',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Divider(
                    height: 1,
                    color:
                        isDark ? AppColors.borderDark : AppColors.borderLight),
                const SizedBox(height: 12),
                if (checkIn.checkInTime != null) ...[
                  Row(
                    children: [
                      Expanded(
                        child: _timePill(
                          isDark,
                          icon: Icons.login_rounded,
                          label: 'Check In',
                          time: checkIn.checkInTime,
                          color: AppColors.success,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _timePill(
                          isDark,
                          icon: Icons.logout_rounded,
                          label: 'Check Out',
                          time: checkIn.checkOutTime,
                          color: AppColors.error,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
                ] else if (subtitle != null) ...[
                  // Check-in disabled → show the role / class here instead.
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.badge_rounded,
                            color: AppColors.primary, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          subtitle,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color:
                                isDark ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Divider(
                      height: 1,
                      color: isDark
                          ? AppColors.borderDark
                          : AppColors.borderLight),
                  const SizedBox(height: 12),
                ],
                Row(
                  children: [
                    Icon(Icons.calendar_today_rounded,
                        size: 14,
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Text(
                      DateFormat('EEEE, dd MMM yyyy').format(_now),
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? AppColors.textMuted
                            : AppColors.textSecondary,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      DateFormat('hh:mm a').format(_now),
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
