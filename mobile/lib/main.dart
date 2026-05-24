import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app/app.dart';
import 'core/network/api_client.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Initialize API Client ──────────────────────────────────────────────────
  await ApiClient.init();

  // ── System UI ─────────────────────────────────────────────────────────────
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // ── Pre-cache Inter font (prevents flash on first render) ─────────────────
  GoogleFonts.config.allowRuntimeFetching = true;

  runApp(const SKLTeacherApp());
}
