import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_colors.dart';

/// Shared skeleton-loading widgets (shimmer based) used across all three
/// logins in place of a bare CircularProgressIndicator while data loads.

/// A single rounded placeholder block. Meant to live inside a [SkeletonShimmer].
class SkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double radius;
  final EdgeInsets margin;
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.radius = 8,
    this.margin = EdgeInsets.zero,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        color: Colors.white, // shimmer paints the gradient over this
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Wraps [child] with a theme-aware shimmer sweep.
class SkeletonShimmer extends StatelessWidget {
  final Widget child;
  const SkeletonShimmer({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.borderDark : const Color(0xFFE2E8F0),
      highlightColor: isDark ? AppColors.cardDark : const Color(0xFFF1F5F9),
      child: child,
    );
  }
}

/// A card-shaped placeholder mimicking a list row (avatar + two text lines).
class SkeletonCard extends StatelessWidget {
  final double height;
  final bool showLeading;
  const SkeletonCard({super.key, this.height = 76, this.showLeading = true});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(
        children: [
          if (showLeading)
            const SkeletonBox(width: 44, height: 44, radius: 22),
          if (showLeading) const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonBox(width: 140, height: 13),
                SizedBox(height: 8),
                SkeletonBox(width: 90, height: 11),
              ],
            ),
          ),
          const SizedBox(width: 12),
          const SkeletonBox(width: 48, height: 22, radius: 8),
        ],
      ),
    );
  }
}

/// Drop-in full-screen list skeleton — a direct replacement for
/// `Center(child: CircularProgressIndicator())` on list-style screens.
class SkeletonList extends StatelessWidget {
  final int count;
  final double itemHeight;
  final bool showLeading;
  final EdgeInsets padding;
  const SkeletonList({
    super.key,
    this.count = 6,
    this.itemHeight = 76,
    this.showLeading = true,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: padding,
        itemCount: count,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, __) =>
            SkeletonCard(height: itemHeight, showLeading: showLeading),
      ),
    );
  }
}
