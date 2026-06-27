import 'package:flutter/foundation.dart';
import 'package:skl_teacher/core/network/api_client.dart';

/// Tracks the unread in-app notification count for the bell badge.
/// Refreshed on app load, when the Notifications screen loads, and after a
/// notification is read.
class NotificationsProvider extends ChangeNotifier {
  int _unread = 0;
  int get unread => _unread;

  void _set(int v) {
    if (v == _unread) return;
    _unread = v < 0 ? 0 : v;
    notifyListeners();
  }

  /// Fetches the latest unread count from the server.
  Future<void> refresh() async {
    try {
      final res = await ApiClient.get('/notifications');
      final n = res.data is Map ? res.data['unread'] : null;
      _set(n is num ? n.toInt() : 0);
    } catch (_) {/* keep last known count on failure */}
  }

  /// Set the count directly (e.g. from the Notifications screen's own fetch).
  void setCount(int v) => _set(v);

  /// Optimistically decrement when a single notification is marked read.
  void decrement() => _set(_unread - 1);

  void clear() => _set(0);
}
