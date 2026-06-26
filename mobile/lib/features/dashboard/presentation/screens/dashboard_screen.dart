import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/dashboard_header.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/class_teacher_view.dart';
import 'package:skl_teacher/features/dashboard/presentation/widgets/subject_teacher_view.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final profileProv = context.read<ProfileProvider>();
    if (profileProv.profile == null && !profileProv.isLoading) {
      await profileProv.fetchProfile();
    }
    if (profileProv.profile != null && mounted) {
      await context
          .read<DashboardProvider>()
          .fetchDashboardData(profileProv.profile!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final profileProvider = context.watch<ProfileProvider>();

    if (profileProvider.isLoading ||
        (profileProvider.profile == null &&
            profileProvider.errorMessage == null)) {
      return const Scaffold(body: _DashboardSkeleton());
    }

    final profile = profileProvider.profile;
    if (profile == null) {
      return Scaffold(
        body: Center(
          child: Text(
              'Error: ${profileProvider.errorMessage ?? "Failed to load profile"}',
              style: TextStyle(color: isDark ? Colors.white : Colors.black)),
        ),
      );
    }

    final isClassTeacher = profile.isClassTeacher;
    final isSubjectTeacher = profile.isSubjectTeacher;

    // Determine tabs
    final tabs = <Tab>[];
    final views = <Widget>[];

    if (isClassTeacher) {
      tabs.add(const Tab(text: 'My Class'));
      views.add(const ClassTeacherView());
    }
    if (isSubjectTeacher || !isClassTeacher) {
      // Fallback to subject view if not a class teacher
      tabs.add(const Tab(text: 'My Subjects'));
      views.add(const SubjectTeacherView());
    }

    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        body: RefreshIndicator(
          onRefresh: _loadData,
          child: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) {
            return [
              const SliverToBoxAdapter(
                child: DashboardHeader(),
              ),
              if (tabs.length > 1)
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _SliverAppBarDelegate(
                    TabBar(
                      indicatorColor: AppColors.primary,
                      indicatorWeight: 3,
                      labelColor: AppColors.primary,
                      unselectedLabelColor: isDark
                          ? AppColors.textMuted
                          : AppColors.textSecondary,
                      labelStyle: GoogleFonts.inter(
                          fontWeight: FontWeight.w700, fontSize: 15),
                      unselectedLabelStyle: GoogleFonts.inter(
                          fontWeight: FontWeight.w500, fontSize: 15),
                      tabs: tabs,
                    ),
                    isDark ? AppColors.cardDark : Colors.white,
                  ),
                ),
            ];
          },
          body: TabBarView(children: views),
          ),
        ),
      ),
    );
  }
}

class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar _tabBar;
  final Color _color;

  _SliverAppBarDelegate(this._tabBar, this._color);

  @override
  double get minExtent => _tabBar.preferredSize.height;
  @override
  double get maxExtent => _tabBar.preferredSize.height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: _color,
      child: _tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverAppBarDelegate oldDelegate) {
    return false;
  }
}

/// Shimmer placeholder loosely matching the dashboard layout (header banner,
/// check-in card, then a couple of section cards).
class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              SizedBox(height: 16),
              SkeletonBox(width: 120, height: 14),
              SizedBox(height: 10),
              SkeletonBox(width: 180, height: 24),
              SizedBox(height: 20),
              SkeletonBox(width: double.infinity, height: 96, radius: 18),
              SizedBox(height: 24),
              SkeletonBox(width: 160, height: 17),
              SizedBox(height: 12),
              SkeletonBox(width: double.infinity, height: 110, radius: 16),
              SizedBox(height: 24),
              SkeletonBox(width: 160, height: 17),
              SizedBox(height: 12),
              SkeletonBox(width: double.infinity, height: 76, radius: 14),
              SizedBox(height: 10),
              SkeletonBox(width: double.infinity, height: 76, radius: 14),
            ],
          ),
        ),
      ),
    );
  }
}
