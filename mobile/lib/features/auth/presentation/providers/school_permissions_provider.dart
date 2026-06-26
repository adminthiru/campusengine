import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';

class SchoolPermissionsProvider extends ChangeNotifier {
  Map<String, dynamic> _studentPerms = {};
  Map<String, dynamic> _parentPerms = {};
  List<Map<String, dynamic>> _grades = []; // gradeConfig.grades
  bool _loaded = false;

  bool get loaded => _loaded;
  bool studentCan(String key) => _studentPerms[key] != false;
  bool parentCan(String key) => _parentPerms[key] != false;

  /// Maps a percentage to the school's configured grade label (same logic the
  /// admin exam module uses). Returns '' when no grade config is loaded/matches.
  String gradeFor(num? pct) {
    if (pct == null || _grades.isEmpty) return '';
    for (final g in _grades) {
      final minS = (g['minScore'] as num?) ?? 0;
      final maxS = (g['maxScore'] as num?) ?? 100;
      if (pct >= minS && pct <= maxS) return (g['label'] as String?) ?? '';
    }
    return '';
  }

  Future<void> fetch() async {
    try {
      final res = await ApiClient.get('/school');
      final school = res.data['school'] as Map<String, dynamic>? ?? {};
      _studentPerms = Map<String, dynamic>.from(school['studentPermissions'] ?? {});
      _parentPerms = Map<String, dynamic>.from(school['parentPermissions'] ?? {});
      final grades = (school['gradeConfig']?['grades'] as List?) ?? const [];
      _grades = grades.map((g) => Map<String, dynamic>.from(g as Map)).toList();
      _loaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('SchoolPermissionsProvider fetch error: $e');
    }
  }

  void reset() {
    _studentPerms = {};
    _parentPerms = {};
    _grades = [];
    _loaded = false;
    notifyListeners();
  }
}
