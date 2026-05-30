import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';

class StudentProfile {
  final String id;
  final String name;
  final String admissionNumber;
  final String? photo;
  final String? bloodGroup;
  final String? phone;
  final String? email;
  final String? classId;
  final String? className;
  final String? classSection;

  StudentProfile({
    required this.id,
    required this.name,
    required this.admissionNumber,
    this.photo,
    this.bloodGroup,
    this.phone,
    this.email,
    this.classId,
    this.className,
    this.classSection,
  });

  factory StudentProfile.fromJson(Map<String, dynamic> j) {
    final cls = j['currentClass'] as Map<String, dynamic>?;
    return StudentProfile(
      id: j['_id'] ?? '',
      name: j['name'] ?? '',
      admissionNumber: j['admissionNumber'] ?? '',
      photo: j['photo'],
      bloodGroup: j['bloodGroup'],
      phone: j['phone'],
      email: j['email'],
      classId: cls?['_id'],
      className: cls?['name'],
      classSection: cls?['section'],
    );
  }

  String get classLabel {
    if (className == null) return 'No class assigned';
    return classSection != null ? '$className $classSection' : className!;
  }
}

class StudentProfileProvider extends ChangeNotifier {
  StudentProfile? _profile;
  bool _loading = false;
  String? _error;

  StudentProfile? get profile => _profile;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> fetchProfile() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiClient.get('/student/my-profile');
      final data = res.data;
      _profile = StudentProfile.fromJson(
        data['student'] as Map<String, dynamic>? ?? {},
      );
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      debugPrint('StudentProfileProvider error: $e');
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
