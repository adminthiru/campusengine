import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/models/teacher_profile.dart';

class ProfileProvider extends ChangeNotifier {
  TeacherProfile? _profile;
  bool _isLoading = false;
  String? _errorMessage;

  TeacherProfile? get profile => _profile;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchProfile() async {
    if (_isLoading) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiClient.get('/teacher/my-profile');
      _profile = TeacherProfile.fromJson(res.data);
    } catch (e) {
      debugPrint('Profile fetch error: $e');
      _errorMessage = ApiClient.errorMessage(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void reset() {
    _profile = null;
    _isLoading = false;
    _errorMessage = null;
    notifyListeners();
  }
}
