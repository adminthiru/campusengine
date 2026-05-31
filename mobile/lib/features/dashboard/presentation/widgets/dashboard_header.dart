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
      if (mounted) {
        setState(() {
          _now = DateTime.now();
        });
      }
    });
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final profileProvider = context.watch<ProfileProvider>();
    final profile = profileProvider.profile;
    final name = profile?.employee.name ?? 'Teacher';

    final checkInProvider = context.watch<CheckInProvider>();
    final formattedDateTime = DateFormat('dd MMM yyyy, hh:mm a').format(_now);

    final durationParts = checkInProvider.durationString.split(':');
    final hours = durationParts.length == 3 ? durationParts[0] : '00';
    final minutes = durationParts.length == 3 ? durationParts[1] : '00';
    final seconds = durationParts.length == 3 ? durationParts[2] : '00';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.primary,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Good Morning,\n$name',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 24),
          // The new Check-In Container based on image
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.bgDark : Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: isDark
                  ? []
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
            ),
            child: Column(
              children: [
                // Timer Blocks
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildTimeBox(hours, isDark),
                    _buildTimeColon(isDark),
                    _buildTimeBox(minutes, isDark),
                    _buildTimeColon(isDark),
                    _buildTimeBox(seconds, isDark),
                  ],
                ),
                const SizedBox(height: 24),
                // Bottom Row: Avatar, Date/Time, Button
                Row(
                  children: [
                    if (profile?.employee.photo != null)
                      CircleAvatar(
                        radius: 20,
                        backgroundImage: NetworkImage(profile!.employee.photo!),
                      )
                    else
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: Colors.grey.shade300,
                        child: const Icon(Icons.person, color: Colors.grey),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        formattedDateTime,
                        style: GoogleFonts.inter(
                          color: isDark
                              ? AppColors.textMuted
                              : AppColors.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: checkInProvider.isLoading
                          ? null
                          : () => checkInProvider.handleCheckInOut(),
                      style: ElevatedButton.styleFrom(
                        minimumSize: Size.zero,
                        backgroundColor: checkInProvider.isCheckedIn
                            ? AppColors.error
                            : const Color(
                                0xFF22C55E), // Green color matching image
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24), // Pill shape
                        ),
                      ),
                      child: checkInProvider.isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              checkInProvider.isCheckedIn
                                  ? 'Check Out'
                                  : 'Check In',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
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

  Widget _buildTimeBox(String value, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.cardDark
            : const Color(0xFFEEF2FF), // Light indigo background
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        value,
        style: GoogleFonts.inter(
          color: isDark ? Colors.white : AppColors.textPrimary,
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildTimeColon(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(
        ':',
        style: GoogleFonts.inter(
          color: isDark ? Colors.white : AppColors.textPrimary,
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
