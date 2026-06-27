import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/services/push_service.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;
  String? _error;
  bool _pushEnabled = false; // hides the web "Enable notifications" banner once done

  @override
  void initState() {
    super.initState();
    _load();
  }

  // iOS web/PWA only shows the permission prompt from a user gesture, so we
  // request it from this tap rather than automatically on app load.
  Future<void> _enablePush() async {
    final ok = await PushService.requestAndRegister();
    if (!mounted) return;
    setState(() => _pushEnabled = ok);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? 'Push notifications enabled on this device.'
          : 'Permission blocked — allow notifications in your browser/site settings. On iPhone, add the app to your Home Screen first.'),
      duration: const Duration(seconds: 5),
    ));
  }

  Widget _enableBanner(bool isDark) => Container(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        ),
        child: Row(children: [
          const Icon(Icons.notifications_active_outlined,
              color: AppColors.primary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text('Enable push notifications on this device',
                style: AppTypography.s13Medium(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _enablePush,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Enable'),
          ),
        ]),
      );

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Dedicated endpoint returns notifications newest-first + an unread count.
      final res = await ApiClient.get('/notifications');
      final list = res.data is Map ? res.data['notifications'] : null;
      setState(() {
        _notifications = list is List ? list : const [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = ApiClient.errorMessage(e);
      });
    }
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
    final unreadCount =
        _notifications.where((n) => n is Map && n['read'] != true).length;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          if (kIsWeb && !_pushEnabled) _enableBanner(isDark),
          Expanded(child: _buildBody(isDark, unreadCount)),
        ],
      ),
    );
  }

  Widget _buildBody(bool isDark, int unreadCount) {
    if (_loading) return const SkeletonList();

    // Empty OR error — both are pull-to-refreshable so the screen is never blank
    // and the user can retry by swiping down.
    if (_notifications.isEmpty) {
      final isErr = _error != null;
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.28),
            Icon(isErr ? Icons.cloud_off_outlined : Icons.notifications_none,
                size: 60, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(isErr ? "Couldn't load notifications" : 'No notifications yet',
                textAlign: TextAlign.center,
                style: AppTypography.s16SemiBold(color: AppColors.textMuted)),
            const SizedBox(height: 6),
            Text(isErr ? 'Pull down to retry' : 'Pull down to refresh',
                textAlign: TextAlign.center,
                style: AppTypography.s13Regular(color: AppColors.textMuted)),
          ],
        ),
      );
    }

    return RefreshIndicator(
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

  // Backend stores `type` as a severity (info/success/warning/error), not a
  // category, so derive the category from the title for a meaningful icon.
  String _categoryOf(String title) {
    final t = title.toLowerCase();
    if (t.contains('attendance') || t.contains('absent')) return 'attendance';
    if (t.contains('homework')) return 'homework';
    if (t.contains('exam') || t.contains('result') || t.contains('mark')) {
      return 'exam';
    }
    if (t.contains('fee')) return 'fee';
    if (t.contains('leave')) return 'leave';
    return 'default';
  }

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
    final createdAt = notification['createdAt'];
    final category = _categoryOf(title);
    final color = _colorFor(category);

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
              child: Icon(_iconFor(category), color: color, size: 20),
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
