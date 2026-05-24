import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/storage.dart';
import '../models/user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.unknown;
  AppUser? _user;
  String? _error;

  AuthStatus get status => _status;
  AppUser? get user => _user;
  String? get error => _error;
  bool get isLoading => _status == AuthStatus.unknown;

  AuthProvider() {
    _tryAutoLogin();
  }

  Future<void> _tryAutoLogin() async {
    final token = await AppStorage.getToken();
    if (token == null) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      final res = await ApiClient.get('/auth/me');
      _user = AppUser.fromJson(res.data['user'] ?? res.data);
      _status = AuthStatus.authenticated;
    } catch (_) {
      await AppStorage.clearToken();
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _error = null;
    try {
      final res = await ApiClient.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final data = res.data;
      await AppStorage.saveToken(data['token']);
      _user = AppUser.fromJson(data['user']);
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      notifyListeners();
      return false;
    }
  }

  Future<String?> changePassword(String currentPassword, String newPassword) async {
    try {
      await ApiClient.put('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
      return null; // null = success
    } catch (e) {
      return ApiClient.errorMessage(e);
    }
  }

  Future<void> logout() async {
    await AppStorage.clearToken();
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void refreshUser() => _tryAutoLogin();
}
