import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../core/models/user.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.initial;
  String? _errorMessage;
  AppUser? _user;

  AuthStatus get status => _status;
  String? get errorMessage => _errorMessage;
  AppUser? get user => _user;
  bool get isAuthenticated => _status == AuthStatus.authenticated;
  bool get isLoading => _status == AuthStatus.loading;
  String get role => _user?.role ?? '';

  Future<void> checkAuth() async {
    try {
      final token = await SecureStorageService.instance.getAccessToken();
      if (token == null || token.isEmpty) {
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return;
      }
      
      final res = await ApiClient.get('/auth/me');
      _user = AppUser.fromJson(res.data['user'] ?? res.data);
      _status = AuthStatus.authenticated;
    } catch (e) {
      debugPrint('AuthProvider checkAuth error: $e');
      await SecureStorageService.instance.clearAll();
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    _status = AuthStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiClient.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final data = res.data;
      
      _user = AppUser.fromJson(data['user']);
      
      await SecureStorageService.instance.saveAuthData(
        accessToken: data['token'],
        refreshToken: data['token'], // If no refresh token provided, fallback to token
        userId: _user!.id,
        schoolId: '',
        role: _user!.role,
      );

      _status = AuthStatus.authenticated;
    } catch (e) {
      _status = AuthStatus.error;
      _errorMessage = ApiClient.errorMessage(e);
    }
    notifyListeners();
  }

  Future<void> logout() async {
    await SecureStorageService.instance.clearAll();
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
