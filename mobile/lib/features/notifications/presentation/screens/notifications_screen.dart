import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/notifications/presentation/providers/notifications_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/auth/me');
      final user = res.data['user'] ?? res.data;
      // Backend stores newest-first (unshift); show it as-is so the latest
      // notification is at the top.
      final list = user['notifications'];
      setState(() {
        _notifications = list is List ? List<dynamic>.from(list) : [];
        _loading = false;
      });
      // Opening the list clears the bell badge and marks everything read.
      _markAllRead();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    if (mounted) context.read<NotificationsProvider>().clear();
    try {
      await ApiClient.post('/notifications/mark-all-read');
    } catch (_) {}
  }

  Future<void> _markRead(String id) async {
    try {
      await ApiClient.put('/auth/notifications/$id/read');
      setState(() {
        final idx = _notifications.indexWhere((n) => n['_id'] == id);
        if (idx >= 0) _notifications[idx]['read'] = true;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final unreadCount = _notifications.where((n) => n['read'] != true).length;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: _loading
          ? const SkeletonList()
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none,
                          size: 60, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      Text('No notifications yet',
                          style: AppTypography.s16SemiBold(
                              color: AppColors.textMuted)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (unreadCount > 0)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                          child: Text(
                            '$unreadCount unread',
                            style: AppTypography.s13SemiBold(
                                color: AppColors.primary),
                          ),
                        ),
                      Expanded(
                        child: ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(12),
                          itemCount: _notifications.length,
                          itemBuilder: (_, i) {
                            final n = _notifications[i];
                            final isRead = n['read'] == true;
                            final id = n['_id'] as String? ?? '';
                            return _NotifTile(
                              notification: n,
                              isRead: isRead,
                              isDark: isDark,
                              onTap: isRead ? null : () => _markRead(id),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _NotifTile extends StatelessWidget {
  final dynamic notification;
  final bool isRead;
  final bool isDark;
  final VoidCallback? onTap;

  const _NotifTile({
    required this.notification,
    required this.isRead,
    required this.isDark,
    this.onTap,
  });

  IconData _iconFor(String? type) {
    switch (type) {
      case 'attendance':
        return Icons.fact_check_outlined;
      case 'homework':
        return Icons.assignment_outlined;
      case 'exam':
        return Icons.quiz_outlined;
      case 'fee':
        return Icons.receipt_outlined;
      case 'leave':
        return Icons.event_note_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }

  Color _colorFor(String? type) {
    switch (type) {
      case 'attendance':
        return AppColors.accentGreen;
      case 'homework':
        return AppColors.accentOrange;
      case 'exam':
        return AppColors.accentPurple;
      case 'fee':
        return AppColors.accentRed;
      case 'leave':
        return AppColors.warning;
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = notification['title'] as String? ?? 'Notification';
    final message = notification['message'] as String? ?? '';
    final type = notification['type'] as String?;
    final createdAt = notification['createdAt'];
    final color = _colorFor(type);

    String timeAgo = '';
    try {
      final dt = DateTime.parse(createdAt.toString()).toLocal();
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inDays > 0) {
        timeAgo = DateFormat('dd MMM').format(dt);
      } else if (diff.inHours > 0) {
        timeAgo = '${diff.inHours}h ago';
      } else if (diff.inMinutes > 0) {
        timeAgo = '${diff.inMinutes}m ago';
      } else {
        timeAgo = 'Just now';
      }
    } catch (_) {}

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isRead
              ? (isDark ? AppColors.cardDark : Colors.white)
              : (isDark
                  ? AppColors.primary.withValues(alpha: 0.08)
                  : AppColors.primary.withValues(alpha: 0.04)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isRead
                ? (isDark ? AppColors.borderDark : AppColors.borderLight)
                : AppColors.primary.withValues(alpha: 0.25),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_iconFor(type), color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(title,
                            style: AppTypography.s14SemiBold(
                              color:
                                  isDark ? Colors.white : AppColors.textPrimary,
                            )),
                      ),
                      Text(timeAgo,
                          style: AppTypography.s12Regular(
                              color: AppColors.textMuted)),
                    ],
                  ),
                  if (message.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(message,
                        style: AppTypography.s13Regular(
                            color: AppColors.textSecondary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
            if (!isRead) ...[
              const SizedBox(width: 8),
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
