import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_dimensions.dart';
import 'package:skl_teacher/features/auth/presentation/providers/auth_provider.dart';
import 'package:skl_teacher/core/models/teacher_profile.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProfileProvider>().fetchProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final profileProvider = context.watch<ProfileProvider>();
    final authProvider = context.watch<AuthProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.brightness == Brightness.light
          ? AppColors.bgLight
          : AppColors.bgDark,
      body: RefreshIndicator(
        onRefresh: () => profileProvider.fetchProfile(),
        color: AppColors.primary,
        child: profileProvider.isLoading
            ? _buildShimmerLoading()
            : profileProvider.profile == null
                ? _buildErrorView(profileProvider.errorMessage)
                : _buildProfileContent(
                    context, profileProvider.profile!, authProvider),
      ),
    );
  }

  Widget _buildShimmerLoading() {
    return SkeletonShimmer(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppDimensions.base),
        children: const [
          // Avatar + name placeholder
          SizedBox(height: 12),
          Center(child: SkeletonBox(width: 92, height: 92, radius: 46)),
          SizedBox(height: 16),
          Center(child: SkeletonBox(width: 160, height: 18)),
          SizedBox(height: 8),
          Center(child: SkeletonBox(width: 120, height: 13)),
          SizedBox(height: 28),
          // Info card placeholders
          SkeletonBox(width: double.infinity, height: 150, radius: 16),
          SizedBox(height: 16),
          SkeletonBox(width: double.infinity, height: 200, radius: 16),
          SizedBox(height: 16),
          SkeletonBox(width: double.infinity, height: 130, radius: 16),
        ],
      ),
    );
  }

  Widget _buildErrorView(String? error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppDimensions.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline,
                size: 48, color: AppColors.accentRed),
            const SizedBox(height: AppDimensions.base),
            Text(
              'Failed to load profile',
              style:
                  GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: AppDimensions.sm),
            Text(
              error ?? 'An unexpected error occurred. Please try again.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                  color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: AppDimensions.lg),
            ElevatedButton(
              onPressed: () => context.read<ProfileProvider>().fetchProfile(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileContent(
    BuildContext context,
    TeacherProfile profile,
    AuthProvider authProvider,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.cardDark : Colors.white;
    final dividerColor = isDark ? AppColors.borderDark : AppColors.borderLight;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        children: [
          // ── Top Header Section ─────────────────────────────────────────────
          _buildHeaderBanner(profile, authProvider, isDark),

          Padding(
            padding: const EdgeInsets.all(AppDimensions.base),
            child: Column(
              children: [
                // ── Contact Info Card ────────────────────────────────────────
                _buildInfoCard(
                  title: 'Contact Information',
                  icon: Icons.contact_mail_outlined,
                  cardBg: cardBg,
                  dividerColor: dividerColor,
                  children: [
                    _buildInfoRow(Icons.email_outlined, 'Email Address',
                        authProvider.user?.email ?? '',
                        isEmail: true),
                    _buildInfoRow(Icons.phone_outlined, 'Mobile Number',
                        authProvider.user?.phone ?? '',
                        isPhone: true),
                    if (''.isNotEmpty)
                      _buildInfoRow(
                          Icons.phone_callback_outlined, 'Alternate Phone', ''),
                    _buildInfoRow(
                      Icons.map_outlined,
                      'Address',
                      [''].where((s) => s.isNotEmpty).join(', '),
                    ),
                  ],
                ),
                const SizedBox(height: AppDimensions.base),

                // ── Employment Details Card ──────────────────────────────────
                _buildInfoCard(
                  title: 'Employment Details',
                  icon: Icons.work_outline,
                  cardBg: cardBg,
                  dividerColor: dividerColor,
                  children: [
                    _buildInfoRow(Icons.badge_outlined, 'Employee ID',
                        (profile.employee.employeeId ?? '')),
                    _buildInfoRow(Icons.corporate_fare_outlined, 'Department',
                        profile.employee.department ?? 'General'),
                    _buildInfoRow(Icons.assignment_ind_outlined, 'Designation',
                        profile.employee.designation ?? 'Teacher'),
                    _buildInfoRow(
                      Icons.calendar_today_outlined,
                      'Date of Joining',
                      '—',
                    ),
                    _buildInfoRow(Icons.timelapse_outlined, 'Employment Type',
                        'Full-time'),
                    _buildInfoRow(
                      Icons.credit_card_outlined,
                      'Aadhar / Identity',
                      '—',
                    ),
                  ],
                ),
                const SizedBox(height: AppDimensions.base),

                // ── Academics & Experience ───────────────────────────────────
                if ([].isNotEmpty) ...[
                  _buildQualificationsCard([], cardBg, dividerColor),
                  const SizedBox(height: AppDimensions.base),
                ],

                // ── Emergency & Bank Card ────────────────────────────────────
                _buildInfoCard(
                  title: 'Emergency & Bank Details',
                  icon: Icons.security_outlined,
                  cardBg: cardBg,
                  dividerColor: dividerColor,
                  children: [
                    _buildInfoRow(
                      Icons.contact_phone_outlined,
                      'Emergency Contact',
                      '—',
                    ),
                    _buildInfoRow(
                      Icons.account_balance_outlined,
                      'Bank Account',
                      '—',
                    ),
                    _buildInfoRow(
                      Icons.qr_code_2_outlined,
                      'UPI ID',
                      '—',
                    ),
                  ],
                ),
                const SizedBox(height: AppDimensions.xl2),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderBanner(
      TeacherProfile profile, AuthProvider auth, bool isDark) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        boxShadow: AppColors.shadowSm,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(AppDimensions.radiusXl),
          bottomRight: Radius.circular(AppDimensions.radiusXl),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: AppDimensions.base),
          // Avatar Stack
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      width: 4),
                ),
                child: CircleAvatar(
                  radius: 46,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  backgroundImage: profile.employee.photo != null
                      ? NetworkImage(profile.employee.photo!)
                      : null,
                  child: profile.employee.photo == null
                      ? Text(
                          (auth.user?.name ?? profile.employee.name)
                              .substring(0, 1)
                              .toUpperCase(),
                          style: GoogleFonts.inter(
                            fontSize: 36,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        )
                      : null,
                ),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.camera_alt_outlined,
                    size: 14,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppDimensions.md),
          // Name
          Text(
            (auth.user?.name ?? profile.employee.name),
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: AppDimensions.xs),
          // Designation
          Text(
            '${profile.employee.designation ?? 'Teacher'} · ${profile.employee.department ?? ''}',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppDimensions.md),
          // Status + Employee ID Pills
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.md, vertical: 6),
                decoration: BoxDecoration(
                  color: 'active' == 'active'
                      ? AppColors.badgeSuccessBg
                      : AppColors.badgeDangerBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: 'active' == 'active'
                            ? AppColors.accentGreen
                            : AppColors.accentRed,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'active'.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: 'active' == 'active'
                            ? AppColors.accentGreen
                            : AppColors.accentRed,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppDimensions.sm),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.md, vertical: 6),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.borderDark.withValues(alpha: 0.4)
                      : AppColors.borderLight.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  (profile.employee.employeeId ?? ''),
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppDimensions.xl),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required String title,
    required IconData icon,
    required Color cardBg,
    required Color dividerColor,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(AppDimensions.radiusLg),
        boxShadow: AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(
              left: AppDimensions.base,
              right: AppDimensions.base,
              top: AppDimensions.base,
              bottom: AppDimensions.sm,
            ),
            child: Row(
              children: [
                Icon(icon, size: 20, color: AppColors.primary),
                const SizedBox(width: AppDimensions.sm),
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          Divider(color: dividerColor, height: 1),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: children.length,
            separatorBuilder: (_, __) =>
                Divider(color: dividerColor, height: 1),
            itemBuilder: (_, index) => children[index],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value,
      {bool isEmail = false, bool isPhone = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.base, vertical: AppDimensions.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.textMuted),
          const SizedBox(width: AppDimensions.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value.isEmpty ? '—' : value,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQualificationsCard(
      List<dynamic> qualifications, Color cardBg, Color dividerColor) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(AppDimensions.radiusLg),
        boxShadow: AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: AppDimensions.base, vertical: AppDimensions.base),
            child: Row(
              children: [
                const Icon(Icons.school_outlined,
                    size: 20, color: AppColors.primary),
                const SizedBox(width: AppDimensions.sm),
                Text(
                  'Qualifications & Education',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          Divider(color: dividerColor, height: 1),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: qualifications.length,
            separatorBuilder: (_, __) =>
                Divider(color: dividerColor, height: 1),
            itemBuilder: (_, index) {
              final qual = qualifications[index];
              return Padding(
                padding: const EdgeInsets.all(AppDimensions.base),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.bookmark_added_outlined,
                          size: 16, color: AppColors.primary),
                    ),
                    const SizedBox(width: AppDimensions.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            qual.degree ?? '—',
                            style: GoogleFonts.inter(
                                fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            qual.institution ?? '—',
                            style: GoogleFonts.inter(
                                fontSize: 12, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              if (qual.year != null)
                                Text(
                                  'Class of ${qual.year}',
                                  style: GoogleFonts.inter(
                                      fontSize: 11, color: AppColors.textMuted),
                                ),
                              if (qual.year != null && qual.percentage != null)
                                Text(
                                  '  •  ',
                                  style: GoogleFonts.inter(
                                      fontSize: 11, color: AppColors.textMuted),
                                ),
                              if (qual.percentage != null)
                                Text(
                                  'Score: ${qual.percentage}%',
                                  style: GoogleFonts.inter(
                                      fontSize: 11,
                                      color: AppColors.accentGreen,
                                      fontWeight: FontWeight.w600),
                                ),
                            ],
                          )
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Edit Profile Bottom Sheet ────────────────────────────────────────────────

class EditProfileBottomSheet extends StatelessWidget {
  final TeacherProfile profile;

  const EditProfileBottomSheet({super.key, required this.profile});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(AppDimensions.radiusLg),
          topRight: Radius.circular(AppDimensions.radiusLg),
        ),
      ),
      padding: const EdgeInsets.all(AppDimensions.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: AppDimensions.lg),
          Text(
            'Edit Profile',
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: AppDimensions.base),
          Text(
            'Profile editing is currently unavailable.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppDimensions.xl2),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: AppDimensions.md),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
                ),
              ),
              onPressed: () => Navigator.pop(context),
              child: const Text('Close',
                  style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(height: AppDimensions.sm),
        ],
      ),
    );
  }
}
