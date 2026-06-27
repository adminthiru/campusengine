import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import '../network/api_client.dart';
import '../network/api_endpoints.dart';

// Global messenger key so foreground push messages can be surfaced from anywhere.
final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

// Handles FCM: permission, device-token registration with the API, and showing
// foreground messages. Reused for every push type (attendance, exams, fees…).
class PushService {
  static bool _listening = false;

  // Call once the user is authenticated (e.g. from the app shell). Registers the
  // current device token for the logged-in user and wires up message listeners.
  static Future<void> setup() async {
    try {
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission(alert: true, badge: true, sound: true);

      await _registerToken();

      if (!_listening) {
        _listening = true;
        fm.onTokenRefresh.listen(_sendToken);
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          final n = message.notification;
          if (n == null) return;
          scaffoldMessengerKey.currentState?.showSnackBar(SnackBar(
            content: Text('${n.title ?? 'Notification'} — ${n.body ?? ''}'),
            duration: const Duration(seconds: 4),
          ));
        });
      }
    } catch (e) {
      debugPrint('[push] setup failed: $e');
    }
  }

  static Future<void> _registerToken() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _sendToken(token);
  }

  static Future<void> _sendToken(String token) async {
    try {
      await ApiClient.post(ApiEndpoints.registerFcmToken, data: {'token': token});
    } catch (e) {
      debugPrint('[push] token register failed: $e');
    }
  }
}
