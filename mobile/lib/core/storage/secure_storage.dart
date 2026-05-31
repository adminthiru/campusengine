// ── Secure Storage — JWT tokens in Android Keystore / iOS Keychain ─────────────
// Never store tokens in SharedPreferences (not encrypted).
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../app/config/app_constants.dart';

class SecureStorageService {
  SecureStorageService._();
  static final SecureStorageService instance = SecureStorageService._();

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  Future<String?> _safeRead(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (e) {
      debugPrint('SecureStorage read error for key $key: $e. Attempting to clear storage.');
      await clearAll();
      return null;
    }
  }

  Future<void> _safeWrite(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (e) {
      debugPrint('SecureStorage write error for key $key: $e. Attempting to clear storage and retry.');
      await clearAll();
      try {
        await _storage.write(key: key, value: value);
      } catch (err) {
        debugPrint('SecureStorage retry write failed: $err');
      }
    }
  }

  // ── Tokens ────────────────────────────────────────────────────────────────
  Future<void> saveAccessToken(String token) =>
      _safeWrite(AppConstants.keyAccessToken, token);

  Future<void> saveRefreshToken(String token) =>
      _safeWrite(AppConstants.keyRefreshToken, token);

  Future<String?> getAccessToken() =>
      _safeRead(AppConstants.keyAccessToken);

  Future<String?> getRefreshToken() =>
      _safeRead(AppConstants.keyRefreshToken);

  // ── User Info ─────────────────────────────────────────────────────────────
  Future<void> saveUserId(String id) =>
      _safeWrite(AppConstants.keyUserId, id);

  Future<String?> getUserId() =>
      _safeRead(AppConstants.keyUserId);

  Future<void> saveSchoolId(String id) =>
      _safeWrite(AppConstants.keySchoolId, id);

  Future<String?> getSchoolId() =>
      _safeRead(AppConstants.keySchoolId);

  Future<void> saveUserRole(String role) =>
      _safeWrite(AppConstants.keyUserRole, role);

  Future<String?> getUserRole() =>
      _safeRead(AppConstants.keyUserRole);

  // ── Save all auth data at once ────────────────────────────────────────────
  Future<void> saveAuthData({
    required String accessToken,
    required String refreshToken,
    required String userId,
    required String schoolId,
    required String role,
  }) async {
    await saveAccessToken(accessToken);
    await saveRefreshToken(refreshToken);
    await saveUserId(userId);
    await saveSchoolId(schoolId);
    await saveUserRole(role);
  }

  // ── Remember Me ───────────────────────────────────────────────────────────
  Future<void> saveRememberMe(bool value) =>
      _safeWrite(AppConstants.keyRememberMe, value ? '1' : '0');

  Future<bool> getRememberMe() async {
    final v = await _safeRead(AppConstants.keyRememberMe);
    return v == '1';
  }

  Future<void> saveSavedEmail(String email) =>
      _safeWrite(AppConstants.keySavedEmail, email);

  Future<String?> getSavedEmail() =>
      _safeRead(AppConstants.keySavedEmail);

  Future<void> clearRememberMe() async {
    try {
      await _storage.delete(key: AppConstants.keyRememberMe);
      await _storage.delete(key: AppConstants.keySavedEmail);
    } catch (e) {
      debugPrint('SecureStorage clearRememberMe failed: $e');
    }
  }

  // ── Clear everything (logout) ────────────────────────────────────────────
  Future<void> clearAll() async {
    try {
      await _storage.deleteAll();
    } catch (e) {
      debugPrint('SecureStorage clearAll failed: $e');
    }
  }

  // ── Check if user is authenticated ───────────────────────────────────────
  Future<bool> isAuthenticated() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}
