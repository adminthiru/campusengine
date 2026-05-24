import 'package:flutter/material.dart';
import '../core/constants.dart';

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  const EmptyState({super.key, required this.icon, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: kBackground, shape: BoxShape.circle),
              child: Icon(icon, color: kTextMuted, size: 28),
            ),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w600, color: kTextSecondary,
            ), textAlign: TextAlign.center),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(subtitle!, style: const TextStyle(fontSize: 13, color: kTextMuted),
                  textAlign: TextAlign.center),
            ],
          ],
        ),
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, bg, label) = _resolve(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  (Color, Color, String) _resolve(String s) {
    switch (s.toLowerCase()) {
      case 'pending': return (const Color(0xFFF59E0B), const Color(0xFFFFFBEB), 'Pending');
      case 'approved': return (const Color(0xFF10B981), const Color(0xFFF0FDF4), 'Approved');
      case 'rejected': return (const Color(0xFFEF4444), const Color(0xFFFEF2F2), 'Rejected');
      case 'present': return (const Color(0xFF10B981), const Color(0xFFF0FDF4), 'Present');
      case 'absent': return (const Color(0xFFEF4444), const Color(0xFFFEF2F2), 'Absent');
      case 'late': return (const Color(0xFFF59E0B), const Color(0xFFFFFBEB), 'Late');
      case 'leave': return (const Color(0xFF8B5CF6), const Color(0xFFF5F3FF), 'Leave');
      default: return (const Color(0xFF64748B), const Color(0xFFF1F5F9), s);
    }
  }
}
