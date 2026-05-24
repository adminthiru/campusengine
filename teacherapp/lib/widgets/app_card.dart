import 'package:flutter/material.dart';
import '../core/constants.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final Color? borderLeftColor;
  final double borderLeftWidth;
  final VoidCallback? onTap;

  const AppCard({
    super.key, required this.child, this.padding,
    this.borderLeftColor, this.borderLeftWidth = 4, this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              color: kCardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: kBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8, offset: const Offset(0, 2),
                ),
              ],
            ),
            padding: padding ?? const EdgeInsets.all(16),
            child: child,
          ),
          // Colored left accent strip — drawn on top to avoid non-uniform border issue
          if (borderLeftColor != null)
            Positioned(
              left: 0, top: 0, bottom: 0,
              child: Container(width: borderLeftWidth, color: borderLeftColor),
            ),
        ],
      ),
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: card);
    }
    return card;
  }
}

class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final Color bgColor;

  const StatCard({
    super.key, required this.title, required this.value,
    required this.icon, required this.color, required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: const TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w700, color: kTextPrimary,
                )),
                Text(title, style: const TextStyle(fontSize: 12, color: kTextMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
