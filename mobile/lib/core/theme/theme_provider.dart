// ── Theme Provider — Light / Dark / System theme management ─────────────────

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../app/config/app_constants.dart';

class ThemeProvider extends ChangeNotifier {
  // Default to light on first launch; the user's explicit choice is persisted.
  ThemeMode _themeMode = ThemeMode.light;

  ThemeMode get themeMode => _themeMode;

  bool get isLight => _themeMode == ThemeMode.light;
  bool get isDark  => _themeMode == ThemeMode.dark;

  /// Load saved preference from SharedPreferences on startup
  Future<void> loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    // No saved preference → light by default (not the device theme).
    final saved = prefs.getString(AppConstants.keyThemeMode) ?? 'light';
    _themeMode = _fromString(saved);
    notifyListeners();
  }

  Future<void> setLight() => _setMode(ThemeMode.light);
  Future<void> setDark()  => _setMode(ThemeMode.dark);
  Future<void> setSystem() => _setMode(ThemeMode.system);

  Future<void> toggle() async {
    if (_themeMode == ThemeMode.dark) {
      await setLight();
    } else {
      await setDark();
    }
  }

  Future<void> _setMode(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.keyThemeMode, _toString(mode));
  }

  static ThemeMode _fromString(String s) => switch (s) {
    'light'  => ThemeMode.light,
    'dark'   => ThemeMode.dark,
    _        => ThemeMode.system,
  };

  static String _toString(ThemeMode mode) => switch (mode) {
    ThemeMode.light  => 'light',
    ThemeMode.dark   => 'dark',
    ThemeMode.system => 'system',
  };
}
