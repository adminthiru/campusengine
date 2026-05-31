import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';

class ChildInfo {
  final String id;
  final String name;
  final String admissionNumber;
  final String? photo;
  final String? classId;
  final String? className;
  final String? classSection;
  final String? phone;
  final String? bloodGroup;

  ChildInfo({
    required this.id,
    required this.name,
    required this.admissionNumber,
    this.photo,
    this.classId,
    this.className,
    this.classSection,
    this.phone,
    this.bloodGroup,
  });

  factory ChildInfo.fromJson(Map<String, dynamic> j) {
    final cls = j['currentClass'] as Map<String, dynamic>?;
    return ChildInfo(
      id: j['_id'] ?? '',
      name: j['name'] ?? '',
      admissionNumber: j['admissionNumber'] ?? '',
      photo: j['photo'],
      classId: cls?['_id'],
      className: cls?['name'],
      classSection: cls?['section'],
      phone: j['phone'],
      bloodGroup: j['bloodGroup'],
    );
  }

  String get classLabel {
    if (className == null) return 'No class';
    return classSection != null ? '$className $classSection' : className!;
  }
}

class ParentDataProvider extends ChangeNotifier {
  List<ChildInfo> _children = [];
  bool _loading = false;
  String? _error;

  List<ChildInfo> get children => _children;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> fetchChildren() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiClient.get('/parent/my-children');
      final data = res.data;
      final list =
          (data['children'] ?? data['students']) as List<dynamic>? ?? [];
      _children = list
          .map((c) => ChildInfo.fromJson(c as Map<String, dynamic>))
          .toList();
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      debugPrint('ParentDataProvider error: $e');
    }
    _loading = false;
    notifyListeners();
  }

  void reset() {
    _children = [];
    _loading = false;
    _error = null;
    notifyListeners();
  }
}
