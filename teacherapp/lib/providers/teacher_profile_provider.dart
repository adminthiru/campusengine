import 'package:flutter/material.dart';
import '../core/api.dart';
import '../models/teacher_profile.dart';

class TeacherProfileProvider extends ChangeNotifier {
  TeacherProfile? _profile;
  bool _loading = false;
  String? _error;

  TeacherProfile? get profile => _profile;
  bool get loading => _loading;
  String? get error => _error;

  bool get isClassTeacher => _profile?.isClassTeacher ?? false;
  bool get isSubjectTeacher => _profile?.isSubjectTeacher ?? false;
  bool get isAssigned => isClassTeacher || isSubjectTeacher;

  Future<void> fetchProfile() async {
    if (_loading) return;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiClient.get('/teacher/my-profile');
      _profile = TeacherProfile.fromJson(res.data);
    } catch (e) {
      _error = ApiClient.errorMessage(e);
    }
    _loading = false;
    notifyListeners();
  }

  void reset() {
    _profile = null;
    _loading = false;
    _error = null;
    notifyListeners();
  }
}
