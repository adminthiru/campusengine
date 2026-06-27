import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
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

  // Web Push (VAPID) public key — Firebase Console ▸ Cloud Messaging ▸
  // Web Push certificates. Required by getToken() on web; ignored on mobile.
  static const String _webVapidKey =
      'BNeQ9Qe-u-vokp10HcnQ-DHJgzq77RDBRV_EQGp9wMH_fG4r96KKVVzP4q7qJWHx9E9DOhvDsUURdbnCLfKA__8';

  // Call once the user is authenticated (e.g. from the app shell). Requests
  // permission, registers the device token, and wires up message listeners.
  static Future<void> setup() async {
    await requestAndRegister();
    _attachListeners();
  }

  /// Requests notification permission and registers the FCM token. Safe to call
  /// from a user tap — on iOS web/PWA the permission prompt only appears from a
  /// user gesture, so an in-app "Enable notifications" button calls this.
  /// Returns true if permission was granted.
  static Future<bool> requestAndRegister() async {
    try {
      final settings = await FirebaseMessaging.instance
          .requestPermission(alert: true, badge: true, sound: true);
      final granted =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
              settings.authorizationStatus == AuthorizationStatus.provisional;
      if (granted) await _registerToken();
      return granted;
    } catch (e) {
      debugPrint('[push] request/register failed: $e');
      return false;
    }
  }

  static void _attachListeners() {
    if (_listening) return;
    _listening = true;
    FirebaseMessaging.instance.onTokenRefresh.listen(_sendToken);
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final n = message.notification;
      if (n == null) return;
      scaffoldMessengerKey.currentState?.showSnackBar(SnackBar(
        content: Text('${n.title ?? 'Notification'} — ${n.body ?? ''}'),
        duration: const Duration(seconds: 4),
      ));
    });
  }

  static Future<void> _registerToken() async {
    // getToken on web requires the VAPID key; on mobile it must be null.
    final token = await FirebaseMessaging.instance
        .getToken(vapidKey: kIsWeb ? _webVapidKey : null);
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
