import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_endpoints.dart';
import '../../../../core/models/teacher_profile.dart';
import '../../../../core/models/student.dart';

class TeacherProvider extends ChangeNotifier {
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  TeacherProfile? _profile;
  TeacherProfile? get profile => _profile;

  List<Student> _students = [];
  List<Student> get students => _students;

  bool _isLoadingStudents = false;
  bool get isLoadingStudents => _isLoadingStudents;

  Future<void> fetchProfile() async {
    if (_profile != null) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiClient.get('/teacher/my-profile');
      _profile = TeacherProfile.fromJson(res.data as Map<String, dynamic>);
    } catch (e) {
      _error = ApiClient.errorMessage(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchStudentsForClass(String classId) async {
    _isLoadingStudents = true;
    _students = [];
    _error = null;
    notifyListeners();

    try {
      final res = await ApiClient.get(
        ApiEndpoints.students,
        params: {'classId': classId, 'limit': 300},
      );
      final List studData = (res.data as Map?)?['students'] as List? ?? [];
      _students = studData
          .map((j) => Student.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      _error = ApiClient.errorMessage(e);
    } finally {
      _isLoadingStudents = false;
      notifyListeners();
    }
  }
}
