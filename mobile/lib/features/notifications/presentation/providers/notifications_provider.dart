import 'package:flutter/foundation.dart';
import 'package:skl_teacher/core/network/api_client.dart';

/// Tracks the unread in-app notification count for the bell badge.
/// Refreshed on app load; cleared when the user opens the Notifications screen.
class NotificationsProvider extends ChangeNotifier {
  int _unread = 0;
  int get unread => _unread;

  void _set(int v) {
    final n = v < 0 ? 0 : v;
    if (n == _unread) return;
    _unread = n;
    notifyListeners();
  }

  /// Fetch the latest unread count from the server.
  Future<void> refresh() async {
    try {
      final res = await ApiClient.get('/notifications');
      final n = res.data is Map ? res.data['unread'] : null;
      _set(n is num ? n.toInt() : 0);
    } catch (_) {/* keep last known count on failure */}
  }

  /// Clear the badge (e.g. once the user has opened the notifications list).
  void clear() => _set(0);
}
