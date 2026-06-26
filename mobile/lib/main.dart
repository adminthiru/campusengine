import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'app/app.dart';
import 'core/network/api_client.dart';
import 'firebase_options.dart';

// Background/terminated push handler. Messages with a `notification` payload are
// shown by the OS automatically — this just needs to exist and be registered.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase must never block the app from rendering. On web a Firebase/SDK
  // failure here would otherwise crash main() before runApp() → blank page.
  try {
    await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform);
    // Background handler is mobile-only — on web it requires a service worker
    // and throws if registered here.
    if (!kIsWeb) {
      FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
    }
  } catch (e) {
    debugPrint('Firebase init skipped: $e');
  }

  await ApiClient.init();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  GoogleFonts.config.allowRuntimeFetching = true;

  runApp(const SKLTeacherApp());
}
